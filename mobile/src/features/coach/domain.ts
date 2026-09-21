import type { Entry, Water } from "../types";
export interface DayInput {
  date: string;
  entries: Entry[];
  water: Water[];
  goals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    water: number;
  };
  complete: boolean;
}
export const tips = {
  log: {
    title: "Fill in the little gaps",
    body: "If you ate something that is missing, add it to your diary. An unlogged meal does not mean a skipped meal.",
    reminder: "Make a little note of your meals.",
    hour: 19,
  },
  water: {
    title: "Make room for a water break",
    body: "Your water log is below your chosen target. Check whether any sips are missing, and plan a gentle reminder that fits your routine.",
    reminder: "Pause for a sip, and log it if you like.",
    hour: 15,
  },
  portions: {
    title: "Give your portions a quick review",
    body: "Check serving sizes and preparation against what you actually ate. Small logging details make your daily view more useful.",
    reminder: "Take a moment to review today’s food portions.",
    hour: 20,
  },
  rhythm: {
    title: "Keep a rhythm that works for you",
    body: "Pick a convenient moment to log, rather than trying to remember the whole day later.",
    reminder: "A little check-in for your food diary.",
    hour: 13,
  },
  reflect: {
    title: "Notice one thing that worked",
    body: "Write down a habit that felt easy today, and choose one small thing to repeat tomorrow.",
    reminder: "What felt good today? Take a moment to reflect.",
    hour: 20,
  },
  targets: {
    title: "Treat targets as a guide",
    body: "A day above or below a target is information, not a score. Review your logging and your chosen targets without trying to compensate tomorrow.",
    reminder: "Review your day with curiosity, not judgment.",
    hour: 20,
  },
} as const;
export type TipId = keyof typeof tips;
export function dayContext(input: DayInput) {
  const entries = input.entries.filter(
      (e) => e.log_date === input.date && !e.deleted_at,
    ),
    water = input.water
      .filter((w) => w.log_date === input.date && !w.deleted_at)
      .reduce((n, w) => n + w.amount_ml, 0);
  const totals = entries.reduce(
    (t, e) => ({
      calories: t.calories + e.calories,
      protein: t.protein + e.protein_g,
      carbs: t.carbs + e.carbs_g,
      fat: t.fat + e.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const candidates: TipId[] = [];
  if (!input.complete || !entries.length) candidates.push("log");
  if (water < input.goals.water) candidates.push("water");
  if (entries.length) candidates.push("portions", "rhythm");
  if (
    input.complete &&
    entries.length &&
    Math.abs(totals.calories - input.goals.calories) >
      input.goals.calories * 0.15
  )
    candidates.push("targets");
  candidates.push("reflect");
  return {
    date: input.date,
    loggingComplete: input.complete,
    foodEntries: entries.length,
    mealCategories: [...new Set(entries.map((e) => e.meal_type))],
    waterMl: water,
    totals,
    chosenTargets: input.goals,
    allowedTips: candidates,
  };
}
export type DayContext = ReturnType<typeof dayContext>;
export function coachPrompt(context: DayContext) {
  return `You are a supportive habit coach. Only consider the provided logged data. Missing logs are not missing intake. Chosen targets are user settings, not medical prescriptions. Do not infer a diagnosis, recommend restriction, change targets, or prescribe food/exercise. Choose up to 3 useful tips from allowedTips in priority order. Return only JSON: {"tip_ids":["log","water","reflect"]}. Never invent IDs or include other fields. Data: ${JSON.stringify(context)}`;
}
export function parseTipIds(text: string, allowed: TipId[]): TipId[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match)
    throw new Error("The coach could not prepare a clear response. Try again.");
  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error("The coach returned an incomplete response. Try again.");
  }
  if (!Array.isArray(parsed.tip_ids))
    throw new Error("The coach response was not usable.");
  const ids = [...new Set(parsed.tip_ids)]
    .filter(
      (id): id is TipId =>
        typeof id === "string" && allowed.includes(id as TipId),
    )
    .slice(0, 3);
  if (!ids.length)
    throw new Error("No grounded suggestions were returned. Try again.");
  return ids;
}
