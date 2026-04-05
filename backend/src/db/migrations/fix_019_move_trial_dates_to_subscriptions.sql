-- fix_019: Move trial dates from tenants to subscriptions
-- Trial lifecycle belongs in subscriptions (single source of truth).

-- Step 1: Add trial columns to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Step 2: Backfill from tenants where trial data exists
UPDATE subscriptions s
SET trial_started_at = COALESCE(s.trial_started_at, t.trial_started_at),
    trial_ends_at    = COALESCE(s.trial_ends_at,    t.trial_ends_at)
FROM tenants t
WHERE s.tenant_id = t.tenant_id
  AND (t.trial_started_at IS NOT NULL OR t.trial_ends_at IS NOT NULL);

-- Step 3: Drop from tenants
ALTER TABLE tenants DROP COLUMN IF EXISTS trial_started_at;
ALTER TABLE tenants DROP COLUMN IF EXISTS trial_ends_at;

-- Step 4: Index for trial status filtering
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends_at
  ON subscriptions (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;
