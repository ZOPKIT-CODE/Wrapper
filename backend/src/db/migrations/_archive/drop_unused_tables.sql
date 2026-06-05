-- Drop unused tables (FK-safe order: children before parents)
-- Run in Supabase SQL Editor or: node src/scripts/run-drop-unused-tables.js

BEGIN;

-- 1. credit_allocation_transactions (FK to credit_allocations)
DROP TABLE IF EXISTS credit_allocation_transactions CASCADE;

-- 2. credit_allocations
DROP TABLE IF EXISTS credit_allocations CASCADE;

-- 3. credit_allocations_backup
DROP TABLE IF EXISTS credit_allocations_backup CASCADE;

-- 4. responsibility_notifications (FK to responsible_persons)
DROP TABLE IF EXISTS responsibility_notifications CASCADE;

-- 5. membership_history (FK to organization_memberships)
DROP TABLE IF EXISTS membership_history CASCADE;

-- 6. membership_invitations (FK to organization_memberships, entities)
DROP TABLE IF EXISTS membership_invitations CASCADE;

-- 7. tenant_template_customizations (FK to notification_templates, tenants)
DROP TABLE IF EXISTS tenant_template_customizations CASCADE;

-- 8. user_manager_relationships (FK to tenants, tenant_users)
DROP TABLE IF EXISTS user_manager_relationships CASCADE;

-- 9. usage_metrics_daily (FK to tenants)
DROP TABLE IF EXISTS usage_metrics_daily CASCADE;

-- 10. usage_logs (FK to tenants)
DROP TABLE IF EXISTS usage_logs CASCADE;

-- 11. change_log (no FKs to other app tables)
DROP TABLE IF EXISTS change_log CASCADE;

-- 12. external_applications (FK to tenant_users)
DROP TABLE IF EXISTS external_applications CASCADE;

COMMIT;
