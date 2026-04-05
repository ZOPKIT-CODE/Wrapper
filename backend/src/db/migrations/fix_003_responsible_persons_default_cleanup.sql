-- M003: Remove hardcoded permission/scope JSONB defaults from responsible_persons.
-- Defaults embedded business logic directly in the schema; actual values must
-- come from the RBAC system (custom_roles) at runtime.
--
-- ROLLBACK:
--   ALTER TABLE responsible_persons ALTER COLUMN scope SET DEFAULT
--     '{"auditAccess":true,"userManagement":true,"reportingAccess":true,"creditManagement":true,"configurationManagement":true}'::jsonb;
--   ALTER TABLE responsible_persons ALTER COLUMN auto_permissions SET DEFAULT
--     '{"canManageUsers":true,"canConfigureEntity":true,"canGenerateReports":true,"canPurchaseCredits":true,"canApproveTransfers":true,"canViewAllAuditLogs":true}'::jsonb;
--   ALTER TABLE responsible_persons ALTER COLUMN notification_preferences SET DEFAULT
--     '{"creditAlerts":true,"systemAlerts":true,"weeklyReports":true,"monthlyReports":true,"userActivities":true}'::jsonb;

ALTER TABLE responsible_persons ALTER COLUMN scope SET DEFAULT '{}'::jsonb;
ALTER TABLE responsible_persons ALTER COLUMN auto_permissions SET DEFAULT '{}'::jsonb;
ALTER TABLE responsible_persons ALTER COLUMN notification_preferences SET DEFAULT '{}'::jsonb;
