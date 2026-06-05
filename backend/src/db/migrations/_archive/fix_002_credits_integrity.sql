-- M002: Enforce uniqueness and nullability on credits table
-- Pre-flight: 0 duplicate (tenant_id, entity_id) rows confirmed.
--
-- ROLLBACK:
--   ALTER TABLE credits DROP CONSTRAINT uq_credits_tenant_entity;
--   ALTER TABLE credits ALTER COLUMN available_credits DROP NOT NULL;
--   ALTER TABLE credits ALTER COLUMN entity_id DROP NOT NULL;

ALTER TABLE credits
  ALTER COLUMN entity_id SET NOT NULL;

ALTER TABLE credits
  ALTER COLUMN available_credits SET NOT NULL;

ALTER TABLE credits
  ADD CONSTRAINT uq_credits_tenant_entity UNIQUE (tenant_id, entity_id);
