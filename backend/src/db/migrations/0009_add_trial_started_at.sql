-- add trial_started_at and trial_ends_at to subscriptions table
-- These columns were moved from tenants to subscriptions (single source of truth for billing).

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends_at
  ON subscriptions (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;
