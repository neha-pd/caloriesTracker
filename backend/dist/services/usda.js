import { redis } from './redis.js';
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY = process.env.USDA_API_KEY;
// USDA nutrient IDs we care about
const NUTRIENT_IDS = {
    calories: 1008,
    protein: 1003,
    carbs: 1005,
    fat: 1004,
    fiber: 1079,
    sugar: 2000,
    sodium: 1093,
};
// Pull a specific nutrient value from the USDA nutrients array
function getNutrient(nutrients, id) {
    return nutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}
// ── Search foods by text query ───────────────────────────────────────────────
export async function searchFoods(query, limit = 10) {
    const cacheKey = `usda:search:${query.toLowerCase().trim()}`;
    const cached = await redis.get(cacheKey);
    if (cached)
        return JSON.parse(cached);
    const url = `${BASE_URL}/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=SR%20Legacy,Survey%20(FNDDS),Foundation&api_key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`USDA search failed: ${res.statusText}`);
    const data = await res.json();
    const foods = (data.foods ?? []).map((item) => {
        const servingWeight = item.servingSize ?? 100;
        const factor = servingWeight / 100;
        return {
            external_id: String(item.fdcId),
            name: item.description,
            brand: item.brandOwner ?? undefined,
            serving_qty: 1,
            serving_unit: item.servingSizeUnit ?? 'g',
            serving_weight_g: servingWeight,
            calories: +(getNutrient(item.foodNutrients, NUTRIENT_IDS.calories) * factor).toFixed(2),
            protein_g: +(getNutrient(item.foodNutrients, NUTRIENT_IDS.protein) * factor).toFixed(2),
            carbs_g: +(getNutrient(item.foodNutrients, NUTRIENT_IDS.carbs) * factor).toFixed(2),
            fat_g: +(getNutrient(item.foodNutrients, NUTRIENT_IDS.fat) * factor).toFixed(2),
            fiber_g: +(getNutrient(item.foodNutrients, NUTRIENT_IDS.fiber) * factor).toFixed(2),
            sugar_g: +(getNutrient(item.foodNutrients, NUTRIENT_IDS.sugar) * factor).toFixed(2),
            sodium_mg: +(getNutrient(item.foodNutrients, NUTRIENT_IDS.sodium) * factor).toFixed(2),
        };
    });
    await redis.setex(cacheKey, 3600, JSON.stringify(foods)); // Cache 1h
    return foods;
}
// ── NLP-style lookup for AI-identified items ─────────────────────────────────
// Gemini gives us food name + estimated_weight_g
// We search USDA and scale nutrients by weight
export async function getNutrientsForItems(items) {
    const results = [];
    for (const item of items) {
        const cacheKey = `usda:nlp:${item.name.toLowerCase().trim()}`;
        const cached = await redis.get(cacheKey);
        let per100g;
        if (cached) {
            per100g = JSON.parse(cached);
        }
        else {
            const url = `${BASE_URL}/foods/search?query=${encodeURIComponent(item.name)}&pageSize=1&dataType=SR%20Legacy,Foundation,Survey%20(FNDDS)&api_key=${API_KEY}`;
            const res = await fetch(url);
            if (!res.ok)
                continue;
            const data = await res.json();
            const match = data.foods?.[0];
            if (!match)
                continue;
            per100g = {
                calories: getNutrient(match.foodNutrients, NUTRIENT_IDS.calories),
                protein_g: getNutrient(match.foodNutrients, NUTRIENT_IDS.protein),
                carbs_g: getNutrient(match.foodNutrients, NUTRIENT_IDS.carbs),
                fat_g: getNutrient(match.foodNutrients, NUTRIENT_IDS.fat),
                fiber_g: getNutrient(match.foodNutrients, NUTRIENT_IDS.fiber),
                sugar_g: getNutrient(match.foodNutrients, NUTRIENT_IDS.sugar),
                sodium_mg: getNutrient(match.foodNutrients, NUTRIENT_IDS.sodium),
            };
            await redis.setex(cacheKey, 3600 * 24, JSON.stringify(per100g)); // Cache 24h
        }
        // Scale by estimated weight from Gemini (default 100g if not provided)
        const weightG = item.estimated_weight_g ?? 100;
        const factor = weightG / 100;
        results.push({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            calories: +(per100g.calories * factor).toFixed(2),
            protein_g: +(per100g.protein_g * factor).toFixed(2),
            carbs_g: +(per100g.carbs_g * factor).toFixed(2),
            fat_g: +(per100g.fat_g * factor).toFixed(2),
            fiber_g: +(per100g.fiber_g * factor).toFixed(2),
            sugar_g: +(per100g.sugar_g * factor).toFixed(2),
            sodium_mg: +(per100g.sodium_mg * factor).toFixed(2),
        });
    }
    return results;
}
// ── Get single food by USDA fdcId ────────────────────────────────────────────
export async function getFoodById(fdcId) {
    const res = await fetch(`${BASE_URL}/food/${fdcId}?api_key=${API_KEY}`);
    if (!res.ok)
        return null;
    const item = await res.json();
    return {
        external_id: String(item.fdcId),
        name: item.description,
        serving_qty: 1,
        serving_unit: item.servingSizeUnit ?? 'g',
        serving_weight_g: item.servingSize ?? 100,
        calories: getNutrient(item.foodNutrients, NUTRIENT_IDS.calories),
        protein_g: getNutrient(item.foodNutrients, NUTRIENT_IDS.protein),
        carbs_g: getNutrient(item.foodNutrients, NUTRIENT_IDS.carbs),
        fat_g: getNutrient(item.foodNutrients, NUTRIENT_IDS.fat),
        fiber_g: getNutrient(item.foodNutrients, NUTRIENT_IDS.fiber),
        sugar_g: getNutrient(item.foodNutrients, NUTRIENT_IDS.sugar),
        sodium_mg: getNutrient(item.foodNutrients, NUTRIENT_IDS.sodium),
    };
}
//# sourceMappingURL=usda.js.map