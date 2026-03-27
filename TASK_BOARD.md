# TASK BOARD - WrapperStandalone

> Shared coordination hub for all agents. Updated: 2026-03-27 (rev 5 — S1-S8 + L1 + L3 + H5-H9 + M2 + M3 + M6 + M9 fixed)
> Monorepo: `wrapper-backend` (Fastify 4 + Drizzle + Kinde) + `wrapper-frontend` (React 19 + Vite 7 + TanStack)

---

## CRITICAL SECURITY VULNERABILITIES (P0 - Fix Before Production)

| # | Issue | File | Line | Impact | Status |
|---|-------|------|------|--------|--------|
| S1 | **Default JWT secret fallback** | `backend/src/routes/internal/service-auth.ts` | ~135 | Token forgery if env var missing — hardcoded `'default-secret-change-in-production'` | FIXED `281da89` |
| S2 | **Stripe webhook signature bypass** | `backend/src/features/credits/routes/credits.ts` | ~1251 | Fake payment events when `STRIPE_WEBHOOK_SECRET` unset or `NODE_ENV=development` | FIXED `281da89` |
| S3 | **Super admin role not tenant-scoped** | `backend/src/middleware/auth/auth.ts` | ~383 | `userRoleAssignments` query missing `tenantId` — cross-tenant privilege escalation | FIXED `281da89` |
| S4 | **Entity routes bypass app isolation** | `backend/src/middleware/security/application-isolation.ts` | ~37 | `request.url.includes('/api/entities/')` blanket bypass | FIXED `eccab53` PR#5 |
| S5 | **Data isolation missing tenantId** | `backend/src/services/data-isolation-service.ts` | ~32 | `organizationMemberships` query lacks `tenantId` — cross-tenant org access | FIXED `281da89` |
| S6 | **Auth tokens in localStorage** | `frontend/src/features/auth/pages/InviteAccept.tsx` | 149, 164 | `pendingInvitationToken` in localStorage — XSS-vulnerable | FIXED `28cbd7c` PR#6 |
| S7 | **CORS regex too broad** | `backend/src/app-fastify.ts` | — | `/^https?:\/\/[a-z0-9-]+\.zopkit\.com$/i` allows ANY subdomain | FIXED `28cbd7c` PR#6 |
| S8 | **No rate limit on auth endpoints** | `backend/src/app-fastify.ts` | — | Global 200 req/15min; auth endpoints need stricter limits | FIXED `28cbd7c` PR#6 |

---

## HIGH PRIORITY BUGS & TECH DEBT (P1)

| # | Issue | Location | Details | Status |
|---|-------|----------|---------|--------|
| H1 | **`tenant-service.ts` god object** | `backend/src/services/tenant-service.ts` | 2051 LOC, 120+ methods — needs decomposition | OPEN |
| H2 | **`invitations.ts` god file** | `backend/src/features/*/invitations.ts` | 2766 LOC — split routes/services | OPEN |
| H3 | **`permission-service.ts` bloat** | `backend/src/features/roles/services/` | 1957 LOC, multiple responsibilities | OPEN |
| H4 | **729 `any` types in frontend** | `frontend/src/` (163 files) | Top: `OrganizationManagement.tsx` (71), `AdminDetailsStep.tsx` (12) | OPEN |
| H5 | **React Router + TanStack Router conflict** | `frontend/src/routes/AppRoutes.tsx` | Uses `react-router-dom` while rest uses `@tanstack/react-router` | FIXED `a9a561d` PR#11 |
| H6 | **Duplicate auth stores** | `frontend/src/stores/auth.store.ts` vs `authStore.ts` | Two files (818B vs 2520B), potential state conflicts | FIXED `c9174e1` PR#9 |
| H7 | **3 numbered duplicate files** | `frontend/src/features/organizations/components/` | `index 2.ts`, `OrganizationUserManagement 2.tsx`, `OrganizationTreeManagement 2.tsx` | FIXED `096c6d9` PR#8 |
| H8 | **No DB transactions on multi-step writes** | Multiple backend services | Credit allocation, user deletion not atomic | FIXED `b617e2a` PR#12 |
| H9 | **No webhook idempotency checks** | Stripe webhook handlers | Duplicate event processing possible | FIXED `c9174e1` PR#9 |
| H10 | **No circuit breaker for external services** | Stripe/Kinde/Brevo/MQ calls | Cascading failures possible | OPEN |

---

## MEDIUM PRIORITY (P2)

