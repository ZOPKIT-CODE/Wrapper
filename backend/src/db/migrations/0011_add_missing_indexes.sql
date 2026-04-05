-- Performance indexes missing from initial schema.
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_tenant_id ON organization_memberships (tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_entity_id ON organization_memberships (entity_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_entity ON organization_memberships (user_id, entity_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_tenants_admin_email ON tenants (admin_email);
CREATE INDEX IF NOT EXISTS idx_tenants_kinde_org_id ON tenants (kinde_org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status ON subscriptions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant_entity ON credit_transactions (tenant_id, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_roles_tenant_id ON custom_roles (tenant_id);
