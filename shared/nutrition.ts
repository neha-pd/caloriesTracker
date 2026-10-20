import { z } from "zod";
export const calculatedGoalsSchema = z
  .object({
    goal_type: z.enum(["maintain", "gain_muscle", "lose_weight"]),
    age: z.number().int().min(18).max(120),
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
    height_cm: z.number().min(80).max(250),
    weight_kg: z.number().min(25).max(400),
    weight_goal_kg: z.number().min(25).max(400),
    activity_level: z.enum([
      "sedentary",
      "lightly_active",
      "moderately_active",
      "very_active",
      "extra_active",
    ]),
  })
  .strict();
export const manualGoalsSchema = z
  .object({
    goal_type: z.enum(["maintain", "gain_muscle", "lose_weight"]),
    calorie_goal: z.number().int().min(1200).max(6000),
    protein_goal_g: z.number().int().min(0).max(500),
    carbs_goal_g: z.number().int().min(0).max(1000),
    fat_goal_g: z.number().int().min(0).max(500),
  })
  .strict();

export const goalsSchema = z.union([calculatedGoalsSchema, manualGoalsSchema]);
export function calculateGoals(b: z.infer<typeof goalsSchema>) {
  const calculated = "age" in b;
  const manual = b as z.infer<typeof manualGoalsSchema>;
  return calculated
    ? (() => {
        const bmr =
          10 * b.weight_kg +
          6.25 * b.height_cm -
          5 * b.age +
          (b.gender === "female" ? -161 : b.gender === "male" ? 5 : -78);
        const activityMultipliers = {
          sedentary: 1.2,
          lightly_active: 1.375,
          moderately_active: 1.55,
          very_active: 1.725,
          extra_active: 1.9,
        };
        const tdee = Math.max(
          1200,
          Math.min(
            6000,
            Math.round(bmr * activityMultipliers[b.activity_level]),
          ),
        );
        const calorie_goal =
          b.goal_type === "gain_muscle" ||
          (b.goal_type === "lose_weight" && b.weight_goal_kg > b.weight_kg)
            ? Math.min(6000, Math.round(tdee * 1.1))
            : b.goal_type === "lose_weight" && b.weight_goal_kg < b.weight_kg
              ? Math.max(1200, Math.round(tdee * 0.85))
              : tdee;
        return {
          maintenance_calories: tdee,
          calorie_goal,
          protein_goal_g: Math.round((calorie_goal * 0.25) / 4),
          carbs_goal_g: Math.round((calorie_goal * 0.45) / 4),
          fat_goal_g: Math.round((calorie_goal * 0.3) / 9),
        };
      })()
    : {
        maintenance_calories: null,
        calorie_goal: manual.calorie_goal,
        protein_goal_g: manual.protein_goal_g,
        carbs_goal_g: manual.carbs_goal_g,
        fat_goal_g: manual.fat_goal_g,
      };
}