| # | Issue | Location | Details | Status |
|---|-------|----------|---------|--------|
| M1 | **29 components over 200 LOC** | Frontend | Top: OrganizationManagement (1990), AccountSettings (1645), IndustryPage (1234) | OPEN |
| M2 | **No frontend tests in CI** | `.github/workflows/` | Tests exist but not in pipeline | FIXED `958a052` PR#15 |
| M3 | **No linting in CI** | `.github/workflows/` | Lint not enforced | FIXED `958a052` PR#15 |
| M4 | **No security/dependency scanning** | CI pipeline | No Snyk/Dependabot/npm audit | OPEN |
| M5 | **Integration tests advisory only** | CI pipeline | Don't block deploy (`continue-on-error: true`) | OPEN |
| M6 | **Amazon MQ reconnect fixed 5s delay** | `features/messaging/` | Should use exponential backoff | FIXED `b617e2a` PR#12 |
| M7 | **ReactFlow not lazy-loaded** | Frontend bundle | 120KB loaded even if unused | OPEN |
| M8 | **No list virtualization** | User lists, audit logs | Performance at scale (100+ items) | OPEN |
| M9 | **Graceful shutdown incomplete** | `backend/src/app-fastify.ts` | Amazon MQ + WebSocket not flushed — events lost | FIXED `e4660a0` PR#13 |
| M10 | **Commit convention compliance 25%** | Git history | 15/20 recent commits missing `type:` prefix | OPEN |

---

## GITHUB STATUS (from T2)

| Field | Value |
|-------|-------|
| **Branch** | `main` |
| **Working tree** | Clean |
| **Unpushed** | 1 commit (`5d1d674 chore: ignore local Cursor and Claude workspace files`) |
| **Open PRs** | None |
| **Stale branches** | 6 remote (`backup-crm-integration`, `mfa-setup`, `rk/ui-upgrade`, `working`, `wrapper-v2`, `wrapper-v2-ui-upgrade`) |
| **Contributor** | Single (cdineshreddy12) — bus factor = 1 |

### File Hotspots (most changed recently)

| Changes | File | Risk |
|---------|------|------|
| 8 | `.github/workflows/deploy-ec2.yml` | HIGH — CI churn |
| 4 | `backend/src/db/run-migrations.ts` | MEDIUM |
| 3 | `backend/src/middleware/auth/auth.ts` | HIGH — security-sensitive |
| 3 | `backend/src/features/roles/services/permission-service.ts` | HIGH — 1957 LOC |
| 3 | `backend/src/features/organizations/routes/invitations.ts` | HIGH — 2766 LOC |

---

## ARCHITECTURE SUMMARY

```
wrapper-standalone/
  backend/     Fastify 4 | Drizzle ORM | PostgreSQL | 13 feature modules
  frontend/    React 19 | Vite 7 | TanStack Router+Query | Zustand | 13 feature modules
  infra/       Infrastructure configs
  docs/        Documentation
  pem_files/   TLS certificates
```

**Multi-tenancy (4 layers):** JWT auth -> Code-level tenantId filtering -> PostgreSQL RLS -> Data isolation middleware

**Key deps:** Fastify 4, Drizzle ORM, Stripe 14, Jose/JWT, Kinde, Winston, Amazon MQ, React 19, Vite 7, TanStack Router v1/Query v5, Zustand 4, ShadCN/Radix UI

---

## AGENT COORDINATION

| Agent | Terminal | Role | Status |
|-------|----------|------|--------|
| **Coordinator** | T1 | CLAUDE.md analysis, TASK_BOARD.md, delegation | ACTIVE |
| **GitHub Agent** | T2 | Git log, PR analysis, branch status, conventions | DONE — status captured above |
| **Log Capture** | T3 | Start dev server, tail logs, capture errors | READY |
| **Skills Agent** | T4 | /bridge-security, /bridge-scout, /bridge-shipper | READY |

---

## Live Log Analysis (T3 — 2026-03-27)

**Server startup:** SUCCESS — `tsx src/bootstrap.ts` starts on `http://0.0.0.0:3000` in ~10s

