-- The home dashboard's backlog (one-off to-dos), for the `backlog` entry in
-- worker.js TABLES. Apply once: npx wrangler d1 execute pasion-db --remote --file=backlog.sql
-- due is '', a local YYYY-MM-DD, or a local YYYY-MM-DDTHH:mm.
CREATE TABLE IF NOT EXISTS backlog (
  item_id    TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  due        TEXT NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);
