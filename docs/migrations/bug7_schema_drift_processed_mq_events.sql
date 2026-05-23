-- Bug 7: processed_mq_events schema drift between CRM and FA.
--
-- CRM:   event_id PK, message_id, event_type, state, tenant_id (text), processed_at,
--        failed_reason, created_at, updated_at
-- FA:    id (uuid PK), event_id, event_type, result, processed_at, created_at
--
-- Decision: standardise on CRM shape — it carries strictly more diagnostic info
-- (state machine, failure reason, source message_id, tenant scope). Drop the FA-specific
-- `id` PK in favour of event_id PK to match CRM and enforce true idempotency.
--
-- REVIEW BEFORE APPLYING. Apply against FA database only.

BEGIN;

ALTER TABLE processed_mq_events
  ADD COLUMN IF NOT EXISTS message_id    text,
  ADD COLUMN IF NOT EXISTS state         text,
  ADD COLUMN IF NOT EXISTS tenant_id     text,
  ADD COLUMN IF NOT EXISTS failed_reason text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT now();

-- Backfill state from legacy result column ('processed' | 'processing' | 'failed').
UPDATE processed_mq_events SET state = result WHERE state IS NULL;

-- Swap PK from id → event_id to enforce idempotency at the DB layer.
ALTER TABLE processed_mq_events DROP CONSTRAINT IF EXISTS processed_mq_events_pkey;
ALTER TABLE processed_mq_events ADD CONSTRAINT processed_mq_events_pkey PRIMARY KEY (event_id);

-- Retire legacy columns AFTER application code is updated to read `state`.
-- ALTER TABLE processed_mq_events DROP COLUMN IF EXISTS result;
-- ALTER TABLE processed_mq_events DROP COLUMN IF EXISTS id;

COMMIT;
