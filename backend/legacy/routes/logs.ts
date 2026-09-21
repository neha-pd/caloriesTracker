import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { visionQueue } from '../services/queue.js';
import { uploadImage } from '../services/storage.js';
import { getOrCreateDailyLog, servingFactor } from '../services/logHelpers.js';
import { redis } from '../services/redis.js';
import { resolveLogDate } from '../services/dates.js';

const manualEntrySchema = z.object({
  food_item_id: z.string().uuid(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).default('snack'),
  quantity: z.number().positive().default(1),
  serving_unit: z.string().default('serving'),
  notes: z.string().optional(),
});

const customEntrySchema = z.object({
  name: z.string().trim().min(1),
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative().default(0),
  carbs_g: z.number().nonnegative().default(0),
  fat_g: z.number().nonnegative().default(0),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).default('snack'),
});

const updateEntrySchema = z.object({
  quantity: z.number().positive().optional(),
  serving_unit: z.string().optional(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  calories: z.number().optional(),
  protein_g: z.number().optional(),
  carbs_g: z.number().optional(),
  fat_g: z.number().optional(),
  notes: z.string().optional(),
  is_user_overridden: z.boolean().optional(),
});

export async function logRoutes(app: FastifyInstance) {
  // ── POST /api/logs/image ─────────────────────────────────────────────────
  // Accepts multipart image, creates a PENDING log entry, enqueues vision job
  app.post('/image', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const mealType = (request.query as any).meal_type ?? 'snack';
    const logDate  = resolveLogDate(request, (request.query as any).date);

    // Upload image to storage
    const imageUrl = await uploadImage(data, userId);

    // Get or create today's daily log
    const user = await db`SELECT calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM users WHERE id = ${userId}`.then(r => r[0]);
    const dailyLog = await getOrCreateDailyLog(userId, logDate, user);

    // Create PENDING log entry
    const [entry] = await db`
      INSERT INTO log_entries (daily_log_id, user_id, meal_type, status, image_url, logged_at)
      VALUES (${dailyLog.id}, ${userId}, ${mealType}, 'pending', ${imageUrl}, NOW())
      RETURNING id, status, image_url, meal_type, logged_at
    `;

    // Create vision job record
    const [job] = await db`
      INSERT INTO vision_jobs (log_entry_id, user_id, image_url)
      VALUES (${entry.id}, ${userId}, ${imageUrl})
      RETURNING id
    `;

    // Enqueue BullMQ job
    await visionQueue.add('analyze-food-image', {
      vision_job_id: job.id,
      log_entry_id: entry.id,
      user_id: userId,
      image_url: imageUrl,
      daily_log_id: dailyLog.id,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    // The pending entry already counts toward the meal's entry list, so the
    // cached dashboard is stale from this moment (not only when analysis lands).
    await redis.del(`dashboard:today:${userId}`);

    return reply.status(202).send({
      log_entry_id: entry.id,
      status: 'pending',
      message: 'Image received — analysing nutrition…',
    });
  });

  // ── POST /api/logs/entries — Manual log ──────────────────────────────────
  app.post('/entries', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId  = (request.user as any).sub;
    const body    = manualEntrySchema.parse(request.body);
    const logDate = resolveLogDate(request, (request.body as any).date);

    const [food] = await db`SELECT * FROM food_items WHERE id = ${body.food_item_id} LIMIT 1`;
    if (!food) return reply.status(404).send({ error: 'Food item not found' });

    const user = await db`SELECT calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM users WHERE id = ${userId}`.then(r => r[0]);
    const dailyLog = await getOrCreateDailyLog(userId, logDate, user);

    // Quantity may be expressed in the food's own serving unit, or by weight
    // (grams/oz) when the food has a known serving weight.
    const factor   = servingFactor(food, body.quantity, body.serving_unit);
    const calories = +(food.calories * factor).toFixed(2);
    const proteinG = +(food.protein_g * factor).toFixed(2);
    const carbsG   = +(food.carbs_g * factor).toFixed(2);
    const fatG     = +(food.fat_g * factor).toFixed(2);

    const [entry] = await db`
      INSERT INTO log_entries
        (daily_log_id, user_id, food_item_id, meal_type, status,
         quantity, serving_unit, calories, protein_g, carbs_g, fat_g, notes)
      VALUES
        (${dailyLog.id}, ${userId}, ${body.food_item_id}, ${body.meal_type}, 'manual',
         ${body.quantity}, ${body.serving_unit}, ${calories},
         ${proteinG}, ${carbsG}, ${fatG}, ${body.notes ?? null})
      RETURNING *
    `;

    await redis.del(`dashboard:today:${userId}`);

    return reply.status(201).send({ entry });
  });

  // ── POST /api/logs/entries/custom — Custom food log ─────────────────────
  app.post('/entries/custom', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const body = customEntrySchema.parse(request.body);
    const logDate = resolveLogDate(request);

    const [food] = await db`
      INSERT INTO food_items (source, name, serving_qty, serving_unit, calories, protein_g, carbs_g, fat_g)
      VALUES ('custom', ${body.name}, 1, 'serving', ${body.calories}, ${body.protein_g}, ${body.carbs_g}, ${body.fat_g})
      RETURNING *
    `;

    const user = await db`SELECT calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM users WHERE id = ${userId}`.then(r => r[0]);
    const dailyLog = await getOrCreateDailyLog(userId, logDate, user);
    const [entry] = await db`
      INSERT INTO log_entries
        (daily_log_id, user_id, food_item_id, meal_type, status, quantity, serving_unit, calories, protein_g, carbs_g, fat_g)
      VALUES
        (${dailyLog.id}, ${userId}, ${food.id}, ${body.meal_type}, 'manual', 1, 'serving',
         ${body.calories}, ${body.protein_g}, ${body.carbs_g}, ${body.fat_g})
      RETURNING *
    `;

    await redis.del(`dashboard:today:${userId}`);

    return reply.status(201).send({ entry });
  });

  // ── GET /api/logs/entries/:id/status — poll fallback ────────────────────
  app.get('/entries/:id/status', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId  = (request.user as any).sub;
    const [entry] = await db`
      SELECT id, status, calories, protein_g, carbs_g, fat_g,
             ai_confidence, ai_identified_items, image_url, meal_type
      FROM log_entries WHERE id = ${id} AND user_id = ${userId} LIMIT 1
    `;
    if (!entry) return reply.status(404).send({ error: 'Entry not found' });
    return reply.send({ entry });
  });

  // ── GET /api/logs/entries — list by date ─────────────────────────────────
  app.get('/entries', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const { date } = request.query as { date?: string };
    const logDate  = resolveLogDate(request, date);

    const entries = await db`
      SELECT le.*, fi.name as food_name, fi.brand as food_brand,
             fi.serving_qty      as food_serving_qty,
             fi.serving_unit     as food_serving_unit,
             fi.serving_weight_g as food_serving_weight_g,
             fi.calories         as food_calories,
             fi.protein_g        as food_protein_g,
             fi.carbs_g          as food_carbs_g,
             fi.fat_g            as food_fat_g,
             fi.fiber_g          as food_fiber_g,
             fi.piece_weight_g   as food_piece_weight_g
      FROM log_entries le
      JOIN daily_logs dl ON dl.id = le.daily_log_id
      LEFT JOIN food_items fi ON fi.id = le.food_item_id
      WHERE le.user_id = ${userId}
        AND dl.log_date = ${logDate}
      ORDER BY le.logged_at ASC
    `;
    return reply.send({ entries, date: logDate });
  });

  // ── PATCH /api/logs/entries/:id — edit / override ───────────────────────
  app.patch('/entries/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId  = (request.user as any).sub;
    const body    = updateEntrySchema.parse(request.body);

    const [entry] = await db`
      UPDATE log_entries SET
        quantity           = COALESCE(${body.quantity ?? null}, quantity),
        serving_unit       = COALESCE(${body.serving_unit ?? null}, serving_unit),
        meal_type          = COALESCE(${body.meal_type ?? null}, meal_type),
        calories           = COALESCE(${body.calories ?? null}, calories),
        protein_g          = COALESCE(${body.protein_g ?? null}, protein_g),
        carbs_g            = COALESCE(${body.carbs_g ?? null}, carbs_g),
        fat_g              = COALESCE(${body.fat_g ?? null}, fat_g),
        notes              = COALESCE(${body.notes ?? null}, notes),
        is_user_overridden = COALESCE(${body.is_user_overridden ?? null}, is_user_overridden),
        status             = CASE WHEN status = 'pending' THEN 'manual' ELSE status END,
        updated_at         = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    if (!entry) return reply.status(404).send({ error: 'Entry not found' });
    await redis.del(`dashboard:today:${userId}`);
    return reply.send({ entry });
  });

  // ── DELETE /api/logs/entries/:id ─────────────────────────────────────────
  app.delete('/entries/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId  = (request.user as any).sub;
    await db`DELETE FROM log_entries WHERE id = ${id} AND user_id = ${userId}`;
    await redis.del(`dashboard:today:${userId}`);
    return reply.status(204).send();
  });
}
