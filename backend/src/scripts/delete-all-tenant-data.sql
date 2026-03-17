-- =============================================================================
-- DELETE ALL TENANT DATA
-- Run this in Supabase Dashboard > SQL Editor (execute_sql MCP is read-only)
-- =============================================================================
-- Order respects foreign keys. Run as a single transaction.

BEGIN;

-- 1. responsibility_notifications (via assignment_id)
DELETE FROM responsibility_notifications
WHERE assignment_id IN (SELECT assignment_id FROM responsible_persons WHERE tenant_id IN (SELECT tenant_id FROM tenants));

-- 2. responsibility_history
DELETE FROM responsibility_history
WHERE assignment_id IN (SELECT assignment_id FROM responsible_persons WHERE tenant_id IN (SELECT tenant_id FROM tenants));

-- 3. membership_history
DELETE FROM membership_history
WHERE membership_id IN (SELECT membership_id FROM organization_memberships WHERE tenant_id IN (SELECT tenant_id FROM tenants));

-- 4. membership_invitations
DELETE FROM membership_invitations
WHERE membership_id IN (SELECT membership_id FROM organization_memberships WHERE tenant_id IN (SELECT tenant_id FROM tenants));

-- 5. credit_transactions
DELETE FROM credit_transactions WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 6. user_role_assignments
DELETE FROM user_role_assignments
WHERE user_id IN (SELECT user_id FROM tenant_users WHERE tenant_id IN (SELECT tenant_id FROM tenants));

-- 7. user_application_permissions
DELETE FROM user_application_permissions
WHERE user_id IN (SELECT user_id FROM tenant_users WHERE tenant_id IN (SELECT tenant_id FROM tenants));

-- 8. credit_usage
DELETE FROM credit_usage WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 9. user_sessions
DELETE FROM user_sessions WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 10. credits
DELETE FROM credits WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 11. credit_purchases
DELETE FROM credit_purchases WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 12. organization_memberships
DELETE FROM organization_memberships WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 13. responsible_persons
DELETE FROM responsible_persons WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 14. audit_logs
DELETE FROM audit_logs WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 15. usage_metrics_daily
DELETE FROM usage_metrics_daily WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 15b. usage_logs
DELETE FROM usage_logs WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 16. notifications
DELETE FROM notifications WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 17. event_tracking (tenant_id is varchar)
DELETE FROM event_tracking WHERE tenant_id IN (SELECT tenant_id::text FROM tenants);

-- 18. organization_applications
DELETE FROM organization_applications WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 19. tenant_invitations
DELETE FROM tenant_invitations WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 20. credit_configurations
DELETE FROM credit_configurations WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 21. Nullify primary_organization_id in tenant_users
UPDATE tenant_users SET primary_organization_id = NULL WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 22. entities (delete leaves first to avoid trigger; repeat until empty)
DELETE FROM entities
WHERE tenant_id IN (SELECT tenant_id FROM tenants)
  AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id);

-- 23. custom_roles
DELETE FROM custom_roles WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 24. user_manager_relationships
DELETE FROM user_manager_relationships WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 25. tenant_users
DELETE FROM tenant_users WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 26. payments
DELETE FROM payments WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 27. subscriptions
DELETE FROM subscriptions WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 28. seasonal_credit_allocations
DELETE FROM seasonal_credit_allocations WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 29. onboarding_events
DELETE FROM onboarding_events WHERE tenant_id IN (SELECT tenant_id FROM tenants);

-- 30. tenants
DELETE FROM tenants;

COMMIT;
