-- Ensure strict parity for event_tracking partial indexes.
-- Recreate with exact production predicates.

DROP INDEX IF EXISTS event_tracking_acknowledged_idx;
CREATE INDEX IF NOT EXISTS event_tracking_acknowledged_idx
ON event_tracking(acknowledged, target_application, created_at DESC)
WHERE acknowledged = false;

DROP INDEX IF EXISTS event_tracking_replay_idx;
CREATE INDEX IF NOT EXISTS event_tracking_replay_idx
ON event_tracking(status, retry_count, published_at)
WHERE status IN ('pending', 'failed');

DROP INDEX IF EXISTS event_tracking_target_app_idx;
CREATE INDEX IF NOT EXISTS event_tracking_target_app_idx
ON event_tracking(target_application, status)
WHERE status IN ('pending', 'failed');
