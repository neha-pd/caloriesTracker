import type { User } from "../../store/authStore";
import type { Entry, Food, Water, Progress, Meal } from "../types";
import { localDateKey } from "../../lib/dates";
export const DEMO_ID = "fitlens-offline-demo";
export function demoUser(): User {
  return {
    id: DEMO_ID,
    email: "demo@fitlens.local",
    display_name: "Neha Demo",
    calorie_goal: 2100,
    protein_goal_g: 110,
    carbs_goal_g: 260,
    fat_goal_g: 70,
    goal_type: "maintain",
    age: 27,
    gender: "prefer_not_to_say",
    height_cm: 168,
    weight_kg: 68,
    weight_goal_kg: 65,
    activity_level: "moderately_active",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    onboarding_complete: true,
    settings: {
      water_goal_ml: 2250,
      meal_reminders: false,
      water_reminders: false,
      quest_reminders: false,
      haptics: true,
    },
  };
}
// Deliberately labelled sample recipes, not nutrition recommendations or USDA records.
export const demoFoods: Food[] = [
  ["Overnight oats with banana", 390, 16, 62, 10],
  ["Eggs on wholegrain toast", 360, 22, 31, 17],
  ["Greek yogurt and berries", 210, 19, 24, 5],
  ["Vegetable poha", 330, 8, 57, 9],
  ["Rice, dal and cucumber salad", 590, 24, 94, 14],
  ["Grilled chicken rice bowl", 610, 43, 72, 17],
  ["Paneer and vegetable wrap", 520, 25, 58, 22],
  ["Chickpea quinoa salad", 480, 20, 65, 16],
  ["Salmon, potatoes and greens", 580, 38, 49, 25],
  ["Tofu stir-fry with noodles", 540, 28, 71, 17],
  ["Roti, dal and mixed vegetables", 560, 23, 88, 14],
  ["Lentil soup with sourdough", 430, 21, 68, 9],
  ["Apple and peanut butter", 210, 5, 27, 11],
  ["Trail mix", 180, 5, 16, 12],
  ["Banana", 105, 1, 27, 0],
  ["Cottage cheese and fruit", 190, 20, 19, 4],
  ["Coffee with milk", 60, 3, 6, 3],
  ["Homemade mango smoothie", 230, 12, 38, 4],
].map((a, i) => ({
  id: `demo-food-${i}`,
  name: String(a[0]),
  serving_qty: 1,
  serving_unit: "sample serving",
  calories: Number(a[1]),
  protein_g: Number(a[2]),
  carbs_g: Number(a[3]),
  fat_g: Number(a[4]),
  source: "custom",
}));
export function buildDemoData(now = new Date()) {
  const entries: Entry[] = [],
    water: Water[] = [];
  const dates: string[] = [];
  let xp = 0;
  for (let offset = 44; offset >= 0; offset--) {
    if (offset === 17 || offset === 31) continue;
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    const date = localDateKey(day);
    dates.unshift(date);
    const plan: { meal: Meal; index: number; hour: number }[] = [
      { meal: "breakfast", index: offset % 4, hour: 8 },
      { meal: "breakfast", index: 16, hour: 8 },
      { meal: "lunch", index: 4 + (offset % 4), hour: 13 },
      { meal: "snack", index: 12 + (offset % 4), hour: 16 },
      ...(offset === 0
        ? []
        : [
            { meal: "dinner" as Meal, index: 8 + (offset % 4), hour: 20 },
            { meal: "snack" as Meal, index: offset % 2 ? 17 : 15, hour: 18 },
          ]),
    ];
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i],
        f = demoFoods[p.index],
        quantity = offset % 6 === 0 ? 1.15 : 1;
      const time = new Date(day);
      time.setHours(p.hour, i * 3, 0, 0);
      const ts = time.toISOString();
      entries.push({
        id: `demo-entry-${date}-${i}`,
        log_date: date,
        name: f.name,
        food_id: f.id,
        meal_type: p.meal,
        quantity,
        serving_unit: "sample serving",
        base_nutrition: {
          calories: f.calories,
          protein_g: f.protein_g,
          carbs_g: f.carbs_g,
          fat_g: f.fat_g,
        },
        calories: f.calories * quantity,
        protein_g: f.protein_g * quantity,
        carbs_g: f.carbs_g * quantity,
        fat_g: f.fat_g * quantity,
        source: "manual",
        version: 1,
        created_at: ts,
        updated_at: ts,
      });
    }
    for (let i = 0; i < (offset === 0 ? 4 : 6 + (offset % 4)); i++) {
      const time = new Date(day);
      time.setHours(8 + i, 15, 0, 0);
      water.push({
        id: `demo-water-${date}-${i}`,
        log_date: date,
        amount_ml: i % 3 === 0 ? 350 : 250,
        created_at: time.toISOString(),
        updated_at: time.toISOString(),
      });
    }
    xp += 25 * new Set(plan.map((p) => p.meal)).size + 25;
  }
  const progress: Progress = {
    xp,
    level: Math.floor(xp / 250) + 1,
    progress: xp % 250,
    next: 250,
    streak: 17,
    dates,
    badges: [
      {
        id: "first-spark",
        name: "First spark",
        description: "Your first little win",
        unlocked: true,
      },
      {
        id: "meal-explorer",
        name: "Meal explorer",
        description: "Remember 10 meals",
        unlocked: true,
      },
      {
        id: "seven-days",
        name: "Seven little days",
        description: "Earn a little win on 7 days",
        unlocked: true,
      },
      {
        id: "momentum",
        name: "Momentum",
        description: "Reach level 5",
        unlocked: true,
      },
      {
        id: "mindful-month",
        name: "A mindful month",
        description: "Earn a little win on 30 days",
        unlocked: true,
      },
      {
        id: "good-company",
        name: "Good company",
        description: "Remember 60 meals",
        unlocked: true,
      },
    ],
  };
  return { entries, water, foods: demoFoods, queue: [], progress };
}
