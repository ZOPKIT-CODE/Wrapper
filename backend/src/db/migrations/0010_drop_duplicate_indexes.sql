-- Drop duplicate unique constraint and redundant indexes on event_tracking.
-- The event_tracking_event_id_key unique index (backing the PRIMARY constraint) is kept.
ALTER TABLE event_tracking DROP CONSTRAINT IF EXISTS event_tracking_event_id_unique;
DROP INDEX IF EXISTS idx_event_tracking_event_id;
DROP INDEX IF EXISTS event_tracking_event_id_idx;
DROP INDEX IF EXISTS idx_event_tracking_status;
DROP INDEX IF EXISTS idx_event_tracking_published_at;
DROP INDEX IF EXISTS idx_event_tracking_target_app;
DROP INDEX IF EXISTS idx_event_tracking_source_app;
DROP INDEX IF EXISTS idx_event_tracking_acknowledged;
DROP INDEX IF EXISTS idx_event_tracking_acknowledged_at;