### Findings

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| L1 | **HIGH** | **`email: undefined` on every auth request** — FIXED `28cbd7c` PR#6 | `validateToken` returns `email: undefined` because Kinde access tokens (JWT) don't include `email`/`preferred_email` claims. The JWKS strategy succeeds (signature verified), but `normalizeKindePayload()` finds no email field in the JWT payload. **File:** `backend/src/features/auth/services/kinde-service.ts:57` — `email: u.email \|\| u.preferred_email` resolves to `undefined`. Auth still works because the user is looked up by `kindeUserId` in `tenant_users` table, but any code path relying on `userContext.email` from JWT will fail silently. |
| L2 | **MEDIUM** | **`No tenant found for org code: org_b060751e890`** | First request per session triggers a tenant lookup by Kinde org code that fails. Suppressed for 120s after first occurrence. Auth still succeeds by falling back to `tenant_users` table lookup. May indicate stale org mapping. |
| L3 | **LOW** | **Winston logger identity undefined** — FIXED `f11e8ee` PR#14 | Log line: `undefined [undefined] info: Server started successfully` — the Winston logger service name and instance ID are not being set correctly, producing `undefined [undefined]` prefix on structured logs. |
| L4 | **INFO** | **Email provider initialized twice** | Brevo email detection block runs twice during startup (lines ~28-34 and ~41-47 in logs). Duplicate initialization — not harmful but wasteful. |
| L5 | **INFO** | **Stripe in TEST mode** | `Stripe adapter initialised in TEST mode` — expected for local dev. |
| L6 | **INFO** | **Trial restriction bypassed** | `Trial restriction: BYPASSED for local development` on every request — expected for local dev. |
| L7 | **INFO** | **Redis disabled** | `Redis optional; app running without Redis` — no caching layer active. |
| L8 | **INFO** | **All external services connected** | DB (PostgreSQL), Amazon MQ, AWS Route 53, Kinde (JWKS), Brevo, Stripe — all initialized successfully. |

### Root Cause Analysis: `email: undefined` (L1)

**Flow:**
```
Request → authMiddleware → kindeService.validateToken(bearerToken)
  → kindeService.getUserInfo(token)
    → Strategy 0: verifyJWTSignature(token) ✅ succeeds
    → normalizeKindePayload(jwtPayload)
      → { email: payload.email || payload.preferred_email }  ← BOTH undefined
      → Kinde access tokens contain: sub, aud, iss, org_code, permissions — NOT email
  → Returns userContext with email: undefined
```

**Impact:** Auth succeeds (user found in DB by `kindeUserId`), but:
- Any feature sending email using `userContext.email` will fail or send to `undefined`
- Audit logs recording user email will store `undefined`
- The `User authenticated` log correctly shows tenantId/userId (populated from DB), but the JWT-derived email is lost

**Fix options:**
1. After JWKS validation, enrich email from the `tenant_users` DB record (already queried in auth middleware)
2. Request Kinde to include `email` claim in access tokens (Kinde dashboard → API settings → Token customization)
3. Fall through to `user_profile` API endpoint when email is missing from JWT claims

### Requests Observed

All captured requests were `GET /api/notifications?` — likely a frontend polling mechanism. No errors, all returned successfully.

---

## NEXT 3 TASKS — SecurityFix-3Tasks Swarm Assignment

### Swarm Task 1: S4 — Entity Routes Bypass App Isolation

| Field | Value |
|-------|-------|
| **Task ID** | S4 |
| **Priority** | P0 |
| **Files** | `backend/src/middleware/security/application-isolation.ts` (~line 37) |
| **Branch** | `fix/s4-entity-isolation-bypass` |

**Problem:** The application isolation middleware has a blanket `if (request.url.includes('/api/entities/')) return;` that skips ALL isolation checks for entity routes. Any entity endpoint — including ones that return sensitive org hierarchy data — bypasses app-level data isolation entirely.

**Fix:**
1. Remove the `request.url.includes('/api/entities/')` early return.
2. Instead, add entity routes to the isolation logic properly. Entity routes already receive `tenantId` from `request.userContext` (set by auth middleware). The isolation middleware should validate that the requested entity belongs to the user's tenant, not skip validation entirely.
3. If specific entity sub-routes genuinely need exemption (e.g., entity type metadata), allowlist those exact paths rather than the entire `/api/entities/` prefix.
4. Add a unit test confirming that `/api/entities/:id` requests DO pass through isolation checks.

---

### Swarm Task 2: L1 — Fix `email: undefined` on Every Auth Request

| Field | Value |
|-------|-------|
| **Task ID** | L1 |
| **Priority** | P0 (live runtime bug) |
| **Files** | `backend/src/middleware/auth/auth.ts` (where `userContext` is assembled after DB lookup), `backend/src/features/auth/services/kinde-service.ts` (~line 57) |
| **Branch** | `fix/l1-auth-email-undefined` |

**Problem:** Kinde access tokens (JWTs) do not contain `email` or `preferred_email` claims. `normalizeKindePayload()` in `kinde-service.ts:57` sets `email: payload.email || payload.preferred_email` which resolves to `undefined` on every request. Auth succeeds because the user is found by `kindeUserId` in `tenant_users`, but `userContext.email` is `undefined` — breaking email sending, audit logs, and any feature relying on it.

**Fix:**
1. In `auth.ts`, after the `tenant_users` DB lookup (which already happens for every authenticated request), enrich `userContext.email` from the DB record:
   ```typescript
   // Where userContext is assembled after DB lookup:
   email: userRecord.email || tokenResult.email,  // DB first, JWT fallback
   ```
