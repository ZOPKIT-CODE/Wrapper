# New Developer Guide — codebase → feature → review → ship (without breaking legacy)

The complete lifecycle for a developer joining an app in the Zopkit suite. Our
team runs **one developer per application** — so *you* own your app end-to-end.
That means the safety net isn't a senior reviewer catching your mistakes; it's
**you + the automated gates + these rules.** Read Part 2 twice.

> **The one rule that matters most:** treat every database migration as a
> *production* migration. Everything else you can recover from; a bad migration
> can lose data. See Part 2.

**Map of the deeper docs** (this guide links them; don't duplicate):
| Topic | Doc |
|---|---|
| Local setup detail | `docs/DEVELOPER_SETUP.md` |
| Migration rules + baseline | `backend/src/db/migrations/README.md` |
| Deploy + outage-prevention | `deploy/PLAYBOOK.md` |
| CI/CD + infra-apply | `deploy/ci/README.md` |
| DB access (Mathesar/tunnel/MCP) | `deploy/ecs/DB_ACCESS.md` |
| Quick onboarding | `docs/ONBOARDING.md` |

---

## Part 1 — Get the codebase running (day one)

```bash
git clone <your-app-repo> && cd wrapper
pnpm install                              # monorepo root: backend + frontend
cp backend/.env.example backend/.env      # fill DB + Cognito + secrets (ask the team)
pnpm dev                                  # backend :3000 + frontend :3001
```
Full detail (DB pointing, Cognito, env vars): **`docs/DEVELOPER_SETUP.md`**.

**What you're working in:** a pnpm monorepo — `backend/` (Fastify 5 + Drizzle ORM,
Postgres) and `frontend/` (React 19 + Vite + TanStack Router). Auth is **Cognito**
(backend-mediated OAuth). Apps talk to each other over **SNS/SQS**, not shared DBs.

**Where things live:** `backend/src/features/<feature>/` (routes + services +
schemas per feature), `backend/src/db/` (schema + migrations), `backend/src/middleware/`
(auth/permissions), `frontend/src/features/<feature>/`, `frontend/src/routes/`.

---

## Part 2 — The legacy landmines (how NOT to break prod)

This is the heart of the guide. Each rule below is something that has bitten us or
would silently break production.

### 2.1 Database migrations — the #1 risk
The repo uses a **pg_dump baseline** (`0000_baseline.sql`) + numbered forward
migrations (NOT drizzle snapshot lineage). Full rules in
`backend/src/db/migrations/README.md`. The non-negotiables:

- **Append only.** Create a NEW migration. **Never edit `0000_baseline.sql` or any
  migration that has already merged.** Prod and the migration journal already
  recorded those hashes — editing one makes the live DB and the repo disagree.
  ```bash
  cd backend && pnpm db:new add_widget_table   # creates the next-numbered file
  #   ...write your forward SQL in it...
  pnpm db:schema:dump                           # regenerate schema.sql from migrations
  pnpm db:drift                                 # MUST be clean before you push
  ```
- **Idempotent DDL.** `CREATE TABLE/INDEX IF NOT EXISTS`, guarded `ALTER`s. The
  in-container runner may replay; a live table may already exist.
- **Expand → migrate → contract** for anything destructive. Add the new
  column/table, backfill, switch the code, and only drop the old shape in a *later*
  migration after the new code is live. **Never drop-or-rename a column the running
  app still reads.**
- **Commit `schema.sql` with the migration.** The drift gate rebuilds a DB purely
  from migrations and asserts it reproduces `schema.sql`. Forgot the dump → CI fails.
- ✅ **The DB is AWS RDS — Supabase is retired.** Staging (`zopkit-staging-db`) and
  prod (`zopkit-prod-db`) are **separate** RDS instances, so a `main`-push staging
  migration never touches prod. Prod is deployed deliberately. A *prod* migration is
  still irreversible — treat schema changes to prod with production care. (How to reach
  either DB — Mathesar / tunnel / MCP — is in `deploy/ecs/DB_ACCESS.md`.)

### 2.2 Don't commit the parallel WIP
The active branch carries a large set of in-progress files (parallel feature work).
When you land your feature, **stage only your feature's files** (`git add` the
specific paths, not `git add -A`). If you need to verify a build/deploy artifact
contains *only* your committed code, build from a clean `git worktree` at your commit.

### 2.3 App-specific guardrails (don't "fix" these)
- **CRM `users` table is a VIEW** over `tenant_users` (a legacy shim). Don't refactor
  the schema files that reference it — the editor reverts those edits.
- **No admin bypass in permission middleware.** Never add `if (isAdmin) return`
  fast-paths — enumerate the permission codes in the role instead.
- **The frontend is no longer a PWA** — the service worker was removed
  (self-destroying migration). Freshness comes from CloudFront (`index.html` is
  `no-cache`) + the `/api/version` banner. Don't re-add a caching SW without reason.
- **Messaging is SNS+SQS, in-process** inside Fastify (not Lambda/RabbitMQ). A new
  consumer MUST invalidate the in-memory + Valkey auth caches on `tenant.onboarded`
  / `role.*` or live sessions serve stale permissions.
- **Request validation uses Zod `safeParse` in handlers**, NOT the `schema:{body}`
  Fastify option (it crashes with our zod version).

