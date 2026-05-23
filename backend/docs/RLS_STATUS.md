# RLS Status Audit

Audit date: 2026-05-23
Scope: backend Postgres tenant isolation via Row Level Security.

## 1. What migration 0019 does

File: `backend/src/db/migrations/0019_organization_applications_rls.sql`

- Enables RLS on a single table: `organization_applications`.
- Creates a single policy, `organization_applications_tenant_isolation`, of type `FOR ALL`, using:
  `tenant_id::text = current_setting('app.tenant_id', true)`.
- Session GUC used: **`app.tenant_id`** (matches the existing convention from migration 0014).
- Purpose per the inline comment: 0014 missed this table; without RLS, a request with a null/blank `app.tenant_id` silently returns 0 rows from `organization_applications` instead of producing an obvious error, hiding a frontend race condition.

The migration assumes the GUC is set per-request; it does not itself configure anything in the connection layer.

## 2. Is the GUC actually being set at runtime?

**Yes — it is set per request, but on a shared pool instance, which makes the pattern unsafe.**

Evidence the GUC is set:

- `backend/src/middleware/auth/auth.ts:281` — `setupDatabaseConnection(request, tenantId, userId)` assigns `request.db = dbManager.getAppConnection()` (or system connection on bypass routes) and then issues:
  ```ts
  await request.db`SELECT
    set_config('app.tenant_id', ${tenantId}, false),
    set_config('app.user_id',   ${userId || ''}, false)
  ` // auth.ts:296-308
  ```
- `setupDatabaseConnection` is invoked from three sites in `auth.ts`: line 440 (Kinde-authenticated requests), line 463 (public routes, no tenantId), and line 519 (Operations JWT path).
- `authMiddleware` is registered as a global `preHandler` for every route in `backend/src/app-routes.ts:60`, so authenticated requests do hit the set_config path before the route handler.
- The RLS service in `backend/src/middleware/security/rls-tenant-isolation.ts:25,79,126` exposes set/clear helpers, and a few service-level callers re-set the GUC inside their own code paths:
  - `backend/src/features/subscriptions/services/subscription-webhook-handler.ts:1948,1987`
  - `backend/src/features/credits/services/credit-operations.ts:369,538`
  - `backend/src/features/onboarding/services/unified-onboarding-service.ts:1151,1752`

### Why the wiring is broken in practice

The third argument to `set_config(name, value, is_local)` is `false`, meaning the change persists for the rest of the **session** (PG connection). But the connection layer never reserves a connection per request:

- `backend/src/db/connection-manager.ts:44` creates `appConnection` as a `postgres(databaseUrl, { max: 30, ... })` pool — `getAppConnection()` (line 84) returns that pool object, **not a reserved connection**.
- `setupDatabaseConnection` stores that pool on `request.db`. Every tagged query (`request.db\`...\``) checks out an arbitrary free connection from the pool, runs the query, and releases it.
- No call site uses `sql.reserve()` or wraps the work in `sql.begin(async tx => { ... })` with `SET LOCAL`. Grepping the auth/security code paths for `.begin(` and `reserve(` returns no matches.
- Consequences:
  1. The `set_config` and the subsequent query may run on **different** physical connections — the second connection has no GUC set, so an RLS-protected table returns 0 rows for what is supposed to be the tenant's own data.
  2. Because `is_local=false`, the GUC sticks to whichever connection happened to handle the set_config call. The next request that grabs that connection from the pool inherits the previous tenant's `app.tenant_id` until the GUC is overwritten again. This is a cross-tenant leak under concurrent load.
  3. Today the leak is masked because migration 0014's comment notes that the Supabase service role has `BYPASSRLS`. In environments where the app connects as the service role, no policy is evaluated at all — RLS is dead code. In environments without `BYPASSRLS` (or once that is revoked), the broken pooling pattern will produce both missing-data and cross-tenant-data symptoms.

### Verdict

RLS as currently deployed is effectively **dormant defense-in-depth** rather than an enforced isolation layer. The policies exist and the middleware tries to set the GUC, but (a) the pooling pattern makes the GUC unreliable per-query, and (b) the connecting role likely has BYPASSRLS in the primary deployment. Tenant isolation in production is being enforced by application-level `WHERE tenant_id = ?` filters, not by RLS.

## 3. Tenant-scoped tables — RLS status

Tables identified by grepping `backend/src/db/schema/**` for an actual `tenantId: uuid('tenant_id')` column (not just FK references in comments).

Legend: enabled = covered by migration 0014 or 0019. not enabled = column exists but no `ENABLE ROW LEVEL SECURITY` statement found.

