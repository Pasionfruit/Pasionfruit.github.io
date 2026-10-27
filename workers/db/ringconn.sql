-- RingConn days, for the `ringconn_health` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=ringconn.sql
-- One row per date (YYYY-MM-DD), replaced each time the phone Shortcut runs.
-- Values are stored as text, "" when Apple Health had nothing for that metric.
CREATE TABLE IF NOT EXISTS ringconn_health (
  date             TEXT PRIMARY KEY,
  sleep_score      TEXT NOT NULL DEFAULT '',
  sleep_duration_h TEXT NOT NULL DEFAULT '',
  deep_sleep_h     TEXT NOT NULL DEFAULT '',
  rem_sleep_h      TEXT NOT NULL DEFAULT '',
  light_sleep_h    TEXT NOT NULL DEFAULT '',
  resting_hr       TEXT NOT NULL DEFAULT '',
  hrv              TEXT NOT NULL DEFAULT '',
  skin_temp_c      TEXT NOT NULL DEFAULT '',
  steps            TEXT NOT NULL DEFAULT '',
  calories         TEXT NOT NULL DEFAULT ''
);
