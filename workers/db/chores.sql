-- The home dashboard's chore list, for the `chores` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=chores.sql
-- category is one of kitchen, laundry, hygiene, cats, technical. last_done is a
-- local YYYY-MM-DD, empty until the chore is first completed. A chore is overdue
-- once last_done + interval_days is in the past.
CREATE TABLE IF NOT EXISTS chores (
  chore_id      TEXT PRIMARY KEY,
  name          TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  interval_days REAL NOT NULL DEFAULT 7,
  last_done     TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT ''
);
