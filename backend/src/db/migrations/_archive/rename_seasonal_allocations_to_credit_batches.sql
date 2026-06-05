-- Rename seasonal_credit_allocations → credit_batches
-- The table already tracks all credit types (seasonal, free, paid) and both
-- org-pool and app-level batches. The old name was a legacy artefact.

ALTER TABLE seasonal_credit_allocations RENAME TO credit_batches;

-- Rename indexes to match the new table name
ALTER INDEX IF EXISTS idx_seasonal_allocations_campaign      RENAME TO idx_credit_batches_campaign;
ALTER INDEX IF EXISTS idx_seasonal_allocations_tenant_entity RENAME TO idx_credit_batches_tenant_entity;
ALTER INDEX IF EXISTS idx_seasonal_allocations_target_app    RENAME TO idx_credit_batches_target_app;
ALTER INDEX IF EXISTS idx_seasonal_allocations_expiry        RENAME TO idx_credit_batches_expiry;
ALTER INDEX IF EXISTS idx_seasonal_allocations_expiry_app    RENAME TO idx_credit_batches_expiry_app;
