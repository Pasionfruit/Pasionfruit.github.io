-- The 365 challenges' progress, for the `challenges` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=challenges.sql
-- One row per challenge that has been marked, reworded or given a video; the
-- list itself ships with the site (src/data/challenges/challenges.json), and a
-- row here overrides it by challenge_id. status is Not Started, In Progress or Done.
CREATE TABLE IF NOT EXISTS challenges (
  challenge_id TEXT PRIMARY KEY,
  category     TEXT NOT NULL DEFAULT '',
  challenge    TEXT NOT NULL DEFAULT '',
  duration     TEXT NOT NULL DEFAULT '',
  difficulty   TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'Not Started',
  video_url    TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT ''
);
