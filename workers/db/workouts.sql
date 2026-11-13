-- Workouts pushed from the phone's Apple Health (Hevy and others write there),
-- for the `apple_workouts` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=workouts.sql
-- One row per workout, keyed by its start time (e.g. 2026-11-13T07:30), so the
-- Shortcut can safely re-send a day: the same workout replaces itself.
-- Values are stored as text, "" when Apple Health had nothing for that field.
CREATE TABLE IF NOT EXISTS apple_workouts (
  workout_id   TEXT PRIMARY KEY,
  date         TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  duration_min TEXT NOT NULL DEFAULT '',
  distance_mi  TEXT NOT NULL DEFAULT '',
  calories     TEXT NOT NULL DEFAULT '',
  avg_hr       TEXT NOT NULL DEFAULT '',
  max_hr       TEXT NOT NULL DEFAULT ''
);
