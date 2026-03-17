# Wrapper

> Multi-tenant SaaS platform providing centralized authentication, billing, credit management, role-based access control, and application orchestration for a suite of business applications.

**Repository:** [github.com/Cdineshreddy12/Wrapper](https://github.com/Cdineshreddy12/Wrapper)

---

## Table of Contents

- [Wrapper](#wrapper)
  - [Table of Contents](#table-of-contents)
  - [Architecture](#architecture)
  - [Tech Stack](#tech-stack)
    - [Frontend](#frontend)
    - [Backend](#backend)
    - [Optional Services](#optional-services)
  - [Project Structure](#project-structure)
  - [Prerequisites](#prerequisites)
    - [Third-Party Accounts](#third-party-accounts)
  - [Getting Started](#getting-started)
    - [1. Clone the repository](#1-clone-the-repository)
    - [2. Install dependencies](#2-install-dependencies)
    - [4. Configure environment variables](#4-configure-environment-variables)
    - [5. Push the database schema](#5-push-the-database-schema)
    - [6. Start the development servers](#6-start-the-development-servers)
    - [7. Verify](#7-verify)
  - [Scripts Reference](#scripts-reference)
    - [Root (Monorepo)](#root-monorepo)
    - [Backend (`backend/`)](#backend-backend)
    - [Frontend (`frontend/`)](#frontend-frontend)
  - [Environment Variables](#environment-variables)
    - [Backend (`backend/.env`)](#backend-backendenv)
    - [Frontend (`frontend/.env`)](#frontend-frontendenv)
  - [Database Management](#database-management)
  - [Docker](#docker)
  - [Backend Features](#backend-features)
  - [API Routes](#api-routes)
  - [Troubleshooting](#troubleshooting)
  - [License](#license)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            Frontend                                  │
│               React 19 · Vite 7 · TailwindCSS 4 · shadcn/ui         │
│                    TanStack Router · Zustand                         │
├──────────────────────────────────────────────────────────────────────┤
│                           Backend API                                │
│            Fastify 4 · TypeScript · Drizzle ORM · Zod                │
├──────────┬──────────┬───────────┬───────────┬────────────────────────┤
│  Kinde   │  Stripe  │ Amazon MQ │ Route 53  │  OpenAI / Anthropic    │
│  (Auth)  │ (Billing)│ (Events)  │  (DNS)    │  (AI)                  │
├──────────┴──────────┴───────────┴───────────┴────────────────────────┤
│                          PostgreSQL                                  │
├──────────────────────────────────────────────────────────────────────┤
│          Optional: Redis · Elasticsearch · Temporal                  │
└──────────────────────────────────────────────────────────────────────┘
```

The React frontend (`localhost:3001`) communicates with the Fastify backend (`localhost:3000`) over REST. Authentication is handled by Kinde (OAuth2), billing by Stripe, inter-service messaging by Amazon MQ (RabbitMQ), DNS by AWS Route 53, and AI features by OpenAI and Anthropic.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 19 | UI library |
| TypeScript | Type safety |
| Vite 7 | Dev server and bundler |
| Tailwind CSS 4 | Utility-first styling |
| shadcn/ui + Radix UI | Component library |
| TanStack Router | Type-safe routing |
| TanStack Query | Server-state management and caching |
| TanStack Table | Data tables |
| Zustand | Client-state management |
| React Hook Form + Zod | Form handling and validation |
| Recharts | Charts and analytics |
| Framer Motion | Animations |
| Kinde Auth React SDK | Frontend authentication |
| Vitest + Testing Library | Unit and component testing |

### Backend

| Technology | Purpose |
|---|---|
| Node.js 18+ | Runtime |
| TypeScript | Type safety |
| Fastify 4 | HTTP framework (CORS, Helmet, JWT, rate limiting, Swagger) |
| Drizzle ORM + Drizzle Kit | Database ORM and migrations |
| PostgreSQL | Primary database |
| Zod | Schema validation |
| Stripe SDK | Payment processing |
| Jose + jsonwebtoken | JWT handling |
| Amazon MQ (amqplib) | Message queue |
| AWS Route 53 SDK | DNS management |
| Brevo (Sendinblue) | Transactional email |
| OpenAI + Anthropic SDKs | AI content generation |
| Winston | Logging |
| node-cron | Scheduled tasks |
| Vitest | Testing |

### Optional Services

| Service | Purpose | Required? |
|---|---|---|
| Redis | Caching | No (disabled by default) |
| Elasticsearch | Log aggregation | No |
| Temporal | Workflow orchestration | No (disabled by default) |

---

## Project Structure

```
Wrapper/
├── pnpm-workspace.yaml            # pnpm workspace configuration
├── package.json                    # Monorepo root
├── backend/
│   ├── package.json
│   ├── .env.example                # Environment template
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── src/
│       ├── bootstrap.ts            # Entry point
│       ├── app.ts                  # App initialization
│       ├── app-fastify.ts          # Fastify setup (CORS, cookies, rate limiting, Swagger)
│       ├── app-routes.ts           # Route registration
│       ├── db/                     # Drizzle schema, connection, migrations
│       ├── middleware/              # Auth, CSRF, error handling, trial restrictions
│       ├── features/               # Feature modules (see Backend Features)
│       ├── routes/                 # Shared routes (health, internal, suite, activity)
│       └── startup/                # Pre-boot scripts
├── frontend/
│   ├── package.json
│   ├── .env.example                # Environment template
│   ├── vite.config.ts              # Vite config (port 3001, PWA, chunking)
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx                 # Root component
│       ├── features/               # Feature modules (pages + components)
│       ├── components/
│       │   ├── auth/               # Auth guards, providers
│       │   ├── common/             # Reusable business components
│       │   ├── layout/             # Shell, sidebar, footer
│       │   └── ui/                 # shadcn/ui primitives
│       ├── stores/                 # Zustand state stores
│       ├── hooks/                  # Custom React hooks
│       ├── lib/                    # API client, utilities, query helpers
│       ├── contexts/               # React context providers
│       ├── services/               # Service integrations (JWT, notifications, CRM auth)
│       └── errors/                 # Error boundaries and fallbacks
└── infra/                          # Infrastructure scripts
```

---

## Prerequisites

| Requirement | Version | Verify | Install |
|---|---|---|---|
| **Node.js** | >= 18 | `node -v` | [nodejs.org](https://nodejs.org) or `nvm install 18` |
| **pnpm** | >= 9 | `pnpm -v` | `corepack enable` or `npm install -g pnpm` |
| **PostgreSQL** | >= 14 | `psql --version` | [postgresql.org](https://postgresql.org/download/) or `brew install postgresql@16` |
| **Git** | any | `git --version` | [git-scm.com](https://git-scm.com) |

### Third-Party Accounts

Required for full functionality. The app will run without these, but the corresponding features will be unavailable.

| Service | Purpose | Sign up |
|---|---|---|
| **Kinde** | Authentication (OAuth2) | [kinde.com](https://kinde.com) |
| **Stripe** | Billing and subscriptions | [stripe.com](https://stripe.com) |
| **AWS** (optional) | Route 53 DNS, Amazon MQ | [aws.amazon.com](https://aws.amazon.com) |
| **Brevo** (optional) | Transactional email | [brevo.com](https://brevo.com) |
| **OpenAI** (optional) | AI features | [platform.openai.com](https://platform.openai.com) |

---

## Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:Cdineshreddy12/Wrapper.git
cd Wrapper
```

Or via HTTPS:

```bash
git clone https://github.com/Cdineshreddy12/Wrapper.git
cd Wrapper
```

### 2. Install dependencies

This project uses **pnpm workspaces**. A single install from the root handles all packages:

```bash
pnpm install
```

### 4. Configure environment variables

**Backend:**

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set the following required values:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string from step 3 |
| `JWT_SECRET` | A strong random string (`openssl rand -hex 32`) |
| `SESSION_SECRET` | Another strong random string |
| `KINDE_DOMAIN` | Your Kinde domain (e.g. `https://your-app.kinde.com`) |
| `KINDE_CLIENT_ID` | From Kinde dashboard |
| `KINDE_CLIENT_SECRET` | From Kinde dashboard |
| `FRONTEND_URL` | `http://localhost:3001` |

Optional (recommended for full functionality):

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe test key (`sk_test_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe test key (`pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI or dashboard (`whsec_...`) |
| `OPENAI_API_KEY` | For AI features |
| `BREVO_API_KEY` | For transactional email |

All other variables have sensible defaults for local development.

**Frontend:**

```bash
cp frontend/.env.example frontend/.env
```

Open `frontend/.env` and set:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` |
| `VITE_API_BASE_URL` | `http://localhost:3000` |
| `VITE_KINDE_DOMAIN` | Same as backend `KINDE_DOMAIN` |
| `VITE_KINDE_CLIENT_ID` | Your Kinde frontend app client ID |
| `VITE_KINDE_REDIRECT_URI` | `http://localhost:3001/auth/callback` |
| `VITE_KINDE_LOGOUT_URI` | `http://localhost:3001` |
| `VITE_JWT_SECRET` | Must match backend `JWT_SECRET` |
| `VITE_ENV` | `development` |

### 5. Push the database schema

```bash
pnpm --filter wrapper-backend db:push
```

To inspect the database visually:

```bash
pnpm --filter wrapper-backend db:studio
```

### 6. Start the development servers

From the project root:

```bash
pnpm run dev
```

This starts both servers concurrently:

| Service | URL |
|---|---|
| Backend API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/docs |
| Frontend | http://localhost:3001 |

To start them individually:

```bash
pnpm run dev:backend     # Backend only
pnpm run dev:frontend    # Frontend only
```

### 7. Verify

- **Backend:** Open http://localhost:3000/health — should return a success response.
- **API docs:** Open http://localhost:3000/docs — interactive Swagger UI.
- **Frontend:** Open http://localhost:3001 — the app should load.

---

## Scripts Reference

### Root (Monorepo)

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm run dev` | Start backend + frontend concurrently |
| `pnpm run dev:backend` | Start backend only |
| `pnpm run dev:frontend` | Start frontend only |
| `pnpm run build` | Build backend + frontend for production |
| `pnpm run start` | Start production servers |
| `pnpm run lint` | Lint all packages |
| `pnpm run test` | Run all tests |
| `pnpm run clean` | Remove all `node_modules` |

### Backend (`backend/`)

| Command | Description |
|---|---|
| `pnpm run dev` | Dev server with hot reload (`tsx watch`) |
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run start` | Start production server |
| `pnpm run test` | Run tests (Vitest) |
| `pnpm run test:coverage` | Run tests with coverage |
| `pnpm run lint` | Lint source code |
| `pnpm run typecheck` | Type-check without emitting |
| `pnpm run db:push` | Push Drizzle schema to database |
| `pnpm run db:generate` | Generate migration files |
| `pnpm run db:migrate` | Run pending migrations |
| `pnpm run db:studio` | Open Drizzle Studio (database GUI) |
| `pnpm run db:introspect` | Introspect existing database into schema |

### Frontend (`frontend/`)

| Command | Description |
|---|---|
| `pnpm run dev` | Dev server on `:3001` with HMR |
| `pnpm run build` | Production build (outputs to `dist/`) |
| `pnpm run preview` | Preview production build locally |
| `pnpm run test` | Run tests (Vitest) |
| `pnpm run test:coverage` | Run tests with coverage |
| `pnpm run lint` | Lint source code |
| `pnpm run lint:fix` | Lint and auto-fix |
| `pnpm run type-check` | Type-check without emitting |
| `pnpm run format` | Format code with Prettier |
| `pnpm run build:analyze` | Production build with bundle analysis |

---

## Environment Variables

### Backend (`backend/.env`)

<details>
<summary>Click to expand full variable list</summary>

| Variable | Default | Description |
|---|---|---|
| **Server** | | |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `info` | Winston log level |
| **Database** | | |
| `DATABASE_URL` | — | PostgreSQL connection string **(required)** |
| `DB_POOL_SIZE` | `10` | Connection pool size |
| **Authentication** | | |
| `KINDE_DOMAIN` | — | Kinde tenant URL **(required)** |
| `KINDE_CLIENT_ID` | — | Kinde app client ID **(required)** |
| `KINDE_CLIENT_SECRET` | — | Kinde app secret **(required)** |
| `KINDE_M2M_CLIENT_ID` | — | Machine-to-machine client ID |
| `KINDE_M2M_CLIENT_SECRET` | — | Machine-to-machine secret |
| **Security** | | |
| `JWT_SECRET` | — | JWT signing key **(required)** |
| `SESSION_SECRET` | — | Session signing key **(required)** |
| **URLs** | | |
| `FRONTEND_URL` | `http://localhost:3001` | Frontend origin (CORS) |
| `BACKEND_URL` | `http://localhost:3000` | Backend origin |
| **Stripe** | | |
| `STRIPE_SECRET_KEY` | — | Stripe API secret key |
| `STRIPE_PUBLISHABLE_KEY` | — | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |
| **AWS** | | |
| `AWS_ACCESS_KEY_ID` | — | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | — | AWS credentials |
| `AWS_REGION` | `us-east-1` | AWS region |
| **Messaging** | | |
| `AMAZON_MQ_URL` | — | RabbitMQ connection URL |
| **Email** | | |
| `BREVO_API_KEY` | — | Brevo API key |
| **AI** | | |
| `OPENAI_API_KEY` | — | OpenAI API key |
| **Optional Services** | | |
| `REDIS_ENABLED` | `false` | Enable Redis caching |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `TEMPORAL_ENABLED` | `false` | Enable Temporal workflows |
| `DEFAULT_FREE_CREDITS` | `100` | Credits given to new tenants |
| `TRIAL_PERIOD_DAYS` | `14` | Free trial duration |

</details>

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` | Backend API URL |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Backend base URL |
| `VITE_KINDE_DOMAIN` | — | Kinde tenant URL **(required)** |
| `VITE_KINDE_CLIENT_ID` | — | Kinde frontend client ID **(required)** |
| `VITE_KINDE_REDIRECT_URI` | `http://localhost:3001/auth/callback` | OAuth callback URL |
| `VITE_KINDE_LOGOUT_URI` | `http://localhost:3001` | Post-logout redirect |
| `VITE_WRAPPER_DOMAIN` | `http://localhost:3001` | App domain |
| `VITE_CRM_DOMAIN` | `http://localhost:3002` | CRM app domain |
| `VITE_JWT_SECRET` | — | JWT secret (must match backend) |
| `VITE_GEMINI_API_KEY` | — | Google Gemini API key (optional) |
| `VITE_ENV` | `development` | Environment flag |

---

## Database Management

Drizzle ORM handles all schema and migration operations.

```bash
# Push schema directly (development)
pnpm --filter wrapper-backend db:push

# Generate a migration file from schema changes
pnpm --filter wrapper-backend db:generate

# Run pending migrations (production)
pnpm --filter wrapper-backend db:migrate

# Browse the database visually
pnpm --filter wrapper-backend db:studio

# Pull existing database into Drizzle schema
pnpm --filter wrapper-backend db:introspect
```

---

## Docker

A multi-stage Dockerfile is available for the backend:

```bash
cd backend

# Build
docker build -t wrapper-backend .

# Run
docker run -p 3000:3000 --env-file .env wrapper-backend
```

The production target runs as a non-root user and includes a health check on `/health`.

---

## Backend Features

| Feature | Directory | Description |
|---|---|---|
| Admin | `backend/src/features/admin/` | Platform administration — tenants, entities, credits, notifications, trials |
| App Sync | `backend/src/features/app-sync/` | Data sync APIs for downstream apps (CRM, HR, etc.) |
| Auth | `backend/src/features/auth/` | OAuth2 login via Kinde — social providers, org-scoped login, tokens |
| Credits | `backend/src/features/credits/` | Balances, purchases, consumption, transfers, expiry |
| Messaging | `backend/src/features/messaging/` | Amazon MQ event bus — inter-app events and job queues |
| Notifications | `backend/src/features/notifications/` | In-app notifications with templates, queue processing, AI content |
| Onboarding | `backend/src/features/onboarding/` | Tenant setup — company info, PAN/GSTIN, subdomain/DNS, invites |
| Organizations | `backend/src/features/organizations/` | Org hierarchy, locations, entities, invitations |
| Roles | `backend/src/features/roles/` | Roles, permissions, permission matrix, tier-based access |
| Subscriptions | `backend/src/features/subscriptions/` | Stripe billing — plans, checkout, trials, payments, upgrades |
| Users | `backend/src/features/users/` | User profiles, tenant verification, classification |
| Webhooks | `backend/src/features/webhooks/` | Stripe forwarding, external webhook handling |

Each feature directory contains its own `README.md` with detailed endpoint documentation.

---

## Integration Guardrails

- New third-party SDK usage should be introduced behind a feature `ports/` interface and `adapters/` implementation.
- Prefer `get*Provider()` / `get*Gateway()` accessors in routes/services instead of direct SDK imports.
- For high-churn billing/tenant/credit flows, place DB access behind repository wrappers before adding complex business logic.
- Keep simple CRUD paths direct until there is clear complexity or testability pressure.

---

## API Routes

All routes are prefixed with `/api`. Interactive documentation is available at [`/docs`](http://localhost:3000/docs) (Swagger UI).

| Prefix | Feature |
|---|---|
| `/api/auth` | Authentication (login, callback, logout, token refresh) |
| `/api/onboarding` | Tenant onboarding flows |
| `/api/tenants` | Tenant CRUD and settings |
| `/api/users` | User management |
| `/api/entities` | Unified entities (organizations, locations, departments, teams) |
| `/api/roles` | Roles and permissions |
| `/api/permissions` | Permission management |
| `/api/subscriptions` | Billing, plans, and subscriptions |
| `/api/credits` | Credit system |
| `/api/notifications` | Notification management |
| `/api/admin/*` | Admin panel endpoints |
| `/api/webhooks` | Webhook handlers (Stripe, etc.) |
| `/api/sync` | App sync for downstream apps |
| `/health` | Health check |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `pnpm run dev` fails with "concurrently not found" | Run `pnpm install` from the project root |
| Database connection refused | Ensure PostgreSQL is running and `DATABASE_URL` is correct |
| `db:push` fails | Verify the database exists and the user has `CREATE` privileges |
| Frontend shows blank page | Check browser console; ensure `VITE_API_URL` points to the running backend |
| Auth redirects fail | Verify Kinde redirect URIs in your `.env` match exactly |
| Stripe webhooks not working locally | Use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Port already in use | Kill the process: `lsof -ti:3000 \| xargs kill` or change `PORT` in `.env` |

---

## License

Proprietary. All rights reserved.
