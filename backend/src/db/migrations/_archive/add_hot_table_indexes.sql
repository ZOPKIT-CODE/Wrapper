-- Hot-path indexes for auth, audit, and billing lookups.
-- Safe to run repeatedly in each environment.

-- tenant_users: frequent auth and user lookups
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id
ON tenant_users(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_users_email
ON tenant_users(email);

CREATE INDEX IF NOT EXISTS idx_tenant_users_kinde_user_id
ON tenant_users(kinde_user_id);

-- audit_logs: tenant-scoped compliance and time-window queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id
ON audit_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at
ON audit_logs(tenant_id, created_at DESC);

-- payments: tenant billing history and timeline queries
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id
ON payments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_created_at
ON payments(tenant_id, created_at DESC);
