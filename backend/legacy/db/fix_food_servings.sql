-- ============================================================
-- One-off data fix: USDA foods cached as "1 g" servings.
--
-- The USDA search mapper stored generic foods as serving_qty = 1,
-- serving_unit = 'g', serving_weight_g = 100 while the nutrients were for
-- the whole 100 g, so "1 g" read as 249 kcal. The serving quantity is now
-- expressed in its unit: 100 g. Nutrient columns are already per 100 g and
-- stay unchanged; logged entries keep the nutrition stored at log time.
--
-- Usage: psql $DATABASE_URL -f fix_food_servings.sql   (safe to re-run)
-- ============================================================

UPDATE food_items
SET serving_qty = serving_weight_g
WHERE serving_unit = 'g'
  AND serving_weight_g IS NOT NULL
  AND serving_qty <> serving_weight_g;
