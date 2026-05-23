-- Credit category snapshot cache.
-- Stores the pre-computed free/paid/seasonal breakdown per tenant-entity pair.
-- Invalidated on any credit write; 5-minute TTL as a safety net.
CREATE TABLE IF NOT EXISTS credit_category_snapshots (
  snapshot_id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid         NOT NULL REFERENCES tenants(tenant_id),
  entity_id               uuid         NOT NULL REFERENCES entities(entity_id),
  free_credits            decimal(15,4) NOT NULL DEFAULT 0,
  paid_credits            decimal(15,4) NOT NULL DEFAULT 0,
  seasonal_credits        decimal(15,4) NOT NULL DEFAULT 0,
  free_credits_expiry     timestamptz,
  paid_credits_expiry     timestamptz,
  seasonal_credits_expiry timestamptz,
  subscription_expiry     timestamptz,
  application_expiry_dates jsonb        NOT NULL DEFAULT '{}',
  subscription_plan        jsonb        NOT NULL DEFAULT '"credit_based"',
  computed_at             timestamptz  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_credit_snapshot_tenant_entity UNIQUE (tenant_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_snapshots_tenant_entity
  ON credit_category_snapshots (tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_credit_snapshots_computed_at
  ON credit_category_snapshots (computed_at);
