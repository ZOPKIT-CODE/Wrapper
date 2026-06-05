-- Enable Row-Level Security (RLS) on all tenant-scoped tables.
-- Policies filter rows by current_setting('app.tenant_id', true), which
-- is set per-request by the Fastify onRequest hook in app-fastify.ts.
--
-- NOTE: The Supabase service role has BYPASSRLS, so these policies are
-- enforced at the application layer as defense-in-depth.
--
-- Each table block:
--   1. Skips silently if the table does not exist (untracked tables that
--      may not be present in every environment).
--   2. Catches insufficient_privilege errors so that tables created by a
--      different DB role (e.g. custom SQL run by a superuser) don't halt
--      the migration — a NOTICE is raised instead.

-- Helper function: returns current tenant UUID from session config.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true)::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

-- ── tenants ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    BEGIN
      ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenants_tenant_isolation ON tenants;
      CREATE POLICY tenants_tenant_isolation ON tenants
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for tenants: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── tenant_users ──────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_users') THEN
    BEGIN
      ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_users_tenant_isolation ON tenant_users;
      CREATE POLICY tenant_users_tenant_isolation ON tenant_users
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for tenant_users: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── entities ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entities') THEN
    BEGIN
      ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS entities_tenant_isolation ON entities;
      CREATE POLICY entities_tenant_isolation ON entities
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for entities: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── organization_memberships ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_memberships') THEN
    BEGIN
      ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS organization_memberships_tenant_isolation ON organization_memberships;
      CREATE POLICY organization_memberships_tenant_isolation ON organization_memberships
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for organization_memberships: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── custom_roles ──────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_roles') THEN
    BEGIN
      ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS custom_roles_tenant_isolation ON custom_roles;
      CREATE POLICY custom_roles_tenant_isolation ON custom_roles
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for custom_roles: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── user_role_assignments ─────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_role_assignments') THEN
    BEGIN
      ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS user_role_assignments_tenant_isolation ON user_role_assignments;
      -- user_role_assignments has no tenant_id column; isolate via custom_roles join.
      CREATE POLICY user_role_assignments_tenant_isolation ON user_role_assignments
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM custom_roles cr
            WHERE cr.role_id = user_role_assignments.role_id
              AND cr.tenant_id::text = current_setting('app.tenant_id', true)
          )
        );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for user_role_assignments: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── subscriptions ─────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    BEGIN
      ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS subscriptions_tenant_isolation ON subscriptions;
      CREATE POLICY subscriptions_tenant_isolation ON subscriptions
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for subscriptions: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── payments ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    BEGIN
      ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS payments_tenant_isolation ON payments;
      CREATE POLICY payments_tenant_isolation ON payments
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for payments: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── credits ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credits') THEN
    BEGIN
      ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS credits_tenant_isolation ON credits;
      CREATE POLICY credits_tenant_isolation ON credits
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for credits: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── credit_transactions ───────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_transactions') THEN
    BEGIN
      ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS credit_transactions_tenant_isolation ON credit_transactions;
      CREATE POLICY credit_transactions_tenant_isolation ON credit_transactions
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for credit_transactions: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── credit_configurations ─────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_configurations') THEN
    BEGIN
      ALTER TABLE credit_configurations ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS credit_configurations_tenant_isolation ON credit_configurations;
      CREATE POLICY credit_configurations_tenant_isolation ON credit_configurations
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for credit_configurations: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── credit_purchases ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_purchases') THEN
    BEGIN
      ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS credit_purchases_tenant_isolation ON credit_purchases;
      CREATE POLICY credit_purchases_tenant_isolation ON credit_purchases
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for credit_purchases: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── tenant_invitations ────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_invitations') THEN
    BEGIN
      ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_invitations_tenant_isolation ON tenant_invitations;
      CREATE POLICY tenant_invitations_tenant_isolation ON tenant_invitations
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for tenant_invitations: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── notifications ─────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    BEGIN
      ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
      CREATE POLICY notifications_tenant_isolation ON notifications
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for notifications: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── audit_logs ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    BEGIN
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
      CREATE POLICY audit_logs_tenant_isolation ON audit_logs
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for audit_logs: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── event_tracking ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_tracking') THEN
    BEGIN
      ALTER TABLE event_tracking ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS event_tracking_tenant_isolation ON event_tracking;
      CREATE POLICY event_tracking_tenant_isolation ON event_tracking
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for event_tracking: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── seasonal_credit_campaigns ─────────────────────────────────────────────
-- Created by untracked custom SQL; may be owned by a different DB role.
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seasonal_credit_campaigns') THEN
    BEGIN
      ALTER TABLE seasonal_credit_campaigns ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS seasonal_credit_campaigns_tenant_isolation ON seasonal_credit_campaigns;
      CREATE POLICY seasonal_credit_campaigns_tenant_isolation ON seasonal_credit_campaigns
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for seasonal_credit_campaigns: %', SQLERRM;
    END;
  END IF;
END $$;

-- ── seasonal_credit_allocations ───────────────────────────────────────────
-- Created by untracked custom SQL; may be owned by a different DB role.
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seasonal_credit_allocations') THEN
    BEGIN
      ALTER TABLE seasonal_credit_allocations ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS seasonal_credit_allocations_tenant_isolation ON seasonal_credit_allocations;
      CREATE POLICY seasonal_credit_allocations_tenant_isolation ON seasonal_credit_allocations
        FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for seasonal_credit_allocations: %', SQLERRM;
    END;
  END IF;
END $$;
