-- fix_011: Add non-negative balance check on credits and unique constraint on seasonal_credit_allocations
--
-- ROLLBACK:
--   ALTER TABLE credits DROP CONSTRAINT chk_credits_non_negative;
--   ALTER TABLE seasonal_credit_allocations DROP CONSTRAINT uq_seasonal_alloc_campaign_tenant_app;

ALTER TABLE credits
  ADD CONSTRAINT chk_credits_non_negative CHECK (available_credits >= 0);

ALTER TABLE seasonal_credit_allocations
  ADD CONSTRAINT uq_seasonal_alloc_campaign_tenant_app UNIQUE (campaign_id, tenant_id, target_application);
