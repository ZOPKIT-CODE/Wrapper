-- M009: Backfill custom_roles.organization_id NULLs + enforce consistency.
-- Pre-flight: 3 rows where organization_id IS NULL but tenant_id is set.
-- These rows were created via a code path that populated tenant_id only.
--
-- Step 1: Backfill the 3 rows (organization_id = tenant_id).
-- Step 2: Add CHECK to enforce parity going forward.
--         The column is NOT dropped here — it is still referenced in service
--         queries. Drop it after removing those references from application code
--         using migration fix_009b_drop_custom_roles_org_id.sql (to be created
--         after the code change).
--
-- ROLLBACK:
--   ALTER TABLE custom_roles DROP CONSTRAINT chk_org_id_matches_tenant_id;
--   -- The 3 backfilled rows retain organization_id = tenant_id (correct value).

UPDATE custom_roles
SET organization_id = tenant_id
WHERE organization_id IS NULL AND tenant_id IS NOT NULL;

ALTER TABLE custom_roles
  ADD CONSTRAINT chk_org_id_matches_tenant_id
    CHECK (organization_id IS NULL OR organization_id = tenant_id);