| Table | tenant_id column | RLS enabled |
| --- | --- | --- |
| tenants | yes (pk-ish) | enabled (0014) |
| tenant_users | yes | enabled (0014) |
| entities | yes | enabled (0014) |
| organization_memberships | yes | enabled (0014) |
| custom_roles | yes | enabled (0014) |
| user_role_assignments | yes | enabled (0014, via join) |
| subscriptions | yes | enabled (0014) |
| payments | yes | enabled (0014) |
| credits | yes | enabled (0014) |
| credit_transactions | yes | enabled (0014) |
| credit_configurations | yes (nullable; null = global) | enabled (0014) |
| credit_purchases | yes | enabled (0014) |
| tenant_invitations | yes | enabled (0014) |
| notifications | yes | enabled (0014) |
| audit_logs | yes | enabled (0014) |
| event_tracking | yes | enabled (0014) |
| seasonal_credit_campaigns | yes | enabled (0014) |
| seasonal_credit_allocations | yes | enabled (0014) |
| organization_applications | yes | enabled (0019) |
| responsible_persons | yes | not enabled |
| onboarding_events | yes | not enabled |
| tenant_template_customizations | yes | not enabled |
| tenant_banking_details | yes | not enabled |
| credit_batches | yes (appears twice in file — two tables) | not enabled |
| received_events | yes (nullable) | not enabled |

Summary: 25 tenant-scoped tables identified. 19 have RLS enabled. 6 do not (responsible_persons, onboarding_events, tenant_template_customizations, tenant_banking_details, credit_batches tables in `billing/credit-batches.ts`, received_events).

Notes:
- `applications` and `application_modules` (in `core/suite-schema.ts`) are global catalog tables with no `tenant_id`; they are not tenant-scoped.
- `platform_staff`, `platform_audit_logs`, `contact_submissions` reference tenants via FK or comments but do not carry a `tenantId` column in the schema and are out of scope for tenant RLS.

## 4. Recommendation

**Do not roll RLS out to more tables until the GUC plumbing is fixed.** Adding policies to additional tables while the GUC is unreliable would extend the same set of failure modes (cross-tenant leak under load, mysteriously empty queries) to more surface area.

Order of operations:

1. Fix the connection layer so that the GUC is bound to the same physical connection that runs the request's queries. Two acceptable options with postgres.js:
   - Use `sql.reserve()` in `setupDatabaseConnection`, store the reserved connection on `request.db`, and release it in an `onResponse`/`onError` hook.
   - Wrap each request handler's DB work in `sql.begin(async tx => { await tx\`SET LOCAL app.tenant_id = ${tenantId}\`; ... })`. This requires the handlers to accept a transaction-scoped client, which is a larger refactor.
   - The `reserve()` approach is the smallest diff against the current shape of `request.db`.
2. Confirm whether the production DB role has `BYPASSRLS`. If it does, decide whether RLS should actually enforce or remain advisory; if enforce, switch to a non-bypassing role for app traffic (separate from the migration/admin role).
3. Add an integration test that asserts: setting `app.tenant_id` and immediately running `SELECT FROM <some_rls_table>` on the same `request.db` only returns rows for the configured tenant — across at least 10 concurrent requests, to catch the pooling bug.
4. After 1–3 are green, do a dedicated RLS rollout pass covering the 6 tables in section 3 that are missing.

## 5. Specific next steps with file references

- `backend/src/middleware/auth/auth.ts:281-308` — change `setupDatabaseConnection` to call `dbManager.getAppConnection().reserve()` (await), store the reserved client on `request.db`, and run the `set_config(..., true)` (session-local on the reserved connection is fine, but switching to `true` makes intent explicit if you later move into a transaction).
- `backend/src/app-fastify.ts` — add `onResponse` and `onError` hooks that release the reserved connection (e.g. `request.db?.release?.()`).
- `backend/src/db/connection-manager.ts:84` — consider exposing a `reserveAppConnection()` helper so reservation logic is in one place rather than duplicated in middleware.
- `backend/src/features/credits/services/credit-operations.ts:369,538` and `backend/src/features/subscriptions/services/subscription-webhook-handler.ts:1948,1987` and `backend/src/features/onboarding/services/unified-onboarding-service.ts:1151,1752` — audit these set_config call sites; if the surrounding `db.execute` calls are against the shared `db` (not a reserved client or a transaction), they have the same pooling bug. Switch each block to `db.transaction(async tx => { ... SET LOCAL ... })` or to a reserved client.
- `backend/src/middleware/security/rls-tenant-isolation.ts` — large file with helpers and DDL strings; once the runtime is fixed, this is where to add the missing-table policies for the 6 tables in section 3 (or write a new migration `0020_*_rls.sql` that mirrors the 0014 pattern).
- `backend/src/db/migrations/0014_enable_rls_tenant_isolation.sql` — reference template for the eventual rollout migration; copy the `DO $$ ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE ...` block per table.

No code changes were made as part of this audit other than creating this document.
