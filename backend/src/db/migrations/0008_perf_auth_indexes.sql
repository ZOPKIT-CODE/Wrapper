-- perf: performance indexes for high-frequency auth and billing queries
-- Wrapped in DO blocks so the migration succeeds even when the migration
-- user does not own the tables (e.g. Supabase with a limited migration role).
-- The indexes are best-effort — missing indexes degrade performance but do
-- not break correctness.  A superuser can create them manually if needed.

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_tenant_users_kinde_user_id
      ON tenant_users (kinde_user_id);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Skipping idx_tenant_users_kinde_user_id: insufficient privilege';
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_tenants_kinde_org_id
      ON tenants (kinde_org_id);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Skipping idx_tenants_kinde_org_id: insufficient privilege';
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_status
      ON tenant_users (tenant_id, is_active);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Skipping idx_tenant_users_tenant_status: insufficient privilege';
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status_created
      ON subscriptions (tenant_id, status, created_at DESC);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Skipping idx_subscriptions_tenant_status_created: insufficient privilege';
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_tenant_created
      ON payments (tenant_id, created_at DESC);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Skipping idx_payments_tenant_created: insufficient privilege';
END;
$$;
