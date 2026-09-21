import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { searchFoods, getFoodById } from '../services/usda.js';
import { redis } from '../services/redis.js';

// The plainest forms a regular person means by "egg", "chicken", "rice".
const PLAIN_WORDS = /\b(raw|fresh|whole|plain|cooked|boiled|hard-boiled|white|yolk|breast|meat only)\b/g;
// Everyday preparations — good, but after the plain form ("Rice, cooked" before "Rice, fried").
const PREP_WORDS = /\b(soft-boiled|poached|scrambled|fried|baked|roasted|grilled|steamed)\b/g;
// Signs of a processed, mixed or niche item — shown after the basics.
const COMPLEX_WORDS = /\b(with|made with|ns as to|fast food|restaurant|canned|pickled|dried|dry|dehydrated|reconstituted|evaporated|condensed|powder|frozen|substitute|imitation|baby food|flavored|sweetened|malted|breaded|creamed|deviled|benedict|glutinous|human|feet|liver|gizzards?|giblets|hearts?|necks?|kidneys?|tongue|tripe|skin only|back|tail|meatless|roll|by-products?)\b/g;

// Common cuts/parts that keep a name a staple: "chicken breast", "egg white".
const STAPLE_PARTS = 'breast|thigh|wing|drumstick|leg|fillet|white|yolk';

/** Rough singular form so "eggs" matches "egg" and "tomatoes" matches "tomato". */
const singular = (w: string) => w.replace(/(oes|es|s)$/, (m) => (m === 'oes' ? 'o' : ''));
const normalise = (text: string) => text.split(/\s+/).filter(Boolean).map(singular).join(' ');

/**
 * How "basic" a food is for this query, from USDA's naming pattern where the
 * main food comes first ("Egg, whole, boiled"; "Bagels, egg"; "Egg burrito"):
 *   + the name's first segment IS the searched food      → staple
 *   + plain preparations in the rest of the name         → everyday form
 *   − the food only appears later in the name            → ingredient of something else
 *   − processed / mixed / niche wording, many qualifiers → shown later
 */
function basicScore(name: string, query: string, terms: string[]): number {
  const head = normalise(name.split(',')[0]);
  const q = normalise(query);
  const qTerms = terms.map(singular);

  let score = 0;
  const isStapleHead =
    head === q ||
    qTerms.includes(head) ||
    qTerms.some((t) => new RegExp(`^${t} (${STAPLE_PARTS})$`).test(head)); // "Chicken breast, …"
  if (isStapleHead) score += 300;                                           // "Egg, …" / "Eggs, …"
  else if (qTerms.some((t) => head.startsWith(`${t} `))) score += 100;      // "Egg omelet …", "Egg burrito"
  else if (!qTerms.some((t) => head.split(' ').includes(t))) score -= 150;  // "Bagels, egg"

  score += Math.min(3, (name.match(PLAIN_WORDS) ?? []).length) * 40;
  score += Math.min(2, (name.match(PREP_WORDS) ?? []).length) * 20;
  score -= (name.match(COMPLEX_WORDS) ?? []).length * 60;
  score -= name.split(',').length * 10;
  return score;
}

/** Score at or above which a result counts as a basic food for the query. */
const BASIC_THRESHOLD = 300;

/**
 * Relevance ranking shared by every search source. USDA's own search matches
 * terms loosely ("boiled egg" returns anything boiled), so: when any results
 * contain ALL query terms, only those are returned; otherwise partial matches
 * are kept, sorted by coverage. Within that, everyday foods ("Egg, whole,
 * boiled") rank before dishes and processed items ("Egg burrito"), and
 * shorter names break ties.
 */
function scoreFoods<T extends { name: string }>(foods: T[], q: string) {
  const query = q.toLowerCase().trim();
  const terms = query.split(/\s+/).filter(Boolean);
  const scored = foods.map((f) => {
    const name = (f.name ?? '').toLowerCase();
    const matched = terms.filter((t) => name.includes(singular(t))).length;
    const score =
      (matched === terms.length ? 10000 : 0) +
      matched * 1000 +
      basicScore(name, query, terms) -
      Math.min(name.length, 99) / 100;
    return { f, matched, score };
  });
  const full = scored.filter((s) => s.matched === terms.length);
  const pool = full.length > 0 ? full : scored.filter((s) => s.matched > 0);
  return pool.sort((a, b) => b.score - a.score);
}

function rankFoods<T extends { name: string }>(foods: T[], q: string, limit: number): T[] {
  if (!q.trim()) return foods.slice(0, limit);
  return scoreFoods(foods, q).map((s) => s.f).slice(0, limit);
}

