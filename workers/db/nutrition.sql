-- Daily nutrition from Cronometer via Apple Health, for the `nutrition_daily` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=nutrition.sql
-- One row per date (YYYY-MM-DD), replaced when the phone Shortcut runs. Text, "" when Apple Health had nothing.
CREATE TABLE IF NOT EXISTS nutrition_daily (
  date            TEXT PRIMARY KEY,
  calories        TEXT NOT NULL DEFAULT '',
  protein_g       TEXT NOT NULL DEFAULT '',
  carbs_g         TEXT NOT NULL DEFAULT '',
  sugar_g         TEXT NOT NULL DEFAULT '',
  added_sugar_g   TEXT NOT NULL DEFAULT ''
);
