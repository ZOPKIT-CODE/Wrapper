-- =============================================================================
-- DELETE TENANT DATA: 762b7f1c-4352-4dc4-86e1-85d5e39ad634
-- Run in Supabase SQL Editor or via MCP. Order respects foreign keys.
-- =============================================================================

BEGIN;

-- 1. responsibility_notifications (via assignment_id)
DELETE FROM responsibility_notifications
WHERE assignment_id IN (SELECT assignment_id FROM responsible_persons WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634');

-- 2. responsibility_history
DELETE FROM responsibility_history
WHERE assignment_id IN (SELECT assignment_id FROM responsible_persons WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634');

-- 3. membership_history
DELETE FROM membership_history
WHERE membership_id IN (SELECT membership_id FROM organization_memberships WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634');

-- 4. membership_invitations
DELETE FROM membership_invitations
WHERE membership_id IN (SELECT membership_id FROM organization_memberships WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634');

-- 5. credit_transactions
DELETE FROM credit_transactions WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 6. user_role_assignments
DELETE FROM user_role_assignments
WHERE user_id IN (SELECT user_id FROM tenant_users WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634');

-- 7. user_application_permissions
DELETE FROM user_application_permissions
WHERE user_id IN (SELECT user_id FROM tenant_users WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634');

-- 8. credit_usage
DELETE FROM credit_usage WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 9. user_sessions
DELETE FROM user_sessions WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 10. credits
DELETE FROM credits WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 11. credit_purchases
DELETE FROM credit_purchases WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 12. organization_memberships
DELETE FROM organization_memberships WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 13. responsible_persons
DELETE FROM responsible_persons WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 14. audit_logs
DELETE FROM audit_logs WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 15. usage_metrics_daily
DELETE FROM usage_metrics_daily WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 15b. usage_logs
DELETE FROM usage_logs WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 16. notifications
DELETE FROM notifications WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 17. event_tracking (tenant_id is varchar)
DELETE FROM event_tracking WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 18. organization_applications
DELETE FROM organization_applications WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 19. tenant_invitations
DELETE FROM tenant_invitations WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 20. credit_configurations
DELETE FROM credit_configurations WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 21. Nullify primary_organization_id in tenant_users
UPDATE tenant_users SET primary_organization_id = NULL WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 22. entities (delete leaves first; repeat to handle hierarchy)
DELETE FROM entities
WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634'
  AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id);
DELETE FROM entities
WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634'
  AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id);
DELETE FROM entities
WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634'
  AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id);
DELETE FROM entities
WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634'
  AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id);
DELETE FROM entities
WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634'
  AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id);
DELETE FROM entities WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 23. custom_roles
DELETE FROM custom_roles WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 24. user_manager_relationships
DELETE FROM user_manager_relationships WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 25. tenant_users
DELETE FROM tenant_users WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 26. payments
DELETE FROM payments WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 27. subscriptions
DELETE FROM subscriptions WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 28. seasonal_credit_allocations
DELETE FROM seasonal_credit_allocations WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 29. onboarding_events
DELETE FROM onboarding_events WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

-- 30. tenants
DELETE FROM tenants WHERE tenant_id = '762b7f1c-4352-4dc4-86e1-85d5e39ad634';

COMMIT;
