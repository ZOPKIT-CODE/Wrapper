-- M005: Drop onboarding_events.event_timestamp (duplicate of created_at).
-- Both columns carried identical now() values at insert time.
-- created_at is the canonical event timestamp going forward.
--
-- ROLLBACK:
--   ALTER TABLE onboarding_events
--     ADD COLUMN event_timestamp timestamp without time zone DEFAULT now();

ALTER TABLE onboarding_events DROP COLUMN event_timestamp;
