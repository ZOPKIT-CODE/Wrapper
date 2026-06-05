-- Migration: fix_021_tenant_users_column_cleanup
-- Purpose: Remove redundant, unused, or duplicated columns from tenant_users table.
--
-- What is being removed and why:
--   name             → Superseded by first_name + last_name columns (already present).
--                      name = first_name || ' ' || last_name computed at app level.
--   username         → Never populated or read in any code path. Orphaned column.
--   avatar           → Profile images generated from initials (UI Avatars). Never stored.
--   title            → Job title info belongs in org membership / profile service.
--   department       → Duplicated by organization_memberships hierarchy.
--   alias            → Never populated or read in any code path. Orphaned column.
--   mobile           → Duplicate of phone column already present on this table.
--   profile_data     → JSONB store never read from tenant_users. Orphaned column.
--   admin_privileges → JSONB store never read in any runtime code path. Orphaned column.
--   last_login_at    → Activity tracking replaced by last_active_at + tenant-level lastActivityAt.
--   login_count      → Always hardcoded to 0 in app-sync; never incremented. Meaningless counter.
--   onboarding_step  → Onboarding state is authoritative in onboarding_form_data.current_step.
--                      tenant_users.onboarding_completed (boolean) is the canonical completion flag.
--
-- What stays:
--   first_name, last_name  — primary name fields going forward
--   phone                  — kept (not duplicated)
--   last_active_at         — kept for activity tracking
--   onboarding_completed   — kept as the boolean completion flag
--   preferences (jsonb)    — kept for user preferences/settings

ALTER TABLE tenant_users
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS avatar,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS department,
  DROP COLUMN IF EXISTS alias,
  DROP COLUMN IF EXISTS mobile,
  DROP COLUMN IF EXISTS profile_data,
  DROP COLUMN IF EXISTS admin_privileges,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS login_count,
  DROP COLUMN IF EXISTS onboarding_step;
