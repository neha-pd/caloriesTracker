/**
 * One-off: fill food_items.piece_weight_g for USDA foods cached before the
 * "piece" measure existed. Reads real portion data from USDA; foods without a
 * countable portion stay NULL. Safe to re-run.
 *
 * Usage: npx tsx src/db/backfill_piece_weights.ts
 */
import 'dotenv/config';
import db from './client.js';
import { usdaPieceWeight } from '../services/usda.js';

const BATCH = 20; // USDA /foods accepts up to 20 fdcIds per request

const rows = await db`
  SELECT id, external_id FROM food_items
  WHERE external_id ~ '^[0-9]+$' AND piece_weight_g IS NULL
`;
let filled = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const ids = batch.map((r) => r.external_id).join(',');
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods?fdcIds=${ids}&format=full&api_key=${process.env.USDA_API_KEY}`);
  if (!res.ok) {
    console.warn(`USDA batch ${i / BATCH + 1} failed: ${res.status}`);
    continue;
  }
  for (const food of (await res.json()) as any[]) {
    const grams = usdaPieceWeight(food);
    if (grams == null) continue;
    await db`UPDATE food_items SET piece_weight_g = ${grams} WHERE external_id = ${String(food.fdcId)}`;
    filled += 1;
  }
}

console.log(`piece weights filled for ${filled} of ${rows.length} foods`);
await db.end();
