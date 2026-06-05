-- Trial lifecycle belongs in subscriptions (moved by fix_019).
-- Drop the now-redundant columns from tenants.
ALTER TABLE tenants DROP COLUMN IF EXISTS trial_started_at;
ALTER TABLE tenants DROP COLUMN IF EXISTS trial_ends_at;
