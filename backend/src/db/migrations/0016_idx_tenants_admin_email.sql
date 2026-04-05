-- perf: index on tenants.admin_email to avoid sequential scan during onboarding duplicate check.
-- Without this index, checkForDuplicates() does a full table scan taking ~1,200ms.
-- Wrapped in a DO block so it is safe to run with limited Supabase migration roles.

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_tenants_admin_email
      ON tenants (admin_email);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Skipping idx_tenants_admin_email: insufficient privilege';
END;
$$;
