# Wrapper

Multi-tenant SaaS platform — centralized auth, billing, RBAC, credit management, and event bus for a suite of business apps (CRM, HR, Accounting, etc.).

**Repo:** [github.com/Cdineshreddy12/Wrapper](https://github.com/Cdineshreddy12/Wrapper)

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Fastify 5 · TypeScript (ESM) · Drizzle ORM · PostgreSQL 15 (AWS RDS) · Zod |
| Frontend | React 19 · Vite 7 · TanStack Router/Query · Zustand · shadcn/ui · Tailwind 4 |
| Auth | AWS Cognito (OAuth2/OIDC, backend-mediated) · JWT (Jose) |
| Billing | Stripe (subscriptions, webhooks, credits) |
| Messaging | AWS SNS + SQS (in-process consumers) |
| Email | Brevo (Sendinblue) |
| DNS | AWS Route 53 (tenant subdomains) |
| Hosting | AWS ECS Fargate · S3 + CloudFront (SPA) |
| Logging | Pino · Sentry · OpenTelemetry |
| Package manager | pnpm 9 workspaces |

Optional (disabled by default): Redis/Valkey · Temporal · OpenAI

---

## Quick Start

**Prerequisites:** Node ≥ 20, pnpm ≥ 9, Docker (for a local Postgres / integration tests)

```bash
git clone https://github.com/Cdineshreddy12/Wrapper.git && cd Wrapper

pnpm install

cp backend/.env.example backend/.env      # fill in required vars (see below)
cp frontend/.env.example frontend/.env    # fill in required vars (see below)

pnpm --filter wrapper-backend db:migrate  # run migrations

pnpm dev                                  # backend :3000 + frontend :3001
```

Health check: `GET http://localhost:3000/health`
API docs (Swagger): `http://localhost:3000/docs`

---

## Required Environment Variables

### `backend/.env`

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/wrapper
JWT_SECRET=<openssl rand -hex 32>
SESSION_SECRET=<openssl rand -hex 32>

# AWS Cognito (shared zopkit-platform pool — defaults in .env.example work for local login)
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_DOMAIN=

FRONTEND_URL=http://localhost:3001
```

Everything else (Stripe, Brevo, AWS, Sentry) is optional for local dev — features
degrade gracefully when not configured. **Where these values come from (Secrets
Manager), and how to point the DB at a local Postgres or the staging RDS:**
see [`docs/DEVELOPER_SETUP.md`](docs/DEVELOPER_SETUP.md) §2.

### `frontend/.env`

```env
VITE_API_URL=http://localhost:3000/api
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_COGNITO_REDIRECT_URI=http://localhost:3001/auth/callback
VITE_COGNITO_LOGOUT_URI=http://localhost:3001
```

---

## Scripts

### Root

```bash
pnpm dev              # start both servers
pnpm build            # build both packages
pnpm lint             # lint both packages
pnpm test             # run all tests
```

### Backend (`pnpm --filter wrapper-backend <script>`)

```bash
dev                   # tsx watch (hot reload)
build                 # tsc → dist/
test                  # vitest run
test:integration      # vitest + Testcontainers (real PostgreSQL)
test:coverage         # coverage report
typecheck             # tsc --noEmit
db:migrate            # run pending migrations (0000_baseline + forward files)
db:new <name>         # scaffold the next forward migration (db:generate is DISABLED — pg_dump baseline, no drizzle snapshots)
db:drift              # assert migrations reproduce schema.sql (CI gate)
```

### Frontend (`pnpm --filter wrapper-frontend <script>`)

```bash
dev                   # vite :3001 (HMR)
build                 # production build → dist/
test                  # vitest
type-check            # tsc --noEmit
lint                  # eslint
```

---

## Architecture

```
Frontend (React 19, :3001)
    ↓ Axios (Bearer token + httpOnly cookies)
Backend (Fastify 5, :3000)
    → Auth middleware (JWT → userContext)
    → CSRF protection
    → Route handler → Service → Drizzle ORM
    ↓
PostgreSQL 15 / AWS RDS (RLS enforced per tenant)

External: AWS Cognito (OAuth2) · Stripe (billing) · SNS+SQS (inter-app events)
          Brevo (email) · Route 53 (DNS) · Sentry (errors)
```

**Multi-tenancy:** every DB query filters by `tenantId` extracted from the JWT — never from request params. PostgreSQL Row-Level Security is a second enforcement layer.

---

## Feature Modules

| Module | What it does |
|---|---|
| `auth` | Cognito OAuth2 login (backend-mediated), JWT issuance, token refresh |
| `users` | User CRUD, tenant verification, Cognito sync |
| `organizations` | Org hierarchy (org → location → dept → team), invitations |
| `roles` | Custom roles, permission matrix, RBAC |
| `subscriptions` | Stripe plans, checkout, trials, upgrades, webhooks |
| `credits` | Balance, purchase, consumption, expiry, ledger |
| `notifications` | In-app + email notifications (Brevo templates) |
| `messaging` | SNS publisher + in-process SQS consumers — inter-app events |
| `onboarding` | Company setup, PAN/GSTIN verification, DNS provisioning |
| `admin` | Platform admin — tenant management, credit config, trials |
| `app-sync` | Read APIs for downstream apps (CRM, HR, Accounting) |
| `webhooks` | Stripe webhook handlers (idempotent) |

Routes registered centrally in `backend/src/app-routes.ts`, all prefixed `/api/<module>`.

---

## Testing

```bash
pnpm --filter wrapper-backend test                 # 214 unit tests
pnpm --filter wrapper-backend test:integration     # Testcontainers (real PostgreSQL)
pnpm --filter wrapper-frontend test                # frontend component tests
```

Reference modules for patterns: `credits/`, `roles/`, `auth/`.

---

## Deployment

Production runs on **AWS ECS Fargate** (SPA on S3 + CloudFront). CI/CD via
`.github/workflows/deploy.yml` (push to `main` → staging):

1. Build + push the backend image (immutable git-SHA tag) to ECR
2. `terraform apply -target=module.services` to roll the ECS service
3. One-off Fargate task runs DB migrations (`node dist/db/run-migrations.js`)
4. Health check on `/health`; rollback = redeploy the previous image SHA

Production is a separate, deliberate promotion (the `prod` Terraform workspace).
Full detail: [`deploy/PLAYBOOK.md`](deploy/PLAYBOOK.md) · [`docs/ONBOARDING.md`](docs/ONBOARDING.md).

Stripe webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
