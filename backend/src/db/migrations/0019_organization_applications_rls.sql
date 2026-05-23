-- Enable RLS on organization_applications, which was omitted from
-- 0014_enable_rls_tenant_isolation.sql.  Without this, a null app.tenant_id
-- session variable returns 0 rows silently instead of an auth error, making
-- the frontend race condition invisible.

DO $$ BEGIN
  BEGIN
    ALTER TABLE organization_applications ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping RLS enable on organization_applications — insufficient privilege (apply manually as superuser)';
  END;

  BEGIN
    DROP POLICY IF EXISTS organization_applications_tenant_isolation ON organization_applications;
    CREATE POLICY organization_applications_tenant_isolation
      ON organization_applications
      FOR ALL
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping policy on organization_applications — insufficient privilege (apply manually as superuser)';
  END;
END $$;
