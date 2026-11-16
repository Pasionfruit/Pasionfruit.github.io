-- The Progress tracker's tables, for the progress_* entries in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=progress.sql
-- Measurements are TEXT so an empty string means "skipped today". Skin photo
-- bytes live in R2 (see photos.js); photo_id names both the row and the object.
CREATE TABLE IF NOT EXISTS progress_checkins (
  date TEXT PRIMARY KEY,
  am_done TEXT NOT NULL DEFAULT '', pm_done TEXT NOT NULL DEFAULT '',
  acne_face TEXT NOT NULL DEFAULT '', acne_back TEXT NOT NULL DEFAULT '',
  redness TEXT NOT NULL DEFAULT '', scar TEXT NOT NULL DEFAULT '',
  products TEXT NOT NULL DEFAULT '',
  sleep_h TEXT NOT NULL DEFAULT '', energy TEXT NOT NULL DEFAULT '',
  mood TEXT NOT NULL DEFAULT '', stress TEXT NOT NULL DEFAULT '',
  sugar_g TEXT NOT NULL DEFAULT '', protein_g TEXT NOT NULL DEFAULT '',
  carbs_g TEXT NOT NULL DEFAULT '', dairy TEXT NOT NULL DEFAULT '',
  min_training TEXT NOT NULL DEFAULT '', min_content TEXT NOT NULL DEFAULT '',
  min_leisure TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS progress_skin_photos (
  photo_id TEXT PRIMARY KEY,
  taken_at TEXT NOT NULL DEFAULT '',
  angle TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  -- JSON array of {kind, x, y, r} circles, 0-1 of the image width.
  marks TEXT NOT NULL DEFAULT '[]',
  verified TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS progress_content (
  content_id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'idea',
  platform TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
  post_date TEXT NOT NULL DEFAULT '',
  filming_min TEXT NOT NULL DEFAULT '', editing_min TEXT NOT NULL DEFAULT '',
  views TEXT NOT NULL DEFAULT '', likes TEXT NOT NULL DEFAULT '', comments TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS progress_workout_rpe (
  workout_key TEXT PRIMARY KEY,
  rpe TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
