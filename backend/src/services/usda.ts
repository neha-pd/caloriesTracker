import { redis } from './redis.js';

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY  = process.env.USDA_API_KEY!;

// USDA nutrient IDs we care about
const NUTRIENT_IDS = {
  calories:  1008,
  protein:   1003,
  carbs:     1005,
  fat:       1004,
  fiber:     1079,
  sugar:     2000,
  sodium:    1093,
};

export interface FoodItem {
  external_id:      string;
  name:             string;
  brand?:           string;
  serving_qty:      number;
  serving_unit:     string;
  serving_weight_g?: number;
  calories:         number;
  protein_g:        number;
  carbs_g:          number;
  fat_g:            number;
  fiber_g?:         number;
  sugar_g?:         number;
  sodium_mg?:       number;
  piece_weight_g?:  number;
}

export interface NutritionResult {
  name:      string;
  quantity:  number;
  unit:      string;
  calories:  number;
  protein_g: number;
  carbs_g:   number;
  fat_g:     number;
  fiber_g:   number;
  sugar_g:   number;
  sodium_mg: number;
}

/**
 * A food's serving, in the units FitLens stores. USDA nutrient values are per
 * 100 g (or 100 ml). Generic foods (SR Legacy / FNDDS / Foundation) have no
 * servingSize, so their serving is exactly 100 g; branded foods state one.
 * The serving quantity is expressed IN the serving unit — "100 g", never
 * "1 g" weighing 100 g, which made 1 g read as the whole serving's calories.
 */
function usdaServing(item: any) {
  const rawUnit = String(item.servingSizeUnit ?? 'g').toLowerCase();
  const unit = ['g', 'grm', 'gram', 'grams'].includes(rawUnit) ? 'g'
    : ['ml', 'mlt'].includes(rawUnit) ? 'ml'
    : rawUnit;
  const qty = Number(item.servingSize) > 0 ? Number(item.servingSize) : 100;
  return {
    serving_qty:      qty,
    serving_unit:     unit,
    serving_weight_g: unit === 'g' ? qty : undefined,
    factor:           qty / 100, // per-100 values → per serving
  };
}

// Portions that are volumes/weights, reference amounts or unspecified — not a piece.
const NON_PIECE = /\b(cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|fl|lbs?|pounds?|g|grams?|ml|liters?|litres?|pints?|quarts?|gallons?|serving|nlea|racc)\b|not specified|guideline/i;
// Fragments that are technically "1 …" but too small to mean a piece of the food.
const FRAGMENT = /\b(slice|bite|miniature|mini|strip|chip|crumb|sprig)\b/i;
const TYPICAL = /\b(medium|item|any size|ns as to size|piece|whole)\b/i;

/**
 * Weight of one natural piece ("1 egg" 50 g, "1 medium" 130 g), picked from
 * USDA portion data in either shape: search `foodMeasures` (disseminationText)
 * or detail `foodPortions` (portionDescription, or amount + unit + modifier).
 * Prefers typical/whole portions over fragments like "1 slice". Undefined when
 * USDA lists no countable portion — a piece weight is never guessed.
 */
export function usdaPieceWeight(item: any): number | undefined {
  const portions: Array<{ text: string; grams: number }> = [
    ...(item.foodMeasures ?? []).map((m: any) => ({
      text: String(m.disseminationText ?? ''),
      grams: Number(m.gramWeight),
    })),
    ...(item.foodPortions ?? []).map((p: any) => {
      const unit = p.measureUnit?.name && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '';
      const modifier = /^\d+$/.test(String(p.modifier ?? '')) ? '' : (p.modifier ?? '');
      return {
        text: String(p.portionDescription ?? `${p.amount ?? ''} ${unit} ${modifier}`),
        grams: Number(p.gramWeight),
      };
    }),
  ];

  const candidates = portions
    .map((p) => ({ ...p, text: p.text.replace(/\s+/g, ' ').trim() }))
    .filter((p) => /^1(\.0)? \S/.test(p.text) && !NON_PIECE.test(p.text) && p.grams > 0);
  // Fragments rank last even when "medium" ("1 medium slice" isn't a breast).
  const rank = (t: string) => (FRAGMENT.test(t) ? 2 : TYPICAL.test(t) ? 0 : 1);
  candidates.sort((a, b) => rank(a.text) - rank(b.text));
  return candidates[0]?.grams;
}

// Pull a specific nutrient value from the USDA nutrients array
function getNutrient(nutrients: any[], id: number): number {
  return nutrients.find((n: any) => n.nutrientId === id)?.value ?? 0;
}

