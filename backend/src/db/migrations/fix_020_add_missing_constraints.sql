-- fix_020: Add missing UNIQUE constraints and FK references

-- 1. UNIQUE on stripe_subscription_id (partial — nulls allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id_unique
  ON subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- 2. UNIQUE on stripe_payment_intent_id (partial — nulls allowed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_unique
  ON payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 3. Self-referencing FK on entities.parent_entity_id
-- NOT VALID avoids full-table lock; VALIDATE runs separately.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_entities_parent'
  ) THEN
    ALTER TABLE entities
      ADD CONSTRAINT fk_entities_parent
      FOREIGN KEY (parent_entity_id) REFERENCES entities(entity_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;
ALTER TABLE entities VALIDATE CONSTRAINT fk_entities_parent;

-- 4. Backfill firstName/lastName from name where missing
UPDATE tenant_users
SET first_name = split_part(name, ' ', 1),
    last_name  = CASE
      WHEN position(' ' in name) > 0
      THEN substring(name from position(' ' in name) + 1)
      ELSE ''
    END
WHERE (first_name IS NULL OR first_name = '')
  AND name IS NOT NULL AND name != '';
