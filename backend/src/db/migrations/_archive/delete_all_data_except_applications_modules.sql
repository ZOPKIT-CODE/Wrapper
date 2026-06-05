-- Delete all data except applications and application_modules
-- Keeps only: applications, application_modules
--
-- Supabase: run this in Dashboard → SQL Editor (paste and Run).
-- Or from backend folder: node src/scripts/run-delete-except-apps-modules.js
-- (uses DATABASE_URL from .env; no psql required)

BEGIN;

-- Root tables: truncating these cascades to all dependent tables (except applications/application_modules)
TRUNCATE TABLE tenants RESTART IDENTITY CASCADE;
TRUNCATE TABLE webhook_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE event_tracking RESTART IDENTITY CASCADE;

-- Optional tables not under tenants (uncomment if they exist in your DB)
-- TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE notification_templates RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE tenant_template_customizations RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE platform_audit_logs RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE platform_staff RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE onboarding_form_data RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE contact_submissions RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE external_applications RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE seasonal_credit_allocations RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE seasonal_credit_campaigns RESTART IDENTITY CASCADE;

COMMIT;
