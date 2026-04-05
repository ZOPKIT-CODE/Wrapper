-- fix_018: Drop three redundant tables:
--   webhook_logs              — WebhookProcessor never called; idempotency handled by event_tracking
--   user_sessions             — never written to; auth is Kinde-managed
--   user_application_permissions — never enforced in auth middleware; custom_roles.permissions is the only enforced layer
--
-- ROLLBACK: None of these tables contained live data or enforced business logic.

DROP TABLE IF EXISTS webhook_logs;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS user_application_permissions;
