import { redis } from './redis.js';

const BASE_URL = 'https://trackapi.nutritionix.com/v2';

const headers = {
  'x-app-id':  process.env.NUTRITIONIX_APP_ID!,
  'x-app-key': process.env.NUTRITIONIX_API_KEY!,
  'Content-Type': 'application/json',
};

export interface NutritionixFood {
  external_id: string;
  name: string;
  brand?: string;
  serving_qty: number;
  serving_unit: string;
  serving_weight_g?: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
}

export interface NutritionResult {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

// Search foods by text query
export async function searchNutritionix(query: string, limit = 10): Promise<NutritionixFood[]> {
  const res = await fetch(`${BASE_URL}/search/instant?query=${encodeURIComponent(query)}&detailed=true&self=false&branded=false`, {
    headers,
  });
  if (!res.ok) throw new Error(`Nutritionix search failed: ${res.statusText}`);

  const data = await res.json() as any;
  const items = [...(data.common ?? []), ...(data.branded ?? [])].slice(0, limit);

  return items.map((item: any) => ({
    external_id:      item.nix_item_id ?? item.food_name,
    name:             item.food_name,
    brand:            item.brand_name ?? undefined,
    serving_qty:      item.serving_qty ?? 1,
    serving_unit:     item.serving_unit ?? 'serving',
    serving_weight_g: item.serving_weight_grams ?? undefined,
    calories:         item.nf_calories ?? item.full_nutrients?.find((n: any) => n.attr_id === 208)?.value ?? 0,
    protein_g:        item.nf_protein ?? 0,
    carbs_g:          item.nf_total_carbohydrate ?? 0,
    fat_g:            item.nf_total_fat ?? 0,
    fiber_g:          item.nf_dietary_fiber ?? undefined,
    sugar_g:          item.nf_sugars ?? undefined,
    sodium_mg:        item.nf_sodium ?? undefined,
  }));
}

// Natural language nutrient lookup — ideal for AI-identified food names
export async function getNutrientsForItems(items: Array<{ name: string; quantity: number; unit: string }>): Promise<NutritionResult[]> {
  const query = items.map(i => `${i.quantity} ${i.unit} ${i.name}`).join('\n');

  const cacheKey = `nutritionix:nlp:${Buffer.from(query).toString('base64').slice(0, 64)}`;
  const cached   = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = await fetch(`${BASE_URL}/natural/nutrients`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Nutritionix nutrients failed: ${err}`);
  }

  const data  = await res.json() as any;
  const foods: NutritionResult[] = (data.foods ?? []).map((f: any, i: number) => ({
    name:      items[i]?.name ?? f.food_name,
    quantity:  items[i]?.quantity ?? 1,
    unit:      items[i]?.unit ?? 'serving',
    calories:  f.nf_calories ?? 0,
    protein_g: f.nf_protein ?? 0,
    carbs_g:   f.nf_total_carbohydrate ?? 0,
    fat_g:     f.nf_total_fat ?? 0,
    fiber_g:   f.nf_dietary_fiber ?? 0,
    sugar_g:   f.nf_sugars ?? 0,
    sodium_mg: f.nf_sodium ?? 0,
  }));

  await redis.setex(cacheKey, 3600 * 24, JSON.stringify(foods)); // Cache 24h
  return foods;
}

export async function getNutritionixById(id: string): Promise<NutritionixFood | null> {
  const res = await fetch(`${BASE_URL}/search/item?nix_item_id=${id}`, { headers });
  if (!res.ok) return null;
  const data  = await res.json() as any;
  const item  = data.foods?.[0];
  if (!item) return null;
  return {
    external_id:      id,
    name:             item.food_name,
    brand:            item.brand_name,
    serving_qty:      item.serving_qty,
    serving_unit:     item.serving_unit,
    serving_weight_g: item.serving_weight_grams,
    calories:         item.nf_calories,
    protein_g:        item.nf_protein,
    carbs_g:          item.nf_total_carbohydrate,
    fat_g:            item.nf_total_fat,
    fiber_g:          item.nf_dietary_fiber,
    sugar_g:          item.nf_sugars,
    sodium_mg:        item.nf_sodium,
  };
}
