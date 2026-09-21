import data from "../data/foods.json";
import globalData from "../data/foods-global.json";
import indiaData from "../data/foods-india.json";
import aliases from "../data/food-aliases.json";
import type { Food } from "./types";
export interface CatalogFood extends Food {
  portions?: { label: string; grams: number }[];
  aliases?: string[];
  indian?: boolean;
  estimated?: boolean;
  region?: string;
  category?: string;
  recipe?: {
    yield_g: number;
    note: string;
    ingredients: { name: string; grams: number; food_id?: string }[];
  };
}
const additions = aliases as Record<
  string,
  { aliases: string[]; indian: boolean }
>;
export const foods: CatalogFood[] = [...data, ...globalData, ...indiaData].map(
  (f) => ({ ...f, ...additions[f.id] }),
);
export const normalizeFood = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/biriyani/g, "biryani")
    .replace(/panner/g, "paneer")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const indexed = foods.map((f) => ({
  f,
  n: normalizeFood(f.name),
  a: (f.aliases || []).map(normalizeFood),
}));
const byId = new Map(foods.map((f) => [f.id, f]));
export const indianFoodCount = foods.filter((f) => f.indian).length;
export function searchFoods(
  query: string,
  custom: Food[] = [],
  limit = 30,
  scope: "all" | "india" | "saved" = "all",
): CatalogFood[] {
  const q = normalizeFood(query),
    words = q.split(" ").filter(Boolean);
  const candidates = [
    ...custom.map((f) => ({
      f: f as CatalogFood,
      n: normalizeFood(f.name),
      a: [] as string[],
    })),
    ...(scope === "saved"
      ? []
      : indexed.filter((x) => scope !== "india" || x.f.indian)),
  ];
  if (!q) {
    const favorites = [
      "2708347",
      "2708346",
      "2707713",
      "2707427",
      "in-recipe-kanda-poha",
      "2708408",
      "2705740",
      "2705385",
    ];
    if (scope === "saved") return custom.slice(0, limit);
    const seen = new Set<string>(),
      out: CatalogFood[] = [];
    for (const f of [
      ...custom,
      ...favorites.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
      ...candidates.map((x) => x.f),
    ]) {
      if (seen.has(f.id) || (scope === "india" && !(f as CatalogFood).indian))
        continue;
      seen.add(f.id);
      out.push(f);
      if (out.length >= limit) break;
    }
    return out;
  }
  return candidates
    .map((x) => {
      const strings = [x.n, ...x.a];
      const text = strings.join(" ");
      if (!words.every((w) => text.split(" ").some((t) => t.startsWith(w))))
        return null;
      const score = strings.includes(q)
        ? 1000
        : strings.some((n) => n.startsWith(q))
          ? 500
          : 100;
      return {
        f: x.f,
        score:
          score +
          (x.f.indian ? 25 : 0) +
          (x.f.source === "custom" ? 40 : 0) -
          x.n.length / 100,
      };
    })
    .filter((x): x is { f: CatalogFood; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}
export function findFood(
  id: string,
  custom: Food[] = [],
): CatalogFood | undefined {
  return custom.find((f) => f.id === id) ?? byId.get(id);
}
