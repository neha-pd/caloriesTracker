import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { redis } from '../services/redis.js';

const updateProfileSchema = z.object({
  display_name: z.string().optional(),
  age: z.number().int().min(10).max(120).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  height_cm: z.number().positive().optional(),
  weight_kg: z.number().positive().optional(),
  activity_level: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active']).optional(),
  timezone: z.string().optional(),
});

const goalsSchema = z.object({
  goal_type: z.enum(['lose_weight', 'maintain', 'gain_muscle']).optional(),
  calorie_goal: z.number().int().min(500).max(10000),
  protein_goal_g: z.number().int().optional(),
  carbs_goal_g: z.number().int().optional(),
  fat_goal_g: z.number().int().optional(),
});

// Activity multipliers for TDEE
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary:          1.2,
  lightly_active:     1.375,
  moderately_active:  1.55,
  very_active:        1.725,
  extra_active:       1.9,
};

function calculateNutrition(user: {
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_level?: string | null;
  goal_type?: string | null;
}) {
  const { gender, activity_level, goal_type } = user;

  // Coerce Postgres NUMERIC columns (returned as strings by postgres.js) to numbers
  const age       = user.age       != null ? Number(user.age)       : null;
  const height_cm = user.height_cm != null ? Number(user.height_cm) : null;
  const weight_kg = user.weight_kg != null ? Number(user.weight_kg) : null;

  if (!age || !height_cm || !weight_kg) return null;

  // Mifflin-St Jeor BMR
  let bmr: number;
  if (gender === 'female') {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  } else {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[activity_level ?? 'sedentary'] ?? 1.2;
  // Clamp to >= 500 kcal — extreme params (very old + very small) can yield negative BMR
  let tdee = Math.max(500, Math.round(bmr * multiplier));

  // Adjust for goal
  if (goal_type === 'lose_weight')  tdee = Math.max(500, Math.round(tdee * 0.85));
  if (goal_type === 'gain_muscle')  tdee = Math.round(tdee * 1.10);

  // AMDR macro split: Protein ~25%, Carbs ~45%, Fat ~30%
  const protein_g = Math.round((tdee * 0.25) / 4);  // 4 kcal/g
  const carbs_g   = Math.round((tdee * 0.45) / 4);  // 4 kcal/g
  const fat_g     = Math.round((tdee * 0.30) / 9);  // 9 kcal/g

  // Averaged DRI values for other / prefer_not_to_say genders
  const isFemale = gender === 'female';
  const isNonBin = gender === 'other' || gender === 'prefer_not_to_say';

  const fiber_g      = isFemale ? 25 : isNonBin ? 32 : 38;
  const sodium_mg    = 2300;
  const calcium_mg   = age >= 50 ? 1200 : 1000;
  const iron_mg      = isFemale && age < 51 ? 18 : isNonBin && age < 51 ? 13 : 8;
  const vitaminC_mg  = isFemale ? 75 : isNonBin ? 83 : 90;
  const vitaminD_iu  = age >= 70 ? 800 : 600;
  const potassium_mg = 3400;
  const magnesium_mg = isFemale
    ? (age >= 31 ? 320 : 310)
    : isNonBin
      ? (age >= 31 ? 370 : 355)
      : (age >= 31 ? 420 : 400);

  return {
    tdee,
    calorie_goal: tdee,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    sodium_mg,
    calcium_mg,
    iron_mg,
    vitaminC_mg,
    vitaminD_iu,
    potassium_mg,
    magnesium_mg,
  };
}

export async function userRoutes(app: FastifyInstance) {
  // GET /api/users/me
  app.get('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const [user] = await db`
      SELECT id, email, display_name, avatar_url, age, gender, height_cm, weight_kg,
             activity_level, goal_type, calorie_goal, protein_goal_g, carbs_goal_g,
             fat_goal_g, timezone, created_at
      FROM users WHERE id = ${userId}
    `;
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send({ user });
  });

  // PATCH /api/users/me
  app.patch('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const body = updateProfileSchema.parse(request.body);
    const [user] = await db`
      UPDATE users SET
        display_name = COALESCE(${body.display_name ?? null}, display_name),
        age          = COALESCE(${body.age ?? null}, age),
        gender       = COALESCE(${body.gender ?? null}, gender),
        height_cm    = COALESCE(${body.height_cm ?? null}, height_cm),
        weight_kg    = COALESCE(${body.weight_kg ?? null}, weight_kg),
        activity_level = COALESCE(${body.activity_level ?? null}, activity_level),
        timezone     = COALESCE(${body.timezone ?? null}, timezone),
        updated_at   = NOW()
      WHERE id = ${userId}
      RETURNING id, email, display_name, age, gender, height_cm, weight_kg,
                activity_level, goal_type, calorie_goal, protein_goal_g,
                carbs_goal_g, fat_goal_g, timezone
    `;
    return reply.send({ user });
  });

  // GET /api/users/me/goals/calculate — compute TDEE + macros from physical profile
  // Accepts optional ?goal_type= query param to preview different goals without patching the DB
  app.get('/me/goals/calculate', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const { goal_type: queryGoalType } = request.query as { goal_type?: string };
    const [user] = await db`
      SELECT age, gender, height_cm, weight_kg, activity_level, goal_type FROM users WHERE id = ${userId}
    `;
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const result = calculateNutrition({ ...user, goal_type: queryGoalType ?? user.goal_type });
    if (!result) return reply.status(422).send({ error: 'Please complete your physical profile (age, height, weight) first.' });
    return reply.send(result);
  });

  // PATCH /api/users/me/goals
  app.patch('/me/goals', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const body = goalsSchema.parse(request.body);
    const [user] = await db`
      UPDATE users SET
        goal_type      = COALESCE(${body.goal_type ?? null}, goal_type),
        calorie_goal   = ${body.calorie_goal},
        protein_goal_g = ${body.protein_goal_g ?? null},
        carbs_goal_g   = ${body.carbs_goal_g ?? null},
        fat_goal_g     = ${body.fat_goal_g ?? null},
        updated_at     = NOW()
      WHERE id = ${userId}
      RETURNING goal_type, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g
    `;
    // Invalidate dashboard cache so new goals show immediately
    await redis.del(`dashboard:today:${userId}`);
    return reply.send({ goals: user });
  });
}
