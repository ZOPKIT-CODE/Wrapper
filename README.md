# Wrapper

Multi-tenant SaaS platform — centralized auth, billing, RBAC, credit management, and event bus for a suite of business apps (CRM, HR, Accounting, etc.).

**Repo:** [github.com/Cdineshreddy12/Wrapper](https://github.com/Cdineshreddy12/Wrapper)

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Fastify 4 · TypeScript · Drizzle ORM · PostgreSQL 15 · Zod |
| Frontend | React 19 · Vite 7 · TanStack Router/Query · Zustand · shadcn/ui · Tailwind 4 |
| Auth | Kinde (OAuth2/OIDC) · JWT (Jose) |
| Billing | Stripe (subscriptions, webhooks, credits) |
| Messaging | AWS SNS + SQS |
| Email | Brevo (Sendinblue) |
| DNS | AWS Route 53 (tenant subdomains) |
| Logging | Winston · Elasticsearch · Sentry |
| Package manager | pnpm 9 workspaces |

Optional (disabled by default): Redis · Temporal · OpenAI

---

## Quick Start

**Prerequisites:** Node ≥ 18, pnpm ≥ 9, PostgreSQL 15

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

# Kinde (https://kinde.com)
KINDE_DOMAIN=https://your-app.kinde.com
KINDE_CLIENT_ID=
KINDE_CLIENT_SECRET=
KINDE_M2M_CLIENT_ID=
KINDE_M2M_CLIENT_SECRET=

FRONTEND_URL=http://localhost:3001
```

Everything else (Stripe, Amazon MQ, Brevo, AWS, Sentry) is optional for local dev — features degrade gracefully when not configured.

### `frontend/.env`

```env
VITE_API_URL=http://localhost:3000/api
VITE_KINDE_DOMAIN=https://your-app.kinde.com
VITE_KINDE_CLIENT_ID=
VITE_KINDE_REDIRECT_URI=http://localhost:3001/auth/callback
VITE_KINDE_LOGOUT_URI=http://localhost:3001
VITE_JWT_SECRET=<same as backend JWT_SECRET>
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
db:migrate            # run pending migrations
db:generate           # generate migration from schema changes
db:studio             # Drizzle Studio (database GUI)
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
Backend (Fastify 4, :3000)
    → Auth middleware (JWT → userContext)
    → CSRF protection
    → Route handler → Service → Drizzle ORM
    ↓
PostgreSQL 15 (RLS enforced per tenant)

External: Kinde (OAuth2) · Stripe (billing) · Amazon MQ (events)
          Brevo (email) · Route 53 (DNS) · Sentry (errors)
```

**Multi-tenancy:** every DB query filters by `tenantId` extracted from the JWT — never from request params. PostgreSQL Row-Level Security is a second enforcement layer.

---

## Feature Modules

| Module | What it does |
|---|---|
| `auth` | Kinde OAuth2 login, JWT issuance, token refresh |
| `users` | User CRUD, tenant verification, Kinde sync |
| `organizations` | Org hierarchy (org → location → dept → team), invitations |
| `roles` | Custom roles, permission matrix, RBAC |
| `subscriptions` | Stripe plans, checkout, trials, upgrades, webhooks |
| `credits` | Balance, purchase, consumption, expiry, ledger |
| `notifications` | In-app + email notifications (Brevo templates) |
| `messaging` | Amazon MQ publisher — inter-app events with circuit breaker |
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

CI/CD via `.github/workflows/deploy-ec2.yml`:

1. Type-check + unit tests (blocking gate)
2. Frontend `vite build` + backend `tsc`
3. Rsync to EC2 → `pnpm install --frozen-lockfile` → `db:migrate` → `pm2 reload`
4. Health check with auto-rollback on failure

Stripe webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
