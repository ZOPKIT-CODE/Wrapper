-- Enable Row-Level Security (RLS) on all tenant-scoped tables.
-- Policies filter rows by current_setting('app.tenant_id', true), which
-- is set per-request by the Fastify onRequest hook in app-fastify.ts.
--
-- NOTE: The Supabase service role has BYPASSRLS, so these policies are
-- enforced at the application layer as defense-in-depth. To enforce at
-- the DB layer too, use FORCE ROW LEVEL SECURITY after switching to a
-- restricted Postgres role for app queries.
--
-- Tables covered: all 17 tenant-scoped tables.

-- Helper function: returns current tenant UUID from session config.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true)::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

-- ── tenants ───────────────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_tenant_isolation ON tenants;
CREATE POLICY tenants_tenant_isolation ON tenants
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── tenant_users ──────────────────────────────────────────────────────────
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_users_tenant_isolation ON tenant_users;
CREATE POLICY tenant_users_tenant_isolation ON tenant_users
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── entities ──────────────────────────────────────────────────────────────
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entities_tenant_isolation ON entities;
CREATE POLICY entities_tenant_isolation ON entities
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── organization_memberships ──────────────────────────────────────────────
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_memberships_tenant_isolation ON organization_memberships;
CREATE POLICY organization_memberships_tenant_isolation ON organization_memberships
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── custom_roles ──────────────────────────────────────────────────────────
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_roles_tenant_isolation ON custom_roles;
CREATE POLICY custom_roles_tenant_isolation ON custom_roles
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── user_role_assignments ─────────────────────────────────────────────────
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_role_assignments_tenant_isolation ON user_role_assignments;
-- user_role_assignments has no tenant_id column; isolate via custom_roles join.
-- Use a function-based check to avoid a subquery in the policy expression.
CREATE POLICY user_role_assignments_tenant_isolation ON user_role_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM custom_roles cr
      WHERE cr.role_id = user_role_assignments.role_id
        AND cr.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

-- ── subscriptions ─────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_tenant_isolation ON subscriptions;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── payments ──────────────────────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_tenant_isolation ON payments;
CREATE POLICY payments_tenant_isolation ON payments
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── credits ───────────────────────────────────────────────────────────────
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credits_tenant_isolation ON credits;
CREATE POLICY credits_tenant_isolation ON credits
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── credit_transactions ───────────────────────────────────────────────────
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_transactions_tenant_isolation ON credit_transactions;
CREATE POLICY credit_transactions_tenant_isolation ON credit_transactions
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── credit_configurations ─────────────────────────────────────────────────
ALTER TABLE credit_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_configurations_tenant_isolation ON credit_configurations;
CREATE POLICY credit_configurations_tenant_isolation ON credit_configurations
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── credit_purchases ──────────────────────────────────────────────────────
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_purchases_tenant_isolation ON credit_purchases;
CREATE POLICY credit_purchases_tenant_isolation ON credit_purchases
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── tenant_invitations ────────────────────────────────────────────────────
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_invitations_tenant_isolation ON tenant_invitations;
CREATE POLICY tenant_invitations_tenant_isolation ON tenant_invitations
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── notifications ─────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
CREATE POLICY notifications_tenant_isolation ON notifications
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── audit_logs ────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── event_tracking ────────────────────────────────────────────────────────
ALTER TABLE event_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_tracking_tenant_isolation ON event_tracking;
CREATE POLICY event_tracking_tenant_isolation ON event_tracking
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ── seasonal_credits ──────────────────────────────────────────────────────
ALTER TABLE seasonal_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seasonal_credits_tenant_isolation ON seasonal_credits;
CREATE POLICY seasonal_credits_tenant_isolation ON seasonal_credits
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
