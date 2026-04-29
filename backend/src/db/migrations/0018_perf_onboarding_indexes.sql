-- Migration 0018: Performance indexes for onboarding hot path
-- Onboarding does two critical lookups by Kinde IDs:
--   1. tenants.kinde_org_id  (check if already onboarded)
--   2. tenant_users.kinde_user_id (resolve user during auth)
-- Migration 0008 tried to create these but failed with insufficient_privilege
-- on the Supabase DB role.  We retry here with a DO block that silently skips
-- if the index already exists (CREATE INDEX IF NOT EXISTS is idempotent).

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    CREATE INDEX IF NOT EXISTS idx_tenants_kinde_org_id
      ON tenants (kinde_org_id)
      WHERE kinde_org_id IS NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_users') THEN
    CREATE INDEX IF NOT EXISTS idx_tenant_users_kinde_user_id
      ON tenant_users (kinde_user_id)
      WHERE kinde_user_id IS NOT NULL;
  END IF;
END $$;
