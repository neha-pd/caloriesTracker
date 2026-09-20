-- ============================================================
-- One-off repair: re-file log entries under the user's LOCAL day.
--
-- Before the local-date fix, "today" was the server's UTC date, so food
-- logged between local midnight and UTC midnight landed in the previous
-- day's daily_logs row. This moves each such entry to the daily log for
-- the local date of its logged_at, creating that row if needed (one row
-- per user per day is still enforced by UNIQUE (user_id, log_date)).
--
-- Water intake is stored per day, not per sip, so it cannot be moved.
-- Assumes entries were logged for "today" (the app never back-dates); an
-- entry deliberately filed under another date via the API would be moved too.
--
-- Usage (timezone the affected data was logged in):
--   psql $DATABASE_URL -v tz='Asia/Kolkata' -f rebucket_daily_logs.sql
-- Preview first by replacing COMMIT with ROLLBACK at the end.
-- ============================================================

BEGIN;

CREATE TEMP TABLE misfiled ON COMMIT DROP AS
SELECT le.id AS entry_id, le.user_id, dl.id AS old_log_id,
       (le.logged_at AT TIME ZONE :'tz')::date AS local_date
FROM log_entries le
JOIN daily_logs dl ON dl.id = le.daily_log_id
WHERE (le.logged_at AT TIME ZONE :'tz')::date <> dl.log_date;

-- Target rows inherit the goal snapshot of the log the entry came from.
INSERT INTO daily_logs (user_id, log_date, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g)
SELECT DISTINCT ON (m.user_id, m.local_date)
       m.user_id, m.local_date, dl.calorie_goal, dl.protein_goal_g, dl.carbs_goal_g, dl.fat_goal_g
FROM misfiled m
JOIN daily_logs dl ON dl.id = m.old_log_id
ON CONFLICT (user_id, log_date) DO NOTHING;

UPDATE log_entries le
SET daily_log_id = target.id
FROM misfiled m
JOIN daily_logs target ON target.user_id = m.user_id AND target.log_date = m.local_date
WHERE le.id = m.entry_id;

-- The totals trigger only refreshes the NEW log on UPDATE; recompute the
-- logs entries were moved out of.
UPDATE daily_logs dl SET
  total_calories  = COALESCE(t.calories, 0),
  total_protein_g = COALESCE(t.protein_g, 0),
  total_carbs_g   = COALESCE(t.carbs_g, 0),
  total_fat_g     = COALESCE(t.fat_g, 0)
FROM (SELECT DISTINCT old_log_id FROM misfiled) src
LEFT JOIN LATERAL (
  SELECT SUM(calories) AS calories, SUM(protein_g) AS protein_g,
         SUM(carbs_g) AS carbs_g, SUM(fat_g) AS fat_g
  FROM log_entries
  WHERE daily_log_id = src.old_log_id AND status IN ('complete', 'manual')
) t ON TRUE
WHERE dl.id = src.old_log_id;

SELECT COUNT(*) AS entries_moved FROM misfiled;

COMMIT;
