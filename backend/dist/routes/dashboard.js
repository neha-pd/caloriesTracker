import { db } from '../db/client.js';
import { redis } from '../services/redis.js';
export async function dashboardRoutes(app) {
    // GET /api/dashboard/today
    app.get('/today', { onRequest: [app.authenticate] }, async (request, reply) => {
        const userId = request.user.sub;
        const cacheKey = `dashboard:today:${userId}`;
        const cached = await redis.get(cacheKey);
        if (cached)
            return reply.send(JSON.parse(cached));
        const today = new Date().toISOString().split('T')[0];
        const [user] = await db `
      SELECT calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM users WHERE id = ${userId}
    `;
        const [log] = await db `
      SELECT * FROM daily_logs WHERE user_id = ${userId} AND log_date = ${today} LIMIT 1
    `;
        const mealBreakdown = await db `
      SELECT
        le.meal_type,
        COALESCE(SUM(le.calories), 0)  AS calories,
        COALESCE(SUM(le.protein_g), 0) AS protein_g,
        COALESCE(SUM(le.carbs_g), 0)   AS carbs_g,
        COALESCE(SUM(le.fat_g), 0)     AS fat_g,
        COUNT(*)                     AS entry_count,
        ARRAY_AGG(COALESCE(fi.name, 'AI scan') ORDER BY le.logged_at)
          FILTER (WHERE le.food_item_id IS NOT NULL OR le.image_url IS NOT NULL) AS item_names
      FROM log_entries le
      LEFT JOIN food_items fi ON fi.id = le.food_item_id
      WHERE le.user_id = ${userId}
        AND DATE(logged_at AT TIME ZONE 'UTC') = ${today}
        AND status IN ('complete', 'manual')
      GROUP BY meal_type
    `;
        const consumed = {
            calories: Number(log?.total_calories ?? 0),
            protein_g: Number(log?.total_protein_g ?? 0),
            carbs_g: Number(log?.total_carbs_g ?? 0),
            fat_g: Number(log?.total_fat_g ?? 0),
        };
        const goals = {
            calories: user.calorie_goal,
            protein_g: user.protein_goal_g ?? 150,
            carbs_g: user.carbs_goal_g ?? 200,
            fat_g: user.fat_goal_g ?? 65,
        };
        const remaining = {
            calories: Math.max(0, goals.calories - consumed.calories),
            protein_g: Math.max(0, goals.protein_g - consumed.protein_g),
            carbs_g: Math.max(0, goals.carbs_g - consumed.carbs_g),
            fat_g: Math.max(0, goals.fat_g - consumed.fat_g),
        };
        const percentage = {
            calories: Math.min(100, Math.round((consumed.calories / goals.calories) * 100)),
            protein_g: Math.min(100, Math.round((consumed.protein_g / goals.protein_g) * 100)),
            carbs_g: Math.min(100, Math.round((consumed.carbs_g / goals.carbs_g) * 100)),
            fat_g: Math.min(100, Math.round((consumed.fat_g / goals.fat_g) * 100)),
        };
        // Streak calculation
        const streakResult = await db `
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
        const meals = {
            breakfast: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, entry_count: 0, item_names: [] },
            lunch: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, entry_count: 0, item_names: [] },
            dinner: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, entry_count: 0, item_names: [] },
            snack: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, entry_count: 0, item_names: [] },
        };
        for (const row of mealBreakdown) {
            meals[row.meal_type] = {
                calories: Number(row.calories),
                protein_g: Number(row.protein_g),
                carbs_g: Number(row.carbs_g),
                fat_g: Number(row.fat_g),
                entry_count: Number(row.entry_count),
                item_names: row.item_names ?? [],
            };
        }
        const response = {
            date: today,
            goals,
            consumed,
            remaining,
            percentage,
            meals,
            streak_days: Number(streakResult[0]?.streak_days ?? 0) + (log ? 1 : 0),
            water_ml: log?.water_ml ?? 0,
        };
        await redis.setex(cacheKey, 60, JSON.stringify(response)); // Cache 60s
        return reply.send(response);
    });
    // GET /api/dashboard/history?from=2025-04-01&to=2025-04-13
    app.get('/history', { onRequest: [app.authenticate] }, async (request, reply) => {
        const userId = request.user.sub;
        const { from, to } = request.query;
        const fromDate = from ?? new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const toDate = to ?? new Date().toISOString().split('T')[0];
        const logs = await db `
      SELECT log_date, total_calories, total_protein_g, total_carbs_g, total_fat_g,
             calorie_goal, water_ml
      FROM daily_logs
      WHERE user_id = ${userId}
        AND log_date BETWEEN ${fromDate}::date AND ${toDate}::date
      ORDER BY log_date ASC
    `;
        return reply.send({ logs, from: fromDate, to: toDate });
    });
    // PATCH /api/dashboard/water — update water intake
    app.patch('/water', { onRequest: [app.authenticate] }, async (request, reply) => {
        const userId = request.user.sub;
        const { water_ml } = request.body;
        const today = new Date().toISOString().split('T')[0];
        // Fetch user goals so we can create a daily_log row if none exists yet
        const [user] = await db `
      SELECT calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM users WHERE id = ${userId}
    `;
        // UPSERT: create today's log if missing, then set water_ml
        const [log] = await db `
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
//# sourceMappingURL=dashboard.js.map