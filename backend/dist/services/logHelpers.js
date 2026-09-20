import db from '../db/client.js';
export async function getOrCreateDailyLog(userId, logDate, userGoals) {
    const [existing] = await db `
    SELECT * FROM daily_logs WHERE user_id = ${userId} AND log_date = ${logDate} LIMIT 1
  `;
    if (existing)
        return existing;
    const [created] = await db `
    INSERT INTO daily_logs (user_id, log_date, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g)
    VALUES (${userId}, ${logDate}, ${userGoals.calorie_goal}, ${userGoals.protein_goal_g ?? null},
            ${userGoals.carbs_goal_g ?? null}, ${userGoals.fat_goal_g ?? null})
    ON CONFLICT (user_id, log_date) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;
    return created;
}
//# sourceMappingURL=logHelpers.js.map