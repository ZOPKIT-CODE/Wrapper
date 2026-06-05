-- Strict parity for partial/filtered index semantics not fully expressible in schema DSL.

-- change_log
DROP INDEX IF EXISTS idx_change_log_unprocessed;
CREATE INDEX IF NOT EXISTS idx_change_log_unprocessed
ON change_log(processed)
WHERE processed = false;

-- credit_configurations
DROP INDEX IF EXISTS unique_global_credit_config;
CREATE UNIQUE INDEX IF NOT EXISTS unique_global_credit_config
ON credit_configurations(operation_code)
WHERE tenant_id IS NULL;

DROP INDEX IF EXISTS unique_tenant_credit_config;
CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_credit_config
ON credit_configurations(tenant_id, operation_code)
WHERE tenant_id IS NOT NULL;

-- tenant_invitations
DROP INDEX IF EXISTS idx_tenant_invitations_pending_multi;
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_pending_multi
ON tenant_invitations(invitation_token, expires_at)
WHERE status = 'pending' AND invitation_scope = 'multi-entity';

-- seasonal_credit_allocations
DROP INDEX IF EXISTS idx_seasonal_allocations_target_app;
CREATE INDEX IF NOT EXISTS idx_seasonal_allocations_target_app
ON seasonal_credit_allocations(target_application)
WHERE target_application IS NOT NULL;

DROP INDEX IF EXISTS idx_seasonal_allocations_expiry;
CREATE INDEX IF NOT EXISTS idx_seasonal_allocations_expiry
ON seasonal_credit_allocations(expires_at, is_active, is_expired)
WHERE is_active = true AND is_expired = false;

DROP INDEX IF EXISTS idx_seasonal_allocations_expiry_app;
CREATE INDEX IF NOT EXISTS idx_seasonal_allocations_expiry_app
ON seasonal_credit_allocations(expires_at, target_application, is_active, is_expired)
WHERE is_active = true AND is_expired = false;

-- tenants
DROP INDEX IF EXISTS idx_tenants_bank_name;
CREATE INDEX IF NOT EXISTS idx_tenants_bank_name
ON tenants(bank_name)
WHERE bank_name IS NOT NULL;

DROP INDEX IF EXISTS idx_tenants_billing_email;
CREATE INDEX IF NOT EXISTS idx_tenants_billing_email
ON tenants(billing_email)
WHERE billing_email IS NOT NULL;

DROP INDEX IF EXISTS idx_tenants_support_email;
CREATE INDEX IF NOT EXISTS idx_tenants_support_email
ON tenants(support_email)
WHERE support_email IS NOT NULL;

DROP INDEX IF EXISTS idx_tenants_tax_exempt_status;
CREATE INDEX IF NOT EXISTS idx_tenants_tax_exempt_status
ON tenants(tax_exempt_status)
WHERE tax_exempt_status = true;

DROP INDEX IF EXISTS idx_tenants_tax_residence_country;
CREATE INDEX IF NOT EXISTS idx_tenants_tax_residence_country
ON tenants(tax_residence_country)
WHERE tax_residence_country IS NOT NULL;
