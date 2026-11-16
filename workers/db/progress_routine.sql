-- Adds towel / sheets / mask to a progress_checkins table created before they existed.
-- Apply once: npx wrangler d1 execute pasion-db --remote --file=progress_routine.sql
ALTER TABLE progress_checkins ADD COLUMN towel TEXT NOT NULL DEFAULT '';
ALTER TABLE progress_checkins ADD COLUMN sheets TEXT NOT NULL DEFAULT '';
ALTER TABLE progress_checkins ADD COLUMN mask TEXT NOT NULL DEFAULT '';
