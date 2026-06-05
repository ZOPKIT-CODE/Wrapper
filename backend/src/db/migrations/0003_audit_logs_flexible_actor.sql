-- audit_logs.user_id records the ACTOR of an action, but the app uses actors that
-- aren't tenant_users rows: a 'system' string placeholder for background/admin
-- operations, and ids for platform staff / since-deleted users. prod's strict
-- `user_id uuid` + FK to tenant_users(user_id) rejects both — prod's audit table is
-- effectively unused so it never fired, but the first admin/system audit write would.
--
-- Audit logs are append-only action records, so the correct model is a flexible
-- varchar actor with NO FK (this is exactly what the old test-only shim simulated).
-- Drop the FK and widen the column. Idempotent + safe (existing uuids cast to text).

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_tenant_users_user_id_fk;
ALTER TABLE audit_logs ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;