// ── Search foods by text query ───────────────────────────────────────────────
export async function searchFoods(query: string, limit = 10): Promise<FoodItem[]> {
  const cacheKey = `usda:search:${limit}:${query.toLowerCase().trim()}`;
  const cached   = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const searchUrl = (requireAllWords: boolean) =>
    `${BASE_URL}/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}` +
    `&dataType=SR%20Legacy,Survey%20(FNDDS),Foundation&requireAllWords=${requireAllWords}&api_key=${API_KEY}`;

  // Multi-word queries match ALL words ("boiled egg" ≠ anything boiled);
  // fall back to loose matching only when the strict search finds nothing.
  let res = await fetch(searchUrl(true));
  if (!res.ok) throw new Error(`USDA search failed: ${res.statusText}`);
  let data = await res.json() as any;
  if (!data.foods?.length) {
    res = await fetch(searchUrl(false));
    if (!res.ok) throw new Error(`USDA search failed: ${res.statusText}`);
    data = await res.json() as any;
  }

  const foods: FoodItem[] = (data.foods ?? []).map((item: any) => {
    const { factor, ...serving } = usdaServing(item);

    return {
      external_id:      String(item.fdcId),
      name:             item.description,
      brand:            item.brandOwner ?? undefined,
      ...serving,
      piece_weight_g:   usdaPieceWeight(item),
      calories:         +(getNutrient(item.foodNutrients, NUTRIENT_IDS.calories) * factor).toFixed(2),
      protein_g:        +(getNutrient(item.foodNutrients, NUTRIENT_IDS.protein)  * factor).toFixed(2),
      carbs_g:          +(getNutrient(item.foodNutrients, NUTRIENT_IDS.carbs)    * factor).toFixed(2),
      fat_g:            +(getNutrient(item.foodNutrients, NUTRIENT_IDS.fat)      * factor).toFixed(2),
      fiber_g:          +(getNutrient(item.foodNutrients, NUTRIENT_IDS.fiber)    * factor).toFixed(2),
      sugar_g:          +(getNutrient(item.foodNutrients, NUTRIENT_IDS.sugar)    * factor).toFixed(2),
      sodium_mg:        +(getNutrient(item.foodNutrients, NUTRIENT_IDS.sodium)   * factor).toFixed(2),
    };
  });

  await redis.setex(cacheKey, 3600, JSON.stringify(foods)); // Cache 1h
  return foods;
}

// ── NLP-style lookup for AI-identified items ─────────────────────────────────
// Gemini gives us food name + estimated_weight_g
// We search USDA and scale nutrients by weight
export async function getNutrientsForItems(
  items: Array<{ name: string; quantity: number; unit: string; estimated_weight_g?: number }>
): Promise<NutritionResult[]> {
  const results: NutritionResult[] = [];

  for (const item of items) {
    const cacheKey = `usda:nlp:${item.name.toLowerCase().trim()}`;
    const cached   = await redis.get(cacheKey);

    let per100g: any;
    if (cached) {
      per100g = JSON.parse(cached);
    } else {
      const url = `${BASE_URL}/foods/search?query=${encodeURIComponent(item.name)}&pageSize=1&dataType=SR%20Legacy,Foundation,Survey%20(FNDDS)&api_key=${API_KEY}`;
      const res  = await fetch(url);
      if (!res.ok) continue;
      const data  = await res.json() as any;
      const match = data.foods?.[0];
      if (!match) continue;

      per100g = {
        calories:  getNutrient(match.foodNutrients, NUTRIENT_IDS.calories),
        protein_g: getNutrient(match.foodNutrients, NUTRIENT_IDS.protein),
        carbs_g:   getNutrient(match.foodNutrients, NUTRIENT_IDS.carbs),
        fat_g:     getNutrient(match.foodNutrients, NUTRIENT_IDS.fat),
        fiber_g:   getNutrient(match.foodNutrients, NUTRIENT_IDS.fiber),
        sugar_g:   getNutrient(match.foodNutrients, NUTRIENT_IDS.sugar),
        sodium_mg: getNutrient(match.foodNutrients, NUTRIENT_IDS.sodium),
      };
      await redis.setex(cacheKey, 3600 * 24, JSON.stringify(per100g)); // Cache 24h
    }

    // Scale by estimated weight from Gemini (default 100g if not provided)
    const weightG  = item.estimated_weight_g ?? 100;
    const factor   = weightG / 100;

    results.push({
      name:      item.name,
      quantity:  item.quantity,
      unit:      item.unit,
      calories:  +(per100g.calories  * factor).toFixed(2),
      protein_g: +(per100g.protein_g * factor).toFixed(2),
      carbs_g:   +(per100g.carbs_g   * factor).toFixed(2),
      fat_g:     +(per100g.fat_g     * factor).toFixed(2),
      fiber_g:   +(per100g.fiber_g   * factor).toFixed(2),
      sugar_g:   +(per100g.sugar_g   * factor).toFixed(2),
      sodium_mg: +(per100g.sodium_mg * factor).toFixed(2),
    });
  }

  return results;
}

// ── Get single food by USDA fdcId ────────────────────────────────────────────
export async function getFoodById(fdcId: string): Promise<FoodItem | null> {
  const res  = await fetch(`${BASE_URL}/food/${fdcId}?api_key=${API_KEY}`);
  if (!res.ok) return null;
  const item = await res.json() as any;
  const { factor, ...serving } = usdaServing(item);
  const per = (id: number) => +(getNutrient(item.foodNutrients, id) * factor).toFixed(2);

  return {
    external_id:      String(item.fdcId),
    name:             item.description,
    ...serving,
    piece_weight_g:   usdaPieceWeight(item),
    calories:         per(NUTRIENT_IDS.calories),
    protein_g:        per(NUTRIENT_IDS.protein),
    carbs_g:          per(NUTRIENT_IDS.carbs),
    fat_g:            per(NUTRIENT_IDS.fat),
    fiber_g:          per(NUTRIENT_IDS.fiber),
    sugar_g:          per(NUTRIENT_IDS.sugar),
    sodium_mg:        per(NUTRIENT_IDS.sodium),
  };
}