### 2.4 Editor/dev-server gotcha
After changing editor extensions or **deleting a module**, fully **restart
`pnpm dev`** — Vite HMR can't recover a deleted module or a rebuilt Tiptap editor,
and a browser refresh isn't enough.

---

## Part 3 — Build a feature

1. **Branch off `main`** (never commit straight to `main`):
   ```bash
   git checkout main && git pull && git checkout -b feat/<short-name>
   ```
2. **Write the code.** Match the surrounding style, naming, and structure of the
   feature folder you're in. Add tests alongside (`*.test.ts`).
3. **If you touch the schema**, follow Part 2.1 exactly.
4. **Keep it scoped** — one feature per branch; smaller PRs are easier to verify.

---

## Part 4 — Before you push: run the gates locally

Run the **same checks CI runs**, locally. Green here = green PR.

```bash
# from the repo root
pnpm test                 # unit (backend + frontend)
pnpm test:integration     # backend integration — spins a real postgres:15 (needs Docker)
pnpm lint
pnpm build

# from backend/ — only if you touched the DB
pnpm db:check:journal     # migration journal sane (monotonic, no orphan SQL)
pnpm db:drift             # migrations reproduce schema.sql exactly
```

### Pre-push checklist
- [ ] `pnpm test` + `pnpm test:integration` green
- [ ] `pnpm lint` + `pnpm build` clean
- [ ] (schema change) `db:check:journal` + `db:drift` green, `schema.sql` committed
- [ ] migration is **append-only + idempotent + expand/contract**
- [ ] **only your feature's files** are staged (no parallel WIP)
- [ ] no secrets committed (creds live in Secrets Manager / `.env`, both gitignored)

---

## Part 5 — Open a PR (CI is your reviewer)

Push your branch and open a PR to `main`. The **PR gate** (`.github/workflows/ci.yml`)
runs and **must be green before merge**:
1. **Migration journal + schema drift**
2. **Backend unit + integration**

Because we're one-dev-per-app, **CI is the gate** — there's no required human
approver. Do **not** merge a red PR, and do **not** push directly to `main`
(branch protection blocks this; if it doesn't yet, treat it as if it does).

---

## Part 6 — Code review (self-review + optional cross-app)

With one dev per app, *you* are the reviewer. Before merging your own PR, review the
**full diff** as if it were someone else's, against this checklist:

**Correctness & scope**
- [ ] The diff contains *only* what this feature needs — no stray/WIP files.
- [ ] Edge cases + error paths handled; new endpoints validate input (Zod safeParse).
- [ ] Tests cover the new behavior (and they actually fail without the change).

**Legacy safety (the important part)**
- [ ] Any migration is append-only, idempotent, expand/contract — re-read Part 2.1.
- [ ] No destructive change to a column/table the running app reads.
- [ ] No new admin-bypass; permissions enumerated in the role.
- [ ] A new SNS/SQS consumer invalidates the auth caches.
- [ ] No secret, no hard-coded prod value, no `console.log` of sensitive data.

**Blast radius**
- [ ] Could this change affect another app in the suite (shared events, shared DB)?
- [ ] Is it reversible (feature-flag / easy rollback)?

**Cross-app review (optional, for high-risk changes):** for migrations, auth/
permission changes, deploy/Terraform, or anything touching cross-app messaging,
ask the dev of another app to read the diff. A second set of eyes on the *risky*
20% is worth it even in a solo-per-app team; routine feature code doesn't need it.

---

## Part 7 — Merge & deploy

- **Merge to `main`** → `deploy.yml` **auto-builds + deploys to staging** and runs
  DB migrations (against the staging DB). You do **not** hand-deploy staging.
- **Verify on staging** — hit your feature on `*.staging.zopkit.com`, watch Sentry.
- **Production** is a **separate, deliberate step** (the `prod` Terraform workspace —
  see `deploy/PLAYBOOK.md`); it is *not* auto-deployed from `main`. Promote on purpose.
- **Infra changes** (IAM, buckets, ALB, Cognito, SNS/SQS) are NOT covered by the app
  deploy — run **Actions → infra-apply** (`plan`, review, `apply`). See `deploy/ci/README.md`.

---

## Part 8 — If something breaks

- **App regression on staging:** Actions → **deploy** → re-run with the previous
  image SHA (rollback). Nothing destructive is one-click.
- **Bad migration:** stop, don't push more schema changes. The DB has backups + PITR
  (on RDS). Write a *forward* fix migration (expand/contract) — never edit the bad one.
- **Prod drift alarm** (`prod-schema-drift`, weekly): the live DB diverged from the
  repo — investigate before shipping more schema changes.

---

## Appendix — command quick reference
```bash
# run
pnpm dev                         # backend + frontend
# test (do before every push)
pnpm test ; pnpm test:integration ; pnpm lint ; pnpm build
# schema change (from backend/)
pnpm db:new <name>               # new migration
pnpm db:schema:dump              # regenerate schema.sql
pnpm db:drift                    # must be clean
pnpm db:check:journal            # journal sanity
# see your DB
#   browse:  https://db.staging.zopkit.com  (Mathesar)
#   sql/MCP: ./deploy/ecs/db-tunnel.sh   (see deploy/ecs/DB_ACCESS.md)
```

**Golden path, in one line:**
`branch off main → code → run the gates locally → PR → CI green → merge → auto-deploy staging → verify → promote prod deliberately.`

Welcome aboard. When in doubt about anything touching the database, **stop and
re-read Part 2.**
