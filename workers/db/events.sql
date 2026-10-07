-- The countdown's events, for the `events` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=events.sql
-- event_date is the datetime-local value the site writes ("2026-11-14T07:00"),
-- read back as local time.
CREATE TABLE IF NOT EXISTS events (
  event_id   TEXT PRIMARY KEY,
  event_name TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT ''
);