/** True when some result is an everyday form of the searched food. */
function hasBasicMatch<T extends { name: string }>(foods: T[], q: string): boolean {
  const query = q.toLowerCase().trim();
  const terms = query.split(/\s+/).filter(Boolean);
  return foods.some((f) => basicScore((f.name ?? '').toLowerCase(), query, terms) >= BASIC_THRESHOLD);
}

export async function foodRoutes(app: FastifyInstance) {
  // GET /api/foods/search?q=chicken+breast
  app.get('/search', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { q, limit = '10' } = request.query as { q: string; limit?: string };
    if (!q || q.trim().length < 2) {
      return reply.status(400).send({ error: 'Query must be at least 2 characters' });
    }
    const max = parseInt(limit);

    const cacheKey = `food:search:${q.toLowerCase().trim()}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      // Rank on read too, so lists cached before the ranker still come back clean.
      return reply.send({ foods: rankFoods(JSON.parse(cached), q, max), source: 'cache' });
    }

    // Check local DB first (full-text search)
    const localResults = await db<Array<{ name: string; external_id: string | null }>>`
      SELECT id, external_id, name, brand, serving_qty, serving_unit, serving_weight_g, piece_weight_g,
             calories, protein_g, carbs_g, fat_g, fiber_g
      FROM food_items
      WHERE to_tsvector('english', name) @@ plainto_tsquery('english', ${q})
        AND (cache_expires_at IS NULL OR cache_expires_at > NOW())
      ORDER BY ts_rank(to_tsvector('english', name), plainto_tsquery('english', ${q})) DESC
      LIMIT 50
    `;

    // The cache is enough only when it already holds an everyday form of the
    // food; otherwise "egg" would be answered with burritos and bagels.
    if (localResults.length >= 5 && hasBasicMatch(localResults, q)) {
      const ranked = rankFoods(localResults, q, max);
      await redis.setex(cacheKey, 300, JSON.stringify(ranked));
      return reply.send({ foods: ranked, source: 'local' });
    }

    // Fetch a larger pool from USDA so the ranker has real candidates to keep
    // after dropping the loose single-term matches. USDA intermittently
    // rejects requests — degrade to local partial results instead of a 500.
    let apiResults;
    try {
      apiResults = rankFoods(await searchFoods(q, 100), q, max);
    } catch {
      return reply.send({ foods: rankFoods(localResults, q, max), source: 'local-fallback' });
    }

    // Upsert into local cache
    if (apiResults.length > 0) {
      for (const food of apiResults) {
        try {
          const [upserted] = await db`
            INSERT INTO food_items (external_id, source, name, brand, serving_qty, serving_unit,
              serving_weight_g, piece_weight_g, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
            VALUES (${food.external_id}, 'nutritionix', ${food.name}, ${food.brand ?? null},
              ${food.serving_qty}, ${food.serving_unit}, ${food.serving_weight_g ?? null},
              ${food.piece_weight_g ?? null},
              ${food.calories}, ${food.protein_g}, ${food.carbs_g}, ${food.fat_g},
              ${food.fiber_g ?? null}, ${food.sugar_g ?? null}, ${food.sodium_mg ?? null})
            ON CONFLICT (external_id) DO UPDATE SET
              serving_qty = EXCLUDED.serving_qty, serving_unit = EXCLUDED.serving_unit,
              serving_weight_g = EXCLUDED.serving_weight_g, piece_weight_g = EXCLUDED.piece_weight_g,
              calories = EXCLUDED.calories, protein_g = EXCLUDED.protein_g,
              carbs_g = EXCLUDED.carbs_g, fat_g = EXCLUDED.fat_g,
              cached_at = NOW(), cache_expires_at = NOW() + INTERVAL '30 days'
            RETURNING id
          `;
          if (upserted) {
            (food as any).id = upserted.id;
          }
        } catch (err) {
          // ignore upsert errors
        }
      }
    }

    // Keep cached matches in the running — the cache may hold the best basic
    // item even when USDA's page doesn't.
    const apiIds = new Set(apiResults.map((f) => f.external_id));
    const foods = rankFoods(
      [...apiResults, ...localResults.filter((l) => !apiIds.has(l.external_id ?? ''))],
      q,
      max
    );

    await redis.setex(cacheKey, 300, JSON.stringify(foods));
    return reply.send({ foods, source: 'nutritionix' });
  });

  // GET /api/foods/:id
  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [food] = await db`
      SELECT * FROM food_items WHERE id = ${id} LIMIT 1
    `;
    if (!food) return reply.status(404).send({ error: 'Food not found' });
    return reply.send({ food });
  });
}
