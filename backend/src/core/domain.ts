import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const opaqueToken = () => randomBytes(32).toString("base64url");
export const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const password = z.string().min(8).max(128);
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Invalid date",
  );
export const nutrition = z.object({
  calories: z.number().min(0).max(20000),
  protein_g: z.number().min(0).max(2000),
  carbs_g: z.number().min(0).max(5000),
  fat_g: z.number().min(0).max(2000),
  fiber_g: z.number().min(0).max(1000).nullable().optional(),
});
export const entrySchema = nutrition.extend({
  id: z.string().uuid(),
  log_date: day,
  name: z.string().trim().min(1).max(200),
  food_id: z.string().max(100).nullable().optional(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  quantity: z.number().positive().max(10000),
  serving_unit: z.string().trim().min(1).max(50),
  base_nutrition: nutrition,
  source: z.enum(["catalog", "manual", "on_device"]).default("manual"),
});
export const settingsSchema = z
  .object({
    step_goal: z.number().int().min(500).max(60000).nullable().optional(),
    move_goal_kcal: z.number().int().min(50).max(3000).nullable().optional(),
    exercise_goal_minutes: z
      .number()
      .int()
      .min(5)
      .max(300)
      .nullable()
      .optional(),
    water_goal_ml: z.number().int().min(250).max(10000).optional(),
    meal_reminders: z.boolean().optional(),
    water_reminders: z.boolean().optional(),
    quest_reminders: z.boolean().optional(),
    haptics: z.boolean().optional(),
  })
  .strict();
export function localDay(timezone = "UTC", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((t) => parts.find((p) => p.type === t)!.value)
    .join("-");
}
export function safeUser(user: Record<string, any>) {
  const { password_hash, google_id, firebase_uid, ...safe } = user;
  for (const key of [
    "height_cm",
    "weight_kg",
    "weight_goal_kg",
    "calorie_goal",
    "protein_goal_g",
    "carbs_goal_g",
    "fat_goal_g",
  ])
    if (safe[key] != null) safe[key] = Number(safe[key]);
  return safe;
}
export function normalizeEntry(entry: Record<string, any>) {
  const out = { ...entry };
  for (const key of [
    "quantity",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
  ])
    if (out[key] != null) out[key] = Number(out[key]);
  return out;
}
export function streakDays(dates: string[], today: string) {
  const set = new Set(dates);
  let cursor = new Date(today + "T12:00:00Z"),
    n = 0;
  if (!set.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (set.has(cursor.toISOString().slice(0, 10))) {
    n++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return n;
}
export const levelForXp = (xp: number) => ({
  level: Math.floor(xp / 250) + 1,
  progress: xp % 250,
  next: 250,
});