2. In `kinde-service.ts`, make `normalizeKindePayload` return `email: undefined` explicitly (no behavior change, just clarity) — the real fix is in `auth.ts` where the DB record is available.
3. Add a log warning when email is missing from both JWT and DB record, so the edge case is visible.

---

### Swarm Task 3: S6 + S7 + S8 — Remaining P0 Security Hardening

| Field | Value |
|-------|-------|
| **Task ID** | S6, S7, S8 (bundled — all in-scope, no file overlap with Tasks 1-2) |
| **Priority** | P0 |
| **Files** | `frontend/src/features/auth/pages/InviteAccept.tsx` (lines 149, 164), `backend/src/app-fastify.ts` (CORS config + rate limit config) |
| **Branch** | `fix/s6-s7-s8-security-hardening` |

**S6 — Auth tokens in localStorage:**
1. In `InviteAccept.tsx`, replace `localStorage.setItem('pendingInvitationToken', token)` and `localStorage.getItem('pendingInvitationToken')` with `sessionStorage` (scoped to tab, cleared on close — reduces XSS window).
2. Alternatively, pass the invitation token via URL query parameter through the auth flow and remove storage entirely if the flow supports it.

**S7 — CORS regex too broad:**
1. In `app-fastify.ts`, replace the regex `/^https?:\/\/[a-z0-9-]+\.zopkit\.com$/i` with an explicit allowlist array of known subdomains:
   ```typescript
   const ALLOWED_ORIGINS = [
     process.env.FRONTEND_URL,           // e.g., https://app.zopkit.com
     'https://admin.zopkit.com',
     'https://api.zopkit.com',
   ].filter(Boolean);
   ```
2. Keep `localhost` origins gated behind `NODE_ENV === 'development'`.

**S8 — Auth endpoint rate limiting:**
1. In `app-fastify.ts`, add a stricter rate limit to auth routes using Fastify's `@fastify/rate-limit` `routeConfig` option:
   ```typescript
   fastify.register(authRoutes, {
     prefix: '/api/auth',
     config: { rateLimit: { max: 50, timeWindow: '15 minutes' } }
   });
   ```
2. This overrides the global 200/15min with 50/15min on `/api/auth/*` only.

---

## COMPLETED

- [x] T1: Read CLAUDE.md (17 sections) + package.json files
- [x] T1: Backend security audit (6 critical vulns confirmed with exact lines)
- [x] T1: Frontend code quality audit (729 `any`, router conflict, duplicates, large components)
- [x] T2: GitHub status, branch analysis, commit convention audit, file hotspots
- [x] T3: Live log capture — `email: undefined` confirmed, root cause traced to Kinde JWT missing email claim
- [x] S1: JWT secret fallback removed — `281da89`
- [x] S2: Stripe webhook bypass removed — `281da89`
- [x] S3: Super admin role tenantId filter added — `281da89`
- [x] S5: Data isolation tenantId filter added — `281da89`
- [x] S4: Entity isolation bypass removed — `eccab53` PR#5
- [x] L1: Auth email undefined fixed (Kinde userinfo fallback) — `28cbd7c` PR#6
- [x] S6: localStorage → sessionStorage for invitation tokens — `28cbd7c` PR#6
- [x] S7: CORS tightened to explicit subdomain allowlist — `28cbd7c` PR#6
- [x] S8: Auth endpoints rate limited to 50 req/15min — `28cbd7c` PR#6
- [x] H7: 3 numbered duplicate files removed — `096c6d9` PR#8
- [x] H6: Duplicate auth stores consolidated — `c9174e1` PR#9
- [x] H9: Webhook idempotency checks added — `c9174e1` PR#9
- [x] H5: Dead AppRoutes.tsx (react-router-dom) removed — `a9a561d` PR#11
- [x] H8: Credit purchase wrapped in DB transaction — `b617e2a` PR#12
- [x] M6: Amazon MQ exponential backoff reconnect — `b617e2a` PR#12
- [x] M9: Graceful shutdown MQ flush — `e4660a0` PR#13
- [x] L3: Winston logger identity fixed — `f11e8ee` PR#14
- [x] M2: Frontend tests added to CI — `958a052` PR#15
- [x] M3: Linting added to CI — `958a052` PR#15

---

## QUICK REFERENCE

- **Well-tested modules (pattern sources):** `credits/` (90%), `roles/` (80%), `subscriptions/` (60%)
- **All `useMutation` calls have `onError`** -- good practice maintained
- **Frontend console.log:** Only 4 instances in code (minimal)
- **Dev commands:** `pnpm dev` (both), `pnpm --filter wrapper-backend test`, `pnpm --filter wrapper-frontend dev`
