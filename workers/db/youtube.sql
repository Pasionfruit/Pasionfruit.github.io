-- The YouTube dashboard's data, for the `youtube_videos` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=youtube.sql
-- One row per video, replaced on every `minite results` run. `snapshot` is the
-- whole analysis as JSON (see MiniteThoughts minite/results.py); the other
-- columns are there so the list can be read without parsing it.
CREATE TABLE IF NOT EXISTS youtube_videos (
  video_id     TEXT PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL DEFAULT '',
  fetched_at   TEXT NOT NULL DEFAULT '',
  snapshot     TEXT NOT NULL DEFAULT ''
);
