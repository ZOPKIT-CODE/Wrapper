-- platform_staff.granted_by and revoked_by previously referenced tenant_users.user_id,
-- coupling the platform plane to the tenant plane. Dropped to keep them separate pools.
-- The UUID values are retained as plain audit references.
ALTER TABLE platform_staff
  DROP CONSTRAINT platform_staff_granted_by_fkey,
  DROP CONSTRAINT platform_staff_revoked_by_fkey,
  ALTER COLUMN granted_by DROP NOT NULL;
