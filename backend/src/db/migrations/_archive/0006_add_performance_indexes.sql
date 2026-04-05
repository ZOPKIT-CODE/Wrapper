-- Performance optimization indexes for admin queries
-- Created: 2025-11-21

-- Indexes for entities table (admin queries)
CREATE INDEX IF NOT EXISTS idx_entities_tenant_active 
ON entities(tenant_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_entities_tenant_type_active 
ON entities(tenant_id, entity_type, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_entities_responsible_person 
ON entities(responsible_person_id) 
WHERE responsible_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entities_parent_tenant 
ON entities(parent_entity_id, tenant_id) 
WHERE parent_entity_id IS NOT NULL;

-- Indexes for credits table (frequently queried)
CREATE INDEX IF NOT EXISTS idx_credits_entity_active 
ON credits(entity_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_credits_tenant_entity 
ON credits(tenant_id, entity_id, is_active) 
WHERE is_active = true;

-- Indexes for tenant_users table (authentication queries)
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_tenant 
ON tenant_users(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_users_kinde_user 
ON tenant_users(kinde_user_id) 
WHERE kinde_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_admin 
ON tenant_users(tenant_id, is_tenant_admin) 
WHERE is_tenant_admin = true;

-- Indexes for responsible_persons table (entity scope queries)
CREATE INDEX IF NOT EXISTS idx_responsible_persons_user_active 
ON responsible_persons(user_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_responsible_persons_entity_active 
ON responsible_persons(entity_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_responsible_persons_tenant_user 
ON responsible_persons(tenant_id, user_id, is_active) 
WHERE is_active = true;

-- Indexes for subscriptions table
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status 
ON subscriptions(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_active 
ON subscriptions(tenant_id, status) 
WHERE status IN ('active', 'trialing');

-- Composite index for entity hierarchy queries
CREATE INDEX IF NOT EXISTS idx_entities_hierarchy_lookup 
ON entities(tenant_id, parent_entity_id, entity_level, is_active) 
WHERE parent_entity_id IS NOT NULL AND is_active = true;

-- Index for full hierarchy path queries
CREATE INDEX IF NOT EXISTS idx_entities_hierarchy_path_gin 
ON entities USING gin(hierarchy_path gin_trgm_ops) 
WHERE hierarchy_path IS NOT NULL;

-- Analyze tables after index creation
ANALYZE entities;
ANALYZE credits;
ANALYZE tenant_users;
ANALYZE responsible_persons;
ANALYZE subscriptions;

