-- The timeline's photo metadata, for the `timeline_photos` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=timeline.sql
-- The image bytes live in R2 (see photos.js); photo_id names both the row and the object.
-- taken_at is the datetime-local value the site writes ("2024-02-14T19:30").
CREATE TABLE IF NOT EXISTS timeline_photos (
  photo_id     TEXT PRIMARY KEY,
  taken_at     TEXT NOT NULL DEFAULT '',
  caption      TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT ''
);
