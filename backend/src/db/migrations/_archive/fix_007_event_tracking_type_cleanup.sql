-- M007: Fix event_tracking.tenant_id and entity_id TEXT → UUID.
-- Pre-flight: 0 rows with non-UUID tenant_id values confirmed.
-- Drops old overlapping tenant indexes, recreates on correctly-typed columns.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_event_tracking_tenant_id;
--   DROP INDEX IF EXISTS idx_event_tracking_tenant_type_created;
--   ALTER TABLE event_tracking ALTER COLUMN tenant_id TYPE text USING tenant_id::text;
--   ALTER TABLE event_tracking ALTER COLUMN entity_id TYPE text USING entity_id::text;
--   CREATE INDEX event_tracking_tenant_id_idx ON event_tracking (tenant_id);
--   CREATE INDEX idx_event_tracking_tenant ON event_tracking (tenant_id);
--   CREATE INDEX event_tracking_tenant_type_idx ON event_tracking (tenant_id, event_type, created_at DESC);

DROP INDEX IF EXISTS event_tracking_tenant_id_idx;
DROP INDEX IF EXISTS idx_event_tracking_tenant;
DROP INDEX IF EXISTS event_tracking_tenant_type_idx;

ALTER TABLE event_tracking
  ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;

ALTER TABLE event_tracking
  ALTER COLUMN entity_id TYPE uuid USING entity_id::uuid;

CREATE INDEX idx_event_tracking_tenant_id
  ON event_tracking (tenant_id);

CREATE INDEX idx_event_tracking_tenant_type_created
  ON event_tracking (tenant_id, event_type, created_at DESC);
