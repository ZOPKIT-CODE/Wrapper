-- Durable audit log of every event received from CRM/FA via SQS.
-- Inserted before the handler dispatch in sqs-consumer.ts so events
-- are never silently dropped, regardless of handler implementation.
-- The UNIQUE constraint on event_id makes redelivery idempotent.

CREATE TABLE IF NOT EXISTS received_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  source_application TEXT NOT NULL,
  target_application TEXT NOT NULL,
  tenant_id UUID,
  entity_id TEXT,
  correlation_id TEXT,
  causation_id TEXT,
  schema_version TEXT,
  payload JSONB NOT NULL,
  raw_envelope JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handler_status TEXT NOT NULL DEFAULT 'pending', -- pending | processed | skipped | failed
  handler_error TEXT,
  processed_at TIMESTAMPTZ,
  receive_count INT NOT NULL DEFAULT 1,
  sqs_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_received_events_tenant ON received_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_received_events_type ON received_events(event_type);
CREATE INDEX IF NOT EXISTS idx_received_events_received_at ON received_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_received_events_status ON received_events(handler_status) WHERE handler_status != 'processed';
