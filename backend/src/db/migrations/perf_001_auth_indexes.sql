-- perf_001_auth_indexes.sql
-- Performance indexes for high-frequency auth and billing queries.
--
-- All indexes use CONCURRENTLY so they can be built on a live database
-- without acquiring an AccessExclusiveLock that would block reads/writes.
-- IMPORTANT: CONCURRENTLY cannot run inside a transaction block — do NOT
-- wrap this file in BEGIN/COMMIT.
--
-- All indexes use IF NOT EXISTS so the file is fully idempotent and safe
-- to run more than once (e.g. after a failed deploy retry).

-- ---------------------------------------------------------------------------
-- 1. tenant_users(kinde_user_id)
--    The auth middleware executes:
--      SELECT * FROM tenant_users WHERE kinde_user_id = $1
--    on every authenticated request. Without this index PostgreSQL performs a
--    sequential scan of the entire tenant_users table (~5 s statement timeout
--    at scale). The Drizzle schema declares this index but it may be absent
--    if the table was created before the declaration was added.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_users_kinde_user_id
    ON tenant_users (kinde_user_id);

-- ---------------------------------------------------------------------------
-- 2. tenants(kinde_org_id)
--    The auth middleware executes:
--      SELECT * FROM tenants WHERE kinde_org_id = $1
--    on every authenticated request to resolve the tenant context. kinde_org_id
--    is declared UNIQUE (so lookups are point queries), but without an index
--    the planner falls back to a sequential scan. This column is NOT indexed
--    anywhere in the current Drizzle schema definitions.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_kinde_org_id
    ON tenants (kinde_org_id);

-- ---------------------------------------------------------------------------
-- 3. tenant_users(tenant_id, is_active)
--    Many service queries filter active users within a tenant, e.g.:
--      SELECT * FROM tenant_users WHERE tenant_id = $1 AND is_active = true
--    The existing idx_tenant_users_tenant_id covers the first column, but
--    adding is_active as the second column lets PostgreSQL satisfy the full
--    predicate from the index without a heap re-check on every row.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_users_tenant_status
    ON tenant_users (tenant_id, is_active);

-- ---------------------------------------------------------------------------
-- 4. subscriptions(tenant_id, status, created_at DESC)
--    Multiple routes query:
--      SELECT * FROM subscriptions
--      WHERE tenant_id = $1 AND status = $2
--      ORDER BY created_at DESC
--      LIMIT 1
--    The existing idx_subscriptions_tenant_status covers (tenant_id, status)
--    but the planner must then sort the result set. Including created_at DESC
--    as the third index column allows an index scan that returns rows already
--    in the correct order, eliminating the sort step entirely.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_tenant_status_created
    ON subscriptions (tenant_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. payments(tenant_id, created_at DESC)
--    Billing history queries fetch a tenant's payments sorted newest-first:
--      SELECT * FROM payments
--      WHERE tenant_id = $1
--      ORDER BY created_at DESC
--    The Drizzle schema declares idx_payments_tenant_created_at for this
--    purpose; this statement ensures it exists in the database with the
--    correct sort direction for descending time-ordered reads.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_tenant_created
    ON payments (tenant_id, created_at DESC);
