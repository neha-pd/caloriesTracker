import { db } from '../db/client.js';
import { searchFoods } from '../services/usda.js';
import { redis } from '../services/redis.js';
export async function foodRoutes(app) {
    // GET /api/foods/search?q=chicken+breast
    app.get('/search', { onRequest: [app.authenticate] }, async (request, reply) => {
        const { q, limit = '10' } = request.query;
        if (!q || q.trim().length < 2) {
            return reply.status(400).send({ error: 'Query must be at least 2 characters' });
        }
        const cacheKey = `food:search:${q.toLowerCase().trim()}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return reply.send({ foods: JSON.parse(cached), source: 'cache' });
        }
        // Check local DB first (full-text search)
        const localResults = await db `
      SELECT id, name, brand, serving_qty, serving_unit, serving_weight_g,
             calories, protein_g, carbs_g, fat_g, fiber_g
      FROM food_items
      WHERE to_tsvector('english', name) @@ plainto_tsquery('english', ${q})
        AND (cache_expires_at IS NULL OR cache_expires_at > NOW())
      ORDER BY ts_rank(to_tsvector('english', name), plainto_tsquery('english', ${q})) DESC
      LIMIT ${parseInt(limit)}
    `;
        if (localResults.length >= 5) {
            await redis.setex(cacheKey, 300, JSON.stringify(localResults));
            return reply.send({ foods: localResults, source: 'local' });
        }
        // Fetch from USDA
        const apiResults = await searchFoods(q, parseInt(limit));
        // Upsert into local cache
        if (apiResults.length > 0) {
            for (const food of apiResults) {
                try {
                    const [upserted] = await db `
            INSERT INTO food_items (external_id, source, name, brand, serving_qty, serving_unit,
              serving_weight_g, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
            VALUES (${food.external_id}, 'nutritionix', ${food.name}, ${food.brand ?? null},
              ${food.serving_qty}, ${food.serving_unit}, ${food.serving_weight_g ?? null},
              ${food.calories}, ${food.protein_g}, ${food.carbs_g}, ${food.fat_g},
              ${food.fiber_g ?? null}, ${food.sugar_g ?? null}, ${food.sodium_mg ?? null})
            ON CONFLICT (external_id) DO UPDATE SET
              calories = EXCLUDED.calories, protein_g = EXCLUDED.protein_g,
              carbs_g = EXCLUDED.carbs_g, fat_g = EXCLUDED.fat_g,
              cached_at = NOW(), cache_expires_at = NOW() + INTERVAL '30 days'
            RETURNING id
          `;
                    if (upserted) {
                        food.id = upserted.id;
                    }
                }
                catch (err) {
                    // ignore upsert errors
                }
            }
        }
        await redis.setex(cacheKey, 300, JSON.stringify(apiResults));
        return reply.send({ foods: apiResults, source: 'nutritionix' });
    });
    // GET /api/foods/:id
    app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const [food] = await db `
      SELECT * FROM food_items WHERE id = ${id} LIMIT 1
    `;
        if (!food)
            return reply.status(404).send({ error: 'Food not found' });
        return reply.send({ food });
    });
}
//# sourceMappingURL=foods.js.map