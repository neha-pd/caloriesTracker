CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT, google_id TEXT UNIQUE,
 display_name TEXT, avatar_url TEXT, age SMALLINT, gender TEXT, height_cm NUMERIC, weight_kg NUMERIC,
 activity_level TEXT, goal_type TEXT, calorie_goal INTEGER NOT NULL DEFAULT 2000,
 protein_goal_g INTEGER NOT NULL DEFAULT 100, carbs_goal_g INTEGER NOT NULL DEFAULT 250,
 fat_goal_g INTEGER NOT NULL DEFAULT 67, timezone TEXT NOT NULL DEFAULT 'UTC',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"water_goal_ml":2000,"meal_reminders":false,"water_reminders":false,"quest_reminders":false,"haptics":true}';
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized ON users (LOWER(email));
CREATE TABLE IF NOT EXISTS sessions (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 refresh_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS password_resets (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS entries_v2 (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 log_date TEXT NOT NULL, name TEXT NOT NULL, food_id TEXT,
 meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
 quantity NUMERIC NOT NULL CHECK(quantity > 0), serving_unit TEXT NOT NULL,
 calories NUMERIC NOT NULL CHECK(calories >= 0), protein_g NUMERIC NOT NULL CHECK(protein_g >= 0),
 carbs_g NUMERIC NOT NULL CHECK(carbs_g >= 0), fat_g NUMERIC NOT NULL CHECK(fat_g >= 0),
 fiber_g NUMERIC, base_nutrition JSONB NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
 version INTEGER NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS entries_v2_user_date ON entries_v2(user_id,log_date);
CREATE TABLE IF NOT EXISTS water_entries (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 log_date TEXT NOT NULL, amount_ml INTEGER NOT NULL CHECK(amount_ml > 0 AND amount_ml <= 5000),
 deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS water_user_date ON water_entries(user_id,log_date);
CREATE TABLE IF NOT EXISTS xp_events (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, log_date TEXT NOT NULL,
 event_key TEXT NOT NULL, amount INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id,log_date,event_key)
);
CREATE TABLE IF NOT EXISTS custom_foods (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, serving_qty NUMERIC NOT NULL, serving_unit TEXT NOT NULL,
 calories NUMERIC NOT NULL, protein_g NUMERIC NOT NULL, carbs_g NUMERIC NOT NULL, fat_g NUMERIC NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_goal_kg NUMERIC;

ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid ON users(firebase_uid);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS firebase_auth_time BIGINT;
