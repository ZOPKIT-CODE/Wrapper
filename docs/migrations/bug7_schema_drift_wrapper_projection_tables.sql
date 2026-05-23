-- Bug 7: Cross-app schema drift in projection tables that mirror wrapper state.
--
-- Decision: standardise on the wrapper's authoritative types.
--   tenant_id        uuid          (wrapper.tenants.tenant_id type)
--   entity_id        uuid          (wrapper.entities.entity_id)
--   role_id          uuid          (wrapper.custom_roles.role_id)
--   user_id          uuid          (wrapper.tenant_users.user_id)
--   parent_entity_id uuid
--
-- Apply against FA (text-typed) and audit CRM. Mostly idempotent; column type
-- changes require explicit USING casts.
--
-- REVIEW BEFORE APPLYING. Apply per-database (CRM, FA) selectively.

BEGIN;

-- ── FA: align tenant_id columns to uuid ─────────────────────────────────────
ALTER TABLE tenants                 ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
ALTER TABLE tenant_users            ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
ALTER TABLE tenant_sync_status      ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
ALTER TABLE wrapper_onboarding_snapshots ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
ALTER TABLE wrapper_role_assignments ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
ALTER TABLE wrapper_roles           ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;

-- ── FA: align identifier columns to uuid ───────────────────────────────────
ALTER TABLE wrapper_entities         ALTER COLUMN parent_entity_id TYPE uuid USING parent_entity_id::uuid;
ALTER TABLE wrapper_roles            ALTER COLUMN role_id          TYPE uuid USING role_id::uuid;
ALTER TABLE wrapper_role_assignments
  RENAME COLUMN role_id_string TO role_id;
ALTER TABLE wrapper_role_assignments ALTER COLUMN role_id          TYPE uuid USING role_id::uuid;

-- ── Soft-delete vs is_active reconciliation ────────────────────────────────
-- CRM uses is_deleted + deleted_at; FA uses is_active. Standardise on CRM
-- shape (deleted_at is more expressive). FA backfill:
ALTER TABLE wrapper_roles
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
UPDATE wrapper_roles SET is_deleted = NOT COALESCE(is_active, true) WHERE is_deleted IS NULL;
-- ALTER TABLE wrapper_roles DROP COLUMN IF EXISTS is_active;  -- drop after app cutover

COMMIT;
