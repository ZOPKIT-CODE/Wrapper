-- M004: Cast credit_configurations.volume_tiers varchar → jsonb
-- Pre-flight: 0 rows with invalid JSON.
--
-- ROLLBACK:
--   ALTER TABLE credit_configurations
--     ALTER COLUMN volume_tiers TYPE varchar USING volume_tiers::text;

ALTER TABLE credit_configurations
  ALTER COLUMN volume_tiers TYPE jsonb USING
    CASE
      WHEN volume_tiers IS NULL OR trim(volume_tiers) = '' THEN NULL
      ELSE volume_tiers::jsonb
    END;
