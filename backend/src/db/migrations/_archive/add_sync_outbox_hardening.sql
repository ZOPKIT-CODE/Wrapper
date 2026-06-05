-- Migration: Outbox Hardening for Sync Events
--
-- The event_tracking table already serves as the transactional outbox.
-- These indexes speed up the outbox replay worker polling query and
-- tenant/event-type lookups used by the inter-app event service.

-- Speed up the replay worker's primary query:
--   SELECT ... FROM event_tracking
--   WHERE status IN ('pending','failed') AND retry_count < maxRetries
--   ORDER BY published_at ASC
--   LIMIT batchSize
CREATE INDEX IF NOT EXISTS event_tracking_replay_idx
  ON event_tracking(status, retry_count, published_at)
  WHERE status IN ('pending', 'failed');

-- Speed up tenant-specific event lookups and per-tenant event history queries.
CREATE INDEX IF NOT EXISTS event_tracking_tenant_type_idx
  ON event_tracking(tenant_id, event_type, created_at DESC);

-- Speed up target-application filtering (e.g. all events destined for 'accounting').
CREATE INDEX IF NOT EXISTS event_tracking_target_app_idx
  ON event_tracking(target_application, status)
  WHERE status IN ('pending', 'failed');

-- Speed up acknowledgment status checks for the communication matrix dashboard.
CREATE INDEX IF NOT EXISTS event_tracking_acknowledged_idx
  ON event_tracking(acknowledged, target_application, created_at DESC)
  WHERE acknowledged = false;
