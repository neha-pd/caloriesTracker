-- ============================================================
-- FitLens Database Schema
-- Run via: psql $DATABASE_URL -f schema.sql
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM Types ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE log_entry_status AS ENUM ('pending', 'processing', 'complete', 'failed', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vision_job_status AS ENUM ('queued', 'processing', 'succeeded', 'failed', 'retrying');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT,
    google_id       TEXT UNIQUE,
    display_name    TEXT,
    avatar_url      TEXT,

    -- Physical profile
    age             SMALLINT,
    gender          TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    height_cm       NUMERIC(5,2),
    weight_kg       NUMERIC(5,2),
    activity_level  TEXT CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active')),

    -- Goals
    goal_type       TEXT CHECK (goal_type IN ('lose_weight', 'maintain', 'gain_muscle')),
    calorie_goal    SMALLINT NOT NULL DEFAULT 2000,
    protein_goal_g  SMALLINT DEFAULT 150,
    carbs_goal_g    SMALLINT DEFAULT 200,
    fat_goal_g      SMALLINT DEFAULT 65,

    -- Metadata
    timezone        TEXT DEFAULT 'UTC',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── food_items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id      TEXT UNIQUE,
    source           TEXT NOT NULL DEFAULT 'nutritionix',
    barcode          TEXT,
    name             TEXT NOT NULL,
    brand            TEXT,
    serving_qty      NUMERIC(6,2) NOT NULL DEFAULT 1,
    serving_unit     TEXT NOT NULL DEFAULT 'serving',
    serving_weight_g NUMERIC(6,2),

    -- Nutrition per serving
    calories         NUMERIC(7,2) NOT NULL,
    protein_g        NUMERIC(6,2) NOT NULL DEFAULT 0,
    carbs_g          NUMERIC(6,2) NOT NULL DEFAULT 0,
    fat_g            NUMERIC(6,2) NOT NULL DEFAULT 0,
    fiber_g          NUMERIC(6,2),
    sugar_g          NUMERIC(6,2),
    sodium_mg        NUMERIC(8,2),
    -- Weight of one natural piece ("1 egg", "1 item"), from USDA portion data.
    -- NULL when the source doesn't state one; never estimated.
    piece_weight_g   NUMERIC(7,2),

    cached_at        TIMESTAMPTZ DEFAULT NOW(),
    cache_expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Existing databases (CREATE TABLE IF NOT EXISTS won't add new columns)
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS piece_weight_g NUMERIC(7,2);

CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_food_items_external_id ON food_items(external_id);
CREATE INDEX IF NOT EXISTS idx_food_items_barcode ON food_items(barcode);

-- ── daily_logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date        DATE NOT NULL,

    -- Aggregated actuals (kept in sync by trigger)
    total_calories  NUMERIC(7,2) DEFAULT 0,
    total_protein_g NUMERIC(6,2) DEFAULT 0,
    total_carbs_g   NUMERIC(6,2) DEFAULT 0,
    total_fat_g     NUMERIC(6,2) DEFAULT 0,

    -- Goal snapshot (captured at creation)
    calorie_goal    SMALLINT NOT NULL DEFAULT 2000,
    protein_goal_g  SMALLINT,
    carbs_goal_g    SMALLINT,
    fat_goal_g      SMALLINT,

    water_ml        SMALLINT DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date DESC);

-- ── log_entries ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS log_entries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_log_id     UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_item_id     UUID REFERENCES food_items(id),

    meal_type        meal_type NOT NULL DEFAULT 'snack',
    logged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status           log_entry_status NOT NULL DEFAULT 'manual',

    -- Quantity
    quantity         NUMERIC(6,2) NOT NULL DEFAULT 1,
    serving_unit     TEXT NOT NULL DEFAULT 'serving',

    -- Nutrition (stored at log-time: food_item values × quantity)
    calories         NUMERIC(7,2),
    protein_g        NUMERIC(6,2),
    carbs_g          NUMERIC(6,2),
    fat_g            NUMERIC(6,2),

    -- AI vision fields
    image_url        TEXT,
    ai_confidence    NUMERIC(3,2),
    ai_raw_response  JSONB,
    ai_identified_items JSONB,

    -- Override tracking
    is_user_overridden BOOLEAN DEFAULT FALSE,
    override_source  TEXT,

    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_entries_daily_log ON log_entries(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_user_date ON log_entries(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_entries_status ON log_entries(status) WHERE status IN ('pending', 'processing');

-- ── vision_jobs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vision_jobs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_entry_id     UUID NOT NULL REFERENCES log_entries(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    image_url        TEXT NOT NULL,
    status           vision_job_status NOT NULL DEFAULT 'queued',

    attempts         SMALLINT DEFAULT 0,
    max_attempts     SMALLINT DEFAULT 3,

    queued_at        TIMESTAMPTZ DEFAULT NOW(),
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,

    gemini_response  JSONB,
    nutritionix_response JSONB,
    error_message    TEXT,
    processing_ms    INTEGER
);

-- ── Trigger: auto-update daily_log totals ─────────────────────
CREATE OR REPLACE FUNCTION update_daily_log_totals()
RETURNS TRIGGER AS $$
DECLARE
  target_log_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_log_id := OLD.daily_log_id;
  ELSE
    target_log_id := NEW.daily_log_id;
  END IF;

  UPDATE daily_logs
  SET
    total_calories  = COALESCE((
      SELECT SUM(calories) FROM log_entries
      WHERE daily_log_id = target_log_id AND status IN ('complete', 'manual')
    ), 0),
    total_protein_g = COALESCE((
      SELECT SUM(protein_g) FROM log_entries
      WHERE daily_log_id = target_log_id AND status IN ('complete', 'manual')
    ), 0),
    total_carbs_g   = COALESCE((
      SELECT SUM(carbs_g) FROM log_entries
      WHERE daily_log_id = target_log_id AND status IN ('complete', 'manual')
    ), 0),
    total_fat_g     = COALESCE((
      SELECT SUM(fat_g) FROM log_entries
      WHERE daily_log_id = target_log_id AND status IN ('complete', 'manual')
    ), 0),
    updated_at = NOW()
  WHERE id = target_log_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_daily_totals ON log_entries;
CREATE TRIGGER trg_update_daily_totals
AFTER INSERT OR UPDATE OR DELETE ON log_entries
FOR EACH ROW EXECUTE FUNCTION update_daily_log_totals();

-- ── Trigger: auto-update updated_at timestamps ────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_daily_logs_updated_at BEFORE UPDATE ON daily_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_log_entries_updated_at BEFORE UPDATE ON log_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
