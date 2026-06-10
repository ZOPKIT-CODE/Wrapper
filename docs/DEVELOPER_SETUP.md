# Wrapper — Developer Setup & Workflow

A new dev should be able to clone, run, change the schema safely, and know exactly
what to run before pushing. The DB-safety commands below ship with the
`fix/migration-baseline` branch — merge it first, or they won't exist on `main`.

## 1. Prerequisites
- **Node ≥ 20** (CI uses 22 — install via `nvm` / `fnm`)
- **pnpm 9.15.4** — run `corepack enable` (it's pinned in `package.json`)
- **Docker** — required for backend integration tests (they spin a throwaway Postgres)
- git

## 2. First-time setup
```bash
git clone <repo> && cd wrapper
pnpm install                          # workspace install: backend + frontend + video

cp backend/.env.example  backend/.env     # template with current keys (Cognito, RDS notes)
cp frontend/.env.example frontend/.env
```
The backend validates required env on boot and tells you exactly what's missing.
Minimum to start: `DATABASE_URL` (+ `DB_MIGRATION_URL` for migrations), `JWT_SECRET`,
`SESSION_SECRET`, and the `COGNITO_*` keys.

> Never commit `.env` (it's gitignored). Secrets live in **AWS Secrets Manager**, not
> in a teammate's `.env`.

### 2.1 Where your `.env` values come from
`.env.example` is the up-to-date **template** (already Cognito + RDS — no Kinde, no
Supabase). The non-public values come from **AWS Secrets Manager** (you need AWS SSO —
`aws sso login`):

- **Cognito / JWT / app keys** — the whole runtime set lives in one JSON secret per
  app, `zopkit/staging/wrapper`. Pull and eyeball it:
  ```bash
  aws secretsmanager get-secret-value --region us-east-1 \
    --secret-id zopkit/staging/wrapper --query SecretString --output text | jq
  ```
  The `COGNITO_*` / `VITE_COGNITO_*` defaults already in `.env.example` point at the
  shared `zopkit-platform` pool and work as-is for local login.
- **Local-only secrets** (`JWT_SECRET`, `SESSION_SECRET`) — generate your own:
  `openssl rand -hex 32` (they only need to match between your backend and frontend).
- **Stripe/Brevo/OpenAI etc.** — optional locally; features degrade gracefully when unset.

### 2.2 Database — local Postgres or the shared staging RDS
Migrations reproduce production exactly, so a fresh DB comes up correct. **Supabase is
retired — the DB is AWS RDS now.** Pick one:

- **Local Postgres** (fully offline, recommended for most work):
  ```bash
  docker run -d --name wrapper-db -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=wrapper -p 5432:5432 postgres:15
  # in backend/.env set BOTH:
  #   DATABASE_URL=postgres://postgres:dev@localhost:5432/wrapper
  #   DB_MIGRATION_URL=postgres://postgres:dev@localhost:5432/wrapper
  cd backend && pnpm db:migrate         # applies 0000_baseline + the rest
  ```
- **Shared staging RDS** (real staging data; RDS is private, so go through the SSM
  tunnel — your home IP isn't allow-listed and CGNAT drifts it):
  ```bash
  ./deploy/ecs/db-tunnel.sh             # terminal 1: forwards localhost:5432 -> staging RDS (leave running)
  aws secretsmanager get-secret-value --region us-east-1 \
    --secret-id zopkit/staging/rds-wrapper-roles --query SecretString --output text | jq   # app = DML, migrator = DDL
  ```
  Then point `backend/.env` at the tunnel (host `localhost`, db `wrapper_staging`):
  ```env
  DATABASE_URL=postgresql://app_user:<pw>@localhost:5432/wrapper_staging?sslmode=require
  DB_MIGRATION_URL=postgresql://wrapper_migrator:<pw>@localhost:5432/wrapper_staging?sslmode=require
  ```
  Don't run destructive migrations against shared staging — use a local Postgres for that.

### 2.3 Browse / query the DB → Mathesar & the MCP
- **Mathesar (spreadsheet-style UI, zero setup):** open **https://db.staging.zopkit.com**
  and log in. It runs in-VPC and reaches the private RDS for you. Ask an admin for an
  account + the read-only `wrapper_viewer` role.
- **Query with Claude Code (Postgres MCP, auto-tunnel):** `./deploy/ecs/setup-db-mcp.sh wrapper`
  then restart Claude Code — no manual tunnel.

Full DB-access reference: **[`deploy/ecs/DB_ACCESS.md`](../deploy/ecs/DB_ACCESS.md)**.

## 3. Run it
```bash
pnpm dev          # backend (:3000) + frontend (:3001) together
# or: pnpm dev:backend  /  pnpm dev:frontend
```
- Health check → http://localhost:3000/health
- API docs → http://localhost:3000/docs
- UI → http://localhost:3001

## 4. Changing the database schema
This repo uses a **pg_dump baseline**, not `drizzle-kit generate` (which is disabled).
```bash
cd backend
pnpm db:new add_widget_table          # scaffolds the .sql + journal entry (auto when/idx)
#   ...write your SQL in src/db/migrations/00NN_add_widget_table.sql...
pnpm db:schema:dump                   # regenerate schema.sql  (needs Docker)
git add src/db/migrations/00NN_*.sql src/db/migrations/schema.sql src/db/migrations/meta/_journal.json
```
Full details: [`backend/src/db/migrations/README.md`](../backend/src/db/migrations/README.md).

## 5. ✅ Test before you push
Run what CI runs, so nothing bounces back:
```bash
# from the repo root
pnpm --filter wrapper-backend test               # unit (fast)
pnpm --filter wrapper-backend test:integration   # integration — needs Docker running
pnpm --filter wrapper-backend db:check:journal   # migration journal sanity
pnpm --filter wrapper-backend db:drift           # migrations reproduce schema.sql

pnpm --filter wrapper-backend exec tsc --noEmit  # backend type-check
pnpm --filter wrapper-frontend build             # frontend compiles
```
Shortcuts: `pnpm test` (both unit suites) and `pnpm test:integration`.

**What blocks a PR (CI gate):** backend **unit + integration + `db:drift` + `db:check:journal`**.

## 6. Good to know
- **Docker must be running** for integration tests — they create a throwaway Postgres
  (Testcontainers); no manual DB setup needed.
- **Never run `pnpm db:generate`** — it's disabled on purpose (the pg_dump baseline has
  no drizzle snapshot lineage). Use `pnpm db:new`.
- Commits are **conventional-commit** enforced (commitlint): `feat(...)`, `fix(...)`,
  `chore(...)`, etc.
- Heads-up: the backend `tsc` currently has a few **pre-existing** errors, and the
  frontend type-check / test suite isn't fully green yet — don't be alarmed; just make
  sure you don't *add* new failures.

## 7. Admin planes: tenant admin vs platform admin

There are **two separate admin planes** — don't conflate them.

| | Tenant admin | Platform admin |
|---|---|---|
| Who | A customer's own org administrator | Your internal staff (support, billing, ops) |
| Scope | One `tenant_id` | Cross-tenant |
| Signal | `tenant_users.is_tenant_admin` + an enumerated system role | `userContext.isPlatformAdmin` |
| Source of truth | DB (role assignment) | **Cognito group** `platform-admins` (the `cognito:groups` claim) |

`isSuperAdmin` is **tenant-scoped** ("has a system role within this tenant") — every tenant founder has it, so it is **never** a cross-tenant signal. Platform routes (`requirePlatformPermission` / `requirePlatformOrOwnTenant`, and platform-staff management) gate on `isPlatformAdmin` only.

**Seating a platform admin:**
1. Terraform creates the `platform-admins` Cognito group (`deploy/terraform/cognito.tf`); the backend reads its name from `COGNITO_PLATFORM_ADMIN_GROUP`.
2. Add a user to the group — AWS console, or `adminAddUserToGroup(email)` (`backend/src/features/auth/services/cognito-admin-service.ts`). They get the claim on their next token.
3. **Break-glass / first admin:** set `PLATFORM_ADMIN_BOOTSTRAP_EMAILS=you@zopkit.com` (comma-separated). These emails are treated as platform admins even without the group — **empty it once the group is populated.**

**Granting scoped platform staff** (time-boxed, audited cross-tenant ops without full admin): a platform admin calls `POST /api/internal/platform-staff/grant` (see `platform-staff-management.ts`). Each staff action is written to `platform_audit_logs` (audit-or-block).

## 8. Where things live
| Path | What |
|---|---|
| `backend/` | Fastify 5 API (ESM, drizzle 0.45, pino, postgres) |
| `frontend/` | React 19 + Vite 7 + Tailwind 4 (TanStack Router/Query) |
| `backend/src/db/migrations/` | Migrations + `schema.sql` + the migration README |
| `backend/scripts/db/` | `make-baseline`, `check-schema-drift`, `new-migration`, `check-journal` |
| `.github/workflows/` | `ci.yml` (PR gate), `db-schema-drift.yml`, `prod-schema-drift.yml`, `deploy.yml` (ECS), `infra-apply.yml` |
