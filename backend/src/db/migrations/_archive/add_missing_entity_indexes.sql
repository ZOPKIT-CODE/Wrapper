-- Migration: Missing indexes on entities and related tables
--
-- The role-assignments sync route does a per-assignment lookup on entities(entity_id)
-- using tenant_id + entity_id. Without an index this is a sequential scan that grows
-- linearly with entity count.
--
-- Also adds indexes for common query patterns identified in the scalability audit.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. entities — the most frequently joined table in sync and permission routes
-- ═══════════════════════════════════════════════════════════════════════════

-- Used by: role-assignments sync route — lookup entity name/code per assignment
-- Also used by: org listing endpoints with is_active filter
CREATE INDEX IF NOT EXISTS entities_tenant_active_idx
  ON entities(tenant_id, is_active)
  WHERE is_active = true;

-- Used by: entity lookup by entity_id within a tenant (the N+1 hot path in sync-routes)
CREATE INDEX IF NOT EXISTS entities_tenant_entity_id_idx
  ON entities(tenant_id, entity_id);

-- Used by: hierarchy traversal — "all children of a parent"
CREATE INDEX IF NOT EXISTS entities_tenant_parent_idx
  ON entities(tenant_id, parent_entity_id)
  WHERE parent_entity_id IS NOT NULL;

-- Used by: entity_code lookups (sync matching, API requests by code)
CREATE INDEX IF NOT EXISTS entities_tenant_code_idx
  ON entities(tenant_id, entity_code)
  WHERE entity_code IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. organization_memberships — role/access queries per user within a tenant
-- ═══════════════════════════════════════════════════════════════════════════

-- Used by: permission checks — "all active memberships for this user in this tenant"
CREATE INDEX IF NOT EXISTS org_memberships_tenant_user_active_idx
  ON organization_memberships(tenant_id, user_id, status)
  WHERE status = 'active';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. credit_usage — reporting and deduction lookups
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS credit_usage_tenant_entity_created_idx
  ON credit_usage(tenant_id, entity_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. event_tracking composite — complements the replay index in outbox hardening
-- ═══════════════════════════════════════════════════════════════════════════

-- Used by: admin dashboard queries — "recent events for this tenant ordered by time"
-- (The replay worker index covers status+retry_count+published_at already)
CREATE INDEX IF NOT EXISTS event_tracking_tenant_created_idx
  ON event_tracking(tenant_id, created_at DESC);
