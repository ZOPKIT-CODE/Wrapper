# Wrapper — Developer Onboarding (the golden path)

The one-page entry point for a new dev. It links the deep docs and codifies the
rules that keep you from breaking **production** (live on ECS at `zopkit.com`) or
the **migration baseline**. Read this once; bookmark the four docs in §0.

> TL;DR of "don't break legacy": **append-only migrations**, **run the gates
> locally before you push**, **let CI deploy** (don't hand-deploy), and **never
> edit the baseline or an already-applied migration**. Everything below expands
> these.

---

## 0. The map (where the deep docs live)

| Topic | Doc |
|---|---|
| Local setup, run, where things live | `docs/DEVELOPER_SETUP.md` |
| Migrations: baseline, guardrails, archive | `backend/src/db/migrations/README.md` |
| Deploying + the outage-prevention rules | `deploy/PLAYBOOK.md` |
| CI/CD + the full-infra `infra-apply` workflow | `deploy/ci/README.md` |
| Infra architecture (VPC→Fargate→ALB→CDN) | `deploy/INFRA_OVERVIEW.md` |

---

## 1. Day one — get it running

```bash
pnpm install                 # workspace root (backend + frontend)
cp backend/.env.example backend/.env     # fill in DB + Cognito + secrets (ask the team)
pnpm dev                     # backend :3000 + frontend :3001 (concurrently)
```

Full detail (DB pointing, Cognito, env vars): **`docs/DEVELOPER_SETUP.md` §1–3**.

The app is a pnpm monorepo: `backend/` (Fastify 5 + Drizzle) and `frontend/`
(React 19 + Vite + TanStack Router). Auth is **Cognito**, backend-mediated OAuth.

---

## 2. The golden path for any change

```
branch off main  →  code  →  run the gates LOCALLY  →  PR  →  CI gates  →  merge to main  →  CI auto-deploys staging
```

1. **Branch** off `main` (never commit straight to `main`).
2. **Code.** Match the surrounding style. Backend request validation uses Zod
   `safeParse` in handlers (NOT the `schema:{body}` option — it crashes with our
   zod version; see the blog feature notes).
3. **Run the gates locally** (§3) — the same ones CI runs. Green locally = green PR.
4. **Open a PR.** The PR gate (`.github/workflows/ci.yml`) runs:
   migration-journal sanity → schema-drift → backend unit → backend integration.
   **All four block the merge.**
5. **Merge to `main`.** A push to `main` triggers `deploy.yml`, which builds and
   **auto-deploys the backend + SPA to staging**. You do **not** hand-deploy.

---

## 3. Run the gates locally (do this before every push)

```bash
# from the repo root
pnpm test                 # unit tests (backend + frontend)
pnpm test:integration     # backend integration — spins a real postgres:15 (needs Docker)

# from backend/ — the DB guardrails
pnpm db:check:journal     # migration journal is monotonic, no orphan SQL files
pnpm db:drift             # migrations rebuild a DB that EXACTLY matches schema.sql
```

`pnpm lint` and `pnpm build` round it out. If `pnpm db:drift` fails, you changed
the schema without regenerating the snapshot — see §4.

---

## 4. Changing the database schema — WITHOUT breaking legacy

This is where prod gets broken if you're careless. The repo uses a **pg_dump
baseline** (`0000_baseline.sql`) + numbered forward migrations, NOT drizzle
snapshot lineage. The full rules are in `backend/src/db/migrations/README.md`;
the non-negotiables:

- **Append only.** Create a new migration; never edit `0000_baseline.sql` or any
  migration that has already merged/run. Prod and the journal have already
  recorded those hashes — editing one makes the live DB and the repo disagree.
  ```bash
  cd backend && pnpm db:new add_widget_table   # creates the next-numbered file
  #   ...write your forward SQL in it...
  pnpm db:schema:dump                           # regenerate schema.sql from the migrations
  pnpm db:drift                                 # must be clean
  ```
- **Idempotent DDL.** Use `CREATE TABLE/INDEX IF NOT EXISTS`, guarded `ALTER`s.
  The in-container runner can replay, and a live table may already exist.
- **Expand → migrate → contract** for anything destructive. Add the new
  column/table first, backfill, switch the code, and only drop the old shape in a
  *later* migration after the new code is live. Never drop-and-recreate a column
  a running app reads.
- **Commit `schema.sql` with the migration.** The drift gate (`db-schema-drift.yml`
  on PRs + pushes that touch `backend/src/db/**`) rebuilds a DB purely from the
  migrations and asserts it reproduces `schema.sql`. If you forgot the dump, it
  fails — that's the gate doing its job.
- **A weekly job (`prod-schema-drift.yml`, Mondays 06:00 UTC) diffs PROD against
  `schema.sql`.** If it goes red, the live DB drifted from the repo — investigate
  before shipping more schema changes (`pnpm db:check:prod-drift` locally with the
  prod URL).

> **Staging now runs on its own AWS RDS** (`zopkit-staging-db`, isolated from
> prod) — so a `main`-push staging migration no longer touches production. **Prod
> still runs on Supabase** (a separate DB), and is deployed deliberately, not from
> `main`. Still: a *prod* migration is irreversible — keep treating schema changes
> with production care.

---

## 5. Deploying & rollback (what's automated, what's manual)

- **App code (backend/SPA) → staging:** automatic on merge to `main` (`deploy.yml`).
  Manual/rollback: Actions → **deploy** → pick the service + an existing image SHA.
- **Production:** a separate Terraform `prod` workspace on `zopkit.com`. Prod is
  not auto-deployed from `main` yet; promote deliberately. See `deploy/PLAYBOOK.md`.
- **Infra changes (IAM, buckets, ALB, Cognito, SNS/SQS, Valkey)** are NOT covered
  by the app deploy — `deploy.yml` only does `terraform apply -target=module.services`.
  After any non-service Terraform change, run the **full apply**: Actions →
  **infra-apply** → pick env → `plan`, review, then `apply`. (This is the gap that
  once left a task-role grant un-applied and broke blog images.) Details in
  `deploy/ci/README.md`.
- **Rollback** = re-deploy the previous image SHA (app) or re-point DNS to the
  prior target (cutover). Nothing destructive is one-click.

---

## 6. Things that will bite you (legacy landmines)

- **Don't commit the parallel WIP.** The `fix/migration-baseline` branch carries a
  large set of in-progress files (platform-admin/Cognito changes, etc.). When you
  land a feature, stage **only your feature's files** — build from a clean
  `git worktree` at your commit if you need to verify a deploy artifact contains
  *only* committed code.
- **CRM `users` table is a VIEW** over `tenant_users` (a legacy shim). Don't
  "fix" the schema files that reference it — the editor reverts those edits.
- **No admin bypass in permission middleware.** Don't add
  `if (isAdmin) return` fast-paths; enumerate the permission codes in the role.
- **Frontend is no longer a PWA.** The service worker was removed (self-destroying
  migration); freshness comes from CloudFront (`index.html` is `no-cache`) + the
  `/api/version` "new version" banner. Don't re-add a caching SW without a reason.
- **Messaging is SNS+SQS, in-process** inside Fastify (not Lambda, not RabbitMQ).
  A new consumer must invalidate the in-memory + Valkey auth caches on
  `tenant.onboarded` / `role.*` or sessions serve stale permissions.
- **Restart the dev server after changing editor extensions / deleting modules.**
  Vite HMR can't recover a deleted module or a rebuilt Tiptap editor — a browser
  refresh isn't enough; restart the `pnpm dev` process.

---

## 7. Pre-push checklist

- [ ] `pnpm test` green (unit)
- [ ] `pnpm test:integration` green (real-schema integration; Docker running)
- [ ] `pnpm db:check:journal` + `pnpm db:drift` green (if you touched the schema)
- [ ] `schema.sql` regenerated & committed alongside any new migration
- [ ] migration is append-only + idempotent + expand/contract (no destructive drop a live app reads)
- [ ] only your feature's files are staged (no parallel WIP)
- [ ] `pnpm lint` + `pnpm build` clean

Green on all of the above ⇒ your PR will pass CI and merge safely. Welcome aboard.
