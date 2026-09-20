-- Adds per-piece weights for the "piece" portion measure. Safe to re-run.
-- Usage: psql $DATABASE_URL -f add_piece_weight.sql
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS piece_weight_g NUMERIC(7,2);
