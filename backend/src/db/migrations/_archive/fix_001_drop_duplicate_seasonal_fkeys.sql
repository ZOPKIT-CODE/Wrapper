-- M001: Drop duplicate FK constraints on seasonal credit tables
-- Cause: migration applied twice — each FK exists under two names.
-- Keeping the _fkey variants; dropping the verbose Drizzle-generated duplicates.
--
-- ROLLBACK:
--   ALTER TABLE seasonal_credit_campaigns
--     ADD CONSTRAINT seasonal_credit_campaigns_created_by_tenant_users_user_id_fk
--       FOREIGN KEY (created_by) REFERENCES tenant_users(user_id);
--   ALTER TABLE seasonal_credit_campaigns
--     ADD CONSTRAINT seasonal_credit_campaigns_tenant_id_tenants_tenant_id_fk
--       FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id);
--   ALTER TABLE seasonal_credit_allocations
--     ADD CONSTRAINT seasonal_credit_allocations_campaign_id_seasonal_credit_campaig
--       FOREIGN KEY (campaign_id) REFERENCES seasonal_credit_campaigns(campaign_id);
--   ALTER TABLE seasonal_credit_allocations
--     ADD CONSTRAINT seasonal_credit_allocations_entity_id_entities_entity_id_fk
--       FOREIGN KEY (entity_id) REFERENCES entities(entity_id);
--   ALTER TABLE seasonal_credit_allocations
--     ADD CONSTRAINT seasonal_credit_allocations_tenant_id_tenants_tenant_id_fk
--       FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id);

ALTER TABLE seasonal_credit_campaigns
  DROP CONSTRAINT seasonal_credit_campaigns_created_by_tenant_users_user_id_fk;

ALTER TABLE seasonal_credit_campaigns
  DROP CONSTRAINT seasonal_credit_campaigns_tenant_id_tenants_tenant_id_fk;

ALTER TABLE seasonal_credit_allocations
  DROP CONSTRAINT seasonal_credit_allocations_campaign_id_seasonal_credit_campaig;

ALTER TABLE seasonal_credit_allocations
  DROP CONSTRAINT seasonal_credit_allocations_entity_id_entities_entity_id_fk;

ALTER TABLE seasonal_credit_allocations
  DROP CONSTRAINT seasonal_credit_allocations_tenant_id_tenants_tenant_id_fk;
