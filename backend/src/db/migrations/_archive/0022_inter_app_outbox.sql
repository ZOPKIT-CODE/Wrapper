-- Inter-app event outbox (transactional outbox pattern).
--
-- Buffers SNS inter-app events so that when the SNS circuit breaker opens
-- (5 failures in 5 min), events are NOT dropped: they sit here durably with
-- published_at IS NULL until the outbox poller (single instance via advisory
-- lock 8001) picks them up and retries SNS publish.
--
-- The "fast path" still publishes to SNS immediately inside enqueueEvent();
-- the poller only acts as a retry/recovery layer when the fast path fails.
CREATE TABLE IF NOT EXISTS inter_app_outbox (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            text          NOT NULL,
  event_type          text          NOT NULL,
  target_application  text          NOT NULL,
  payload             jsonb         NOT NULL,
  message_attributes  jsonb,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  published_at        timestamptz,
  attempt_count       integer       NOT NULL DEFAULT 0,
  last_attempt_at     timestamptz,
  last_error          text,
  CONSTRAINT inter_app_outbox_event_id_unique UNIQUE (event_id)
);

-- Partial index — the poller only ever scans unpublished rows.
CREATE INDEX IF NOT EXISTS idx_inter_app_outbox_unpublished
  ON inter_app_outbox (created_at)
  WHERE published_at IS NULL;
