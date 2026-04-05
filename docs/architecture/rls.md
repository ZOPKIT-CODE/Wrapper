# Row-Level Security (RLS)

How tenant data isolation works in this codebase — what RLS does, how it is wired, and what its current limitations are.

---

## Overview

Tenant isolation is enforced at three layers (defense-in-depth):

| Layer | Mechanism | Where |
|-------|-----------|-------|
| 1. Auth | `tenantId` extracted from JWT, never trusted from the client | `middleware/auth/auth.ts` |
| 2. Code | Every Drizzle query filters by `WHERE tenant_id = ?` | All service files |
| 3. Database | PostgreSQL RLS policies block rows with the wrong `app.tenant_id` session var | Migration `0014_enable_rls_tenant_isolation.sql` |

Layer 2 (code) is the **primary enforcer** today. Layer 3 (RLS) is defense-in-depth — it catches bugs where a developer forgets to add a `WHERE tenant_id =` clause.

---

## How the Policies Work

### Migration `0014_enable_rls_tenant_isolation.sql`

All 17 tenant-scoped tables have RLS enabled with the same pattern:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY <table>_tenant_isolation ON <table>
  FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));
```

`current_setting('app.tenant_id', true)` reads a **PostgreSQL session variable** that the backend sets on every authenticated request. If the variable is empty or does not match the row's `tenant_id`, the row is invisible to SELECT and blocked for INSERT/UPDATE/DELETE.

### Tables Covered

```
tenants                   tenant_users          entities
organization_memberships  custom_roles          user_role_assignments
subscriptions             payments              credits
credit_transactions       credit_configurations credit_purchases
tenant_invitations        notifications         audit_logs
event_tracking            seasonal_credits
```

`user_role_assignments` has no direct `tenant_id` column, so its policy checks through a join:

```sql
CREATE POLICY user_role_assignments_tenant_isolation ON user_role_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM custom_roles cr
      WHERE cr.role_id = user_role_assignments.role_id
        AND cr.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );
```

### Helper Function

A `current_tenant_id()` function is also created for use in custom queries:

```sql
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true)::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
```

---

## How the Session Variable Gets Set

### Per-Request Hook (`app-fastify.ts`)

After the auth middleware populates `request.userContext`, a global `preHandler` hook runs on every authenticated request:

```typescript
fastify.addHook('preHandler', async (request, _reply) => {
  const tenantId = request.userContext?.tenantId;
  if (!tenantId) return;
  try {
    await sql`SELECT set_config('app.tenant_id', ${tenantId}, false)`;
  } catch {
    // Failure must never break the request — code-level filter is the primary guard
  }
});
```

- `set_config('app.tenant_id', ..., false)` — `false` means **session-scoped** (not transaction-scoped). The value persists for the lifetime of that PostgreSQL connection.
- If auth fails or the route is public (health, webhooks), `tenantId` is undefined and the hook returns early. RLS then sees an empty `app.tenant_id`, which causes the policy to block all rows — correct behaviour for unauthenticated routes.
- Failures are silently swallowed so an RLS hook error never crashes a request.

### Connection Pool Behaviour

With pgBouncer or connection pooling, the same connection can be reused across requests. Because `set_config` is session-scoped:

- Every authenticated request **overwrites** `app.tenant_id` at the start, so a previous tenant's value cannot leak into the next request on the same connection.
- Non-authenticated requests do not call `set_config`, so the value from the previous request could remain. This is safe because unauthenticated routes do not query tenant-scoped tables.

---

## The Current Limitation — Supabase Service Role

The application connects to PostgreSQL using the **Supabase service role**, which has `BYPASSRLS` privilege. This means PostgreSQL's RLS policies are **not enforced** for any query made through the app connection.

The comment in the migration file is explicit about this:

```sql
-- NOTE: The Supabase service role has BYPASSRLS, so these policies are
-- enforced at the application layer as defense-in-depth. To enforce at
-- the DB layer too, use FORCE ROW LEVEL SECURITY after switching to a
-- restricted Postgres role for app queries.
```

### What This Means in Practice

The real isolation chain today is:

```
Incoming request
  → JWT validation → tenantId extracted from token (never from request body)
  → app.tenant_id set on DB session (advisory — bypassed by service role)
  → Drizzle query with WHERE tenant_id = userContext.tenantId  ← actual enforcer
  → RLS policy would apply here but is bypassed by BYPASSRLS
```

The policies are structurally correct and would enforce isolation if the app connected with a restricted role.

---

## The `RLSTenantIsolationService` Class

`middleware/security/rls-tenant-isolation.ts` provides a utility class with methods to:

- `setTenantContext(tenantId)` — call `set_config('app.tenant_id', ...)`
- `clearTenantContext()` — reset to empty string
- `setMultiLevelContext({ tenantId, subOrgId, locationId, userRole, userId })` — set multiple session vars in one round-trip
- `executeInTenantContext(tenantId, fn)` — run a query function inside an explicit tenant context block
- `enableRLS(tableName)` / `createTenantPolicy(tableName)` — programmatic DDL helpers
- `healthCheck()` — returns `{ rls_enabled, tenant_context, status }`

The service is initialized at startup (`initializeRLS()` in `app-fastify.ts`) and exposed as `global.rlsService` for the `/health/rls` endpoint.

The `middleware()` method is Express-style and is **not used** by the Fastify app — the per-request hook in `app-fastify.ts` replaces it.

---

## How to Make RLS Actually Enforce at the DB Level

To move from advisory to enforced:

1. **Create a restricted Postgres role** (e.g. `app_user`) with no `BYPASSRLS`.
2. **Grant table permissions** to that role (`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`).
3. **Update the connection string** to connect as `app_user` instead of the service role.
4. Optionally add `ALTER TABLE <table> FORCE ROW LEVEL SECURITY` so even the table owner cannot bypass the policy.

On Supabase specifically, the `authenticated` role is designed for this — RLS policies can use `auth.uid()` as the session context instead of a custom `app.tenant_id` setting.

---

## Health Check

`GET /health/rls` returns the current RLS service status:

```json
{
  "rls_enabled": true,
  "tenant_context": null,
  "status": "healthy"
}
```

`tenant_context` will be `null` on the health check request because it is a public route — no auth, no `set_config` call.
