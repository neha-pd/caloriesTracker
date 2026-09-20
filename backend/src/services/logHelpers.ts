import db from '../db/client.js';

const GRAMS_PER_OZ = 28.3495;

/**
 * Multiplier from a food item's per-serving nutrition to a logged portion.
 * Must match the app's portion picker (EditPortionSheet `buildMeasures`):
 *   'serving'          → quantity × one whole serving
 *   'grams' / 'g'      → by weight, when the serving weight is known
 *   'piece'            → by weight, when piece and serving weights are known
 *   'oz'               → by weight, when the serving weight is known
 *   the food's own unit (e.g. 'cup') → quantity ÷ serving_qty
 */
export function servingFactor(
  food: {
    serving_qty?: number | string;
    serving_weight_g?: number | string | null;
    piece_weight_g?: number | string | null;
  },
  quantity: number,
  servingUnit: string
): number {
  const weightG = food.serving_weight_g != null ? Number(food.serving_weight_g) : null;
  if ((servingUnit === 'grams' || servingUnit === 'g') && weightG) return quantity / weightG;
  const pieceG = food.piece_weight_g != null ? Number(food.piece_weight_g) : null;
  if (servingUnit === 'piece' && pieceG && weightG) return (quantity * pieceG) / weightG;
  if (servingUnit === 'oz' && weightG) return (quantity * GRAMS_PER_OZ) / weightG;
  if (servingUnit === 'serving') return quantity;
  return quantity / Number(food.serving_qty);
}

export async function getOrCreateDailyLog(
  userId: string,
  logDate: string,
  userGoals: {
    calorie_goal: number;
    protein_goal_g?: number;
    carbs_goal_g?: number;
    fat_goal_g?: number;
  }
) {
  const [existing] = await db`
    SELECT * FROM daily_logs WHERE user_id = ${userId} AND log_date = ${logDate} LIMIT 1
  `;
  if (existing) return existing;

  const [created] = await db`
    INSERT INTO daily_logs (user_id, log_date, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g)
    VALUES (${userId}, ${logDate}, ${userGoals.calorie_goal}, ${userGoals.protein_goal_g ?? null},
            ${userGoals.carbs_goal_g ?? null}, ${userGoals.fat_goal_g ?? null})
    ON CONFLICT (user_id, log_date) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;
  return created;
}
