-- fix_017: Drop dead columns from onboarding_events, responsible_persons,
--          organization_memberships, and drop responsibility_history table.
-- Safe to re-run (DROP COLUMN IF EXISTS / DROP TABLE IF EXISTS).
--
-- Excluded from this migration (code changes needed first):
--   subscriptions.monthly_price    — still written via `as any`; remove writes before dropping
--   subscriptions.trial_toggled_off — add to schema properly or consolidate into has_ever_upgraded
--
-- ROLLBACK: None of these columns/table were ever read or written by active business logic.

-- 1. onboarding_events — drop 13 analytics/A-B-test columns (table is write-only, never queried)
ALTER TABLE onboarding_events
  DROP COLUMN IF EXISTS session_id,
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS user_agent,
  DROP COLUMN IF EXISTS event_data,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS time_spent,
  DROP COLUMN IF EXISTS completion_rate,
  DROP COLUMN IF EXISTS step_number,
  DROP COLUMN IF EXISTS total_steps,
  DROP COLUMN IF EXISTS variant_id,
  DROP COLUMN IF EXISTS experiment_id,
  DROP COLUMN IF EXISTS event_phase,
  DROP COLUMN IF EXISTS event_timestamp;

-- 2. responsible_persons — drop 5 dead columns
ALTER TABLE responsible_persons
  DROP COLUMN IF EXISTS notification_preferences,
  DROP COLUMN IF EXISTS delegation_limits,
  DROP COLUMN IF EXISTS is_emergency_contact,
  DROP COLUMN IF EXISTS emergency_contact_order,
  DROP COLUMN IF EXISTS auto_expire;

-- 3. organization_memberships — drop 4 dead columns
ALTER TABLE organization_memberships
  DROP COLUMN IF EXISTS credit_permissions,
  DROP COLUMN IF EXISTS contact_override,
  DROP COLUMN IF EXISTS preferences,
  DROP COLUMN IF EXISTS notes;

-- 4. Drop responsibility_history — table exists but is never written to (no INSERT anywhere in codebase)
DROP TABLE IF EXISTS responsibility_history;
