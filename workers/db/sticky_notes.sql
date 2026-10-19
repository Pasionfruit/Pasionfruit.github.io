-- The Ciara page's sticky notes, for the `sticky_notes` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=sticky_notes.sql
-- note_id is the colour, so there is exactly one note of each.
CREATE TABLE IF NOT EXISTS sticky_notes (
  note_id    TEXT PRIMARY KEY,
  color      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
