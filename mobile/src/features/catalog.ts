import data from "../data/foods.json";
import type { Food } from "./types";
export const foods = data as (Food & {
  portions: { label: string; grams: number }[];
})[];
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function searchFoods(
  query: string,
  custom: Food[] = [],
  limit = 30,
): Food[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length)
    return [
      ...custom,
      ...[
        "Banana, raw",
        "Egg, whole, boiled or poached",
        "Rice, white, cooked",
        "Chicken breast, baked or broiled",
      ].flatMap((q) => foods.filter((f) => f.name.startsWith(q)).slice(0, 2)),
      ...foods
        .filter((f) => /Apple, raw|Yogurt, Greek|Oatmeal, cooked/.test(f.name))
        .slice(0, 8),
    ].slice(0, limit);
  return [...custom, ...foods]
    .map((f) => ({ f, n: normalize(f.name) }))
    .filter(({ n }) => words.every((w) => n.includes(w)))
    .sort(
      (a, b) =>
        (b.n.startsWith(words[0]) ? 100 : 0) -
        (a.n.startsWith(words[0]) ? 100 : 0) +
        a.n.length -
        b.n.length,
    )
    .slice(0, limit)
    .map((x) => x.f);
}
export function findFood(id: string, custom: Food[] = []) {
  return custom.find((f) => f.id === id) ?? foods.find((f) => f.id === id);
}
