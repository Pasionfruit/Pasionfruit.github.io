-- The Tasks page's section layout, for the `tasks_layout` entry in worker.js TABLES.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=tasks_layout.sql
-- item_id is the Todoist section id, so each section has at most one row. Todoist
-- still owns the tasks and sections; this only stores the order and what is hidden.
CREATE TABLE IF NOT EXISTS tasks_layout (
  item_id    TEXT PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT '',
  position   REAL NOT NULL DEFAULT 0,
  hidden     INTEGER NOT NULL DEFAULT 0
);
