-- Platform staff access control tables + missing billing indexes
-- Created: 2026-03-14
-- Safe to run repeatedly (uses IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)

-- ─────────────────────────────────────────────────────────────────────────────
-- PLATFORM STAFF
--
-- Internal operators (support, billing ops) who need cross-tenant write access
-- to a specific set of operations.  Access is time-limited (max 30 days) and
-- fully revocable.  Every write action is captured in platform_audit_logs.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_staff (
  staff_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kinde_user_id      VARCHAR(255) NOT NULL UNIQUE,
  email              VARCHAR(255) NOT NULL,
  name               VARCHAR(255) NOT NULL,
  -- Array of PlatformPermission values, e.g. {credit_config:read, org_assignments:write}
  granted_permissions TEXT[]       NOT NULL,
  granted_by         UUID         NOT NULL REFERENCES tenant_users(user_id),
  granted_at         TIMESTAMP    NOT NULL DEFAULT now(),
  -- Access MUST expire.  Max 30 days enforced at the application layer.
  expires_at         TIMESTAMP    NOT NULL,
  reason             TEXT         NOT NULL,
  -- Set to false to revoke instantly without waiting for expiry.
  is_active          BOOLEAN      NOT NULL DEFAULT true,
  revoked_by         UUID         REFERENCES tenant_users(user_id),
  revoked_at         TIMESTAMP,
  revoked_reason     TEXT,
  created_at         TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_staff_kinde_user_id
  ON platform_staff(kinde_user_id);

CREATE INDEX IF NOT EXISTS idx_platform_staff_active
  ON platform_staff(is_active, expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- PLATFORM AUDIT LOGS
--
-- Immutable log of every action taken by a platform staff member.
-- Rows are NEVER deleted — this is the legal audit trail.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  audit_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who did this
  staff_id           UUID        NOT NULL REFERENCES platform_staff(staff_id),
  kinde_user_id      VARCHAR(255) NOT NULL,
  staff_email        VARCHAR(255) NOT NULL,
  -- What they did
  action             VARCHAR(100) NOT NULL,
  -- Which tenant was affected
  target_tenant_id   UUID         NOT NULL,
  -- Which specific resource
  target_resource    VARCHAR(100) NOT NULL,
  target_resource_id VARCHAR(255),
  -- Full HTTP context
  request_path       VARCHAR(500) NOT NULL,
  request_method     VARCHAR(10)  NOT NULL,
  -- Before/after state snapshot (NULL for read-only actions)
  changes_before     TEXT,  -- JSON string
  changes_after      TEXT,  -- JSON string
  -- Network context
  ip_address         VARCHAR(45),
  user_agent         TEXT,
  -- Immutable timestamp
  created_at         TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_staff_id
  ON platform_audit_logs(staff_id);

CREATE INDEX IF NOT EXISTS idx_platform_audit_target_tenant
  ON platform_audit_logs(target_tenant_id);

CREATE INDEX IF NOT EXISTS idx_platform_audit_action
  ON platform_audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_platform_audit_created_at
  ON platform_audit_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- BILLING INDEXES  (missing from earlier migrations)
-- ─────────────────────────────────────────────────────────────────────────────

-- subscriptions: lookup by tenantId alone (no status filter)
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id
  ON subscriptions(tenant_id);

-- subscriptions: Stripe webhook lookups by stripe_subscription_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
  ON subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- payments: JOIN from subscriptions → payments
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id
  ON payments(subscription_id)
  WHERE subscription_id IS NOT NULL;

-- payments: Stripe webhook deduplication by payment_intent_id
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent
  ON payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ANALYZE platform_staff;
ANALYZE platform_audit_logs;
ANALYZE subscriptions;
ANALYZE payments;
