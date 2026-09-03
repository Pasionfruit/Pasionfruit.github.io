-- Schema for the `ace-system` D1 database (machine health heartbeats).
--
-- Safe to re-run — every statement is IF NOT EXISTS:
--   cd workers/ace && npx wrangler d1 execute ace-system --remote --file schema.sql

CREATE TABLE IF NOT EXISTS samples (
  machine       TEXT NOT NULL,
  at            INTEGER NOT NULL,
  cpu           REAL,
  ram_used_gb   REAL,
  ram_total_gb  REAL,
  disk_used_gb  REAL,
  disk_total_gb REAL,
  gpu           TEXT,
  uptime_s      INTEGER,
  services      TEXT,
  mc_state      TEXT,
  PRIMARY KEY (machine, at)
);

CREATE INDEX IF NOT EXISTS idx_samples_machine_at ON samples (machine, at DESC);

-- Queries that filter on `at` alone — the retention delete and the 24h history
-- read — have no usable index without this and fall back to scanning the whole
-- table. At a sample a minute per machine that cost tens of millions of rows
-- read a day against a table holding a few thousand.
--
-- The trailing columns are what the history query selects, which makes that
-- query index-only. They are the reason it names this index explicitly with
-- INDEXED BY: left to itself the planner scans idx_samples_machine_at end to
-- end, since it has to sort for the GROUP BY either way and does not weigh the
-- rows that scan touches. Renaming this index will break that query loudly,
-- which is the intent — silently reverting to a full scan is what this whole
-- index exists to prevent.
CREATE INDEX IF NOT EXISTS idx_samples_at ON samples (at, machine, cpu, ram_used_gb);

-- The newest sample per machine, written by the heartbeat alongside `samples`.
-- Deriving it instead (MAX(at) ... GROUP BY machine) read every row in the
-- table on every dashboard poll; reading it here is one row per machine.
--
-- It is deliberately never pruned: a machine that has been off longer than the
-- sample retention still shows its last known state, which the derived query
-- lost as soon as its samples aged out.
CREATE TABLE IF NOT EXISTS machine_latest (
  machine       TEXT PRIMARY KEY,
  at            INTEGER NOT NULL,
  cpu           REAL,
  ram_used_gb   REAL,
  ram_total_gb  REAL,
  disk_used_gb  REAL,
  disk_total_gb REAL,
  gpu           TEXT,
  uptime_s      INTEGER,
  services      TEXT,
  mc_state      TEXT
);
