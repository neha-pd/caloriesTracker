import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { redis } from '../services/redis.js';
import { addDays, isDateKey, resolveLogDate } from '../services/dates.js';
import { servingFactor } from '../services/logHelpers.js';

/**
 * Micronutrients the data model actually stores (food_items columns, per
 * serving). Add a row here when a new column is populated — the dashboard
 * and app pick it up without other changes. Never estimate missing values.
 */
const MICRONUTRIENTS = [
  { key: 'sodium_mg', column: 'sodium_mg', label: 'Sodium', unit: 'mg' },
] as const;

const MAX_WATER_ML = 32767; // SMALLINT upper bound
const waterSchema = z.object({ water_ml: z.number().int().min(0).max(MAX_WATER_ML) });

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard/today
  app.get('/today', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId  = (request.user as any).sub;
    const cacheKey = `dashboard:today:${userId}`;
    const today = resolveLogDate(request);

    // The cache key is per user, so a cached payload for a different calendar
    // day (local midnight passed, or a client in another timezone) is stale.
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.date === today) return reply.send(parsed);
    }

    const [user] = await db`
      SELECT calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM users WHERE id = ${userId}
    `;

    const [log] = await db`
      SELECT * FROM daily_logs WHERE user_id = ${userId} AND log_date = ${today} LIMIT 1
    `;

    // Same rows the daily_logs totals trigger sums (this day's log, complete or
    // manual), so per-meal and per-food figures always add up to `consumed`.
    const entryRows = log ? await db`
      SELECT
        le.id, le.meal_type, le.status, le.quantity, le.serving_unit, le.image_url,
        le.calories, le.protein_g, le.carbs_g, le.fat_g,
        fi.name AS food_name, fi.serving_qty AS food_serving_qty,
        fi.serving_weight_g AS food_serving_weight_g, fi.piece_weight_g AS food_piece_weight_g,
        ${db.unsafe(MICRONUTRIENTS.map((m) => `fi.${m.column} AS food_${m.column}`).join(', '))}
      FROM log_entries le
      LEFT JOIN food_items fi ON fi.id = le.food_item_id
      WHERE le.daily_log_id = ${log.id}
        AND le.status IN ('complete', 'manual')
      ORDER BY le.logged_at ASC
    ` : [];

    const consumed = {
      calories:  Number(log?.total_calories  ?? 0),
      protein_g: Number(log?.total_protein_g ?? 0),
      carbs_g:   Number(log?.total_carbs_g   ?? 0),
      fat_g:     Number(log?.total_fat_g     ?? 0),
    };

    const goals = {
      calories:  user.calorie_goal,
      protein_g: user.protein_goal_g ?? 150,
      carbs_g:   user.carbs_goal_g   ?? 200,
      fat_g:     user.fat_goal_g     ?? 65,
    };

    const remaining = {
      calories:  Math.max(0, goals.calories  - consumed.calories),
      protein_g: Math.max(0, goals.protein_g - consumed.protein_g),
      carbs_g:   Math.max(0, goals.carbs_g   - consumed.carbs_g),
      fat_g:     Math.max(0, goals.fat_g     - consumed.fat_g),
    };

    const percentage = {
      calories:  Math.min(100, Math.round((consumed.calories  / goals.calories)  * 100)),
      protein_g: Math.min(100, Math.round((consumed.protein_g / goals.protein_g) * 100)),
      carbs_g:   Math.min(100, Math.round((consumed.carbs_g   / goals.carbs_g)   * 100)),
      fat_g:     Math.min(100, Math.round((consumed.fat_g     / goals.fat_g)     * 100)),
    };

    // Streak calculation
    const streakResult = await db`
      WITH RECURSIVE streak AS (
        SELECT log_date, 1 AS days
        FROM daily_logs
        WHERE user_id = ${userId} AND log_date = ${today}::date - 1
        UNION ALL
        SELECT dl.log_date, s.days + 1
        FROM daily_logs dl JOIN streak s ON dl.log_date = s.log_date - 1
        WHERE dl.user_id = ${userId}
      )
      SELECT COALESCE(MAX(days), 0) AS streak_days FROM streak
    `;

    const nullableNum = (v: unknown) => (v == null ? null : Number(v));
    const emptyMeal = () => ({
      calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
      entry_count: 0, item_names: [] as string[], entries: [] as any[],
    });
    const meals: Record<string, ReturnType<typeof emptyMeal>> = {
      breakfast: emptyMeal(),
      lunch:     emptyMeal(),
      dinner:    emptyMeal(),
      snack:     emptyMeal(),
    };

    const micronutrients = Object.fromEntries(
      MICRONUTRIENTS.map((m) => [m.key, { label: m.label, unit: m.unit, total: 0, entries_with_data: 0 }])
    );

    for (const row of entryRows) {
      const meal = meals[row.meal_type];
      const name = row.food_name ?? (row.image_url ? 'AI scan' : 'Food item');
      const entry = {
        id:           row.id,
        name,
        quantity:     Number(row.quantity),
        serving_unit: row.serving_unit,
        calories:     nullableNum(row.calories),
        protein_g:    nullableNum(row.protein_g),
        carbs_g:      nullableNum(row.carbs_g),
        fat_g:        nullableNum(row.fat_g),
      };
      meal.entries.push(entry);
      meal.entry_count += 1;
      meal.calories  += entry.calories  ?? 0;
      meal.protein_g += entry.protein_g ?? 0;
      meal.carbs_g   += entry.carbs_g   ?? 0;
      meal.fat_g     += entry.fat_g     ?? 0;
      if (row.food_name || row.image_url) meal.item_names.push(name);

      // Micronutrients exist only on linked food items (per serving); scale to
      // the logged portion. Entries without data are counted, never estimated.
      if (row.food_serving_qty != null) {
        const factor = servingFactor(
          {
            serving_qty: row.food_serving_qty,
            serving_weight_g: row.food_serving_weight_g,
            piece_weight_g: row.food_piece_weight_g,
          },
          Number(row.quantity),
          row.serving_unit
        );
        for (const m of MICRONUTRIENTS) {
          const perServing = row[`food_${m.column}`];
          if (perServing == null || !Number.isFinite(factor)) continue;
          micronutrients[m.key].total += Number(perServing) * factor;
          micronutrients[m.key].entries_with_data += 1;
        }
      }
    }

    const round2 = (n: number) => +n.toFixed(2);
    for (const meal of Object.values(meals)) {
      meal.calories  = round2(meal.calories);
      meal.protein_g = round2(meal.protein_g);
      meal.carbs_g   = round2(meal.carbs_g);
      meal.fat_g     = round2(meal.fat_g);
    }
    for (const m of Object.values(micronutrients)) m.total = round2(m.total);

    const response = {
      date: today,
      goals,
      consumed,
      remaining,
      percentage,
      meals,
      micronutrients,
      entry_count: entryRows.length,
      streak_days: Number(streakResult[0]?.streak_days ?? 0) + (log ? 1 : 0),
      water_ml: log?.water_ml ?? 0,
    };

    await redis.setex(cacheKey, 60, JSON.stringify(response)); // Cache 60s
    return reply.send(response);
  });

  // GET /api/dashboard/history?from=2025-04-01&to=2025-04-13
  // One row per calendar day — guaranteed by UNIQUE (user_id, log_date).
  app.get('/history', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const { from, to } = request.query as { from?: string; to?: string };
    const toDate   = isDateKey(to) ? to : resolveLogDate(request);
    const fromDate = isDateKey(from) ? from : addDays(toDate, -6); // last 7 days incl. today

    const logs = await db`
      SELECT log_date, total_calories, total_protein_g, total_carbs_g, total_fat_g,
             calorie_goal, water_ml, updated_at
      FROM daily_logs
      WHERE user_id = ${userId}
        AND log_date BETWEEN ${fromDate}::date AND ${toDate}::date
      ORDER BY log_date ASC
    `;
    return reply.send({ logs, from: fromDate, to: toDate });
  });

  // PATCH /api/dashboard/water — update water intake
  app.patch('/water', { onRequest: [app.authenticate] }, async (request, reply) => {
    const userId   = (request.user as any).sub;
    // water_ml is a SMALLINT column; out-of-range totals would fail the insert.
    const parsed = waterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: `water_ml must be a whole number from 0 to ${MAX_WATER_ML}` });
    }
    const { water_ml } = parsed.data;
    const today    = resolveLogDate(request);

    // Fetch user goals so we can create a daily_log row if none exists yet
    const [user] = await db`
      SELECT calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM users WHERE id = ${userId}
    `;

    // UPSERT: create today's log if missing, then set water_ml
    const [log] = await db`
      INSERT INTO daily_logs (user_id, log_date, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, water_ml)
      VALUES (
        ${userId}, ${today},
        ${user.calorie_goal}, ${user.protein_goal_g ?? null},
        ${user.carbs_goal_g ?? null}, ${user.fat_goal_g ?? null},
        ${water_ml}
      )
      ON CONFLICT (user_id, log_date) DO UPDATE
        SET water_ml   = ${water_ml},
            updated_at = NOW()
      RETURNING water_ml
    `;

    await redis.del(`dashboard:today:${userId}`);
    return reply.send({ water_ml: log?.water_ml ?? water_ml });
  });
}
