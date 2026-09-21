export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export interface Nutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
}
export interface Food extends Nutrition {
  id: string;
  name: string;
  serving_qty: number;
  serving_unit: string;
  source?: string;
}
export interface Entry extends Nutrition {
  id: string;
  log_date: string;
  name: string;
  food_id?: string | null;
  meal_type: Meal;
  quantity: number;
  serving_unit: string;
  base_nutrition: Nutrition;
  source: "catalog" | "manual" | "on_device";
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}
export interface Water {
  id: string;
  log_date: string;
  amount_ml: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}
export interface Progress {
  today_events?: { date: string; keys: string[] };
  xp: number;
  level: number;
  progress: number;
  next: number;
  streak: number;
  dates: string[];
  badges: {
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
  }[];
}
