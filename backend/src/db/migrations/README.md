# Database migrations

This repo uses a **squashed pg_dump baseline** (`0000_baseline.sql`), not the
default drizzle-kit generate workflow. Production is the source of truth.

## How a fresh database is built

The custom migrator (`src/db/run-migrations.ts`, shared via `src/db/apply-migrations.ts`)
reads `meta/_journal.json` and applies each `<tag>.sql` in order:

- `0000_baseline.sql` — a faithful `pg_dump --schema-only` of production (all tables,
  indexes, FKs, functions, triggers). Applied whole via the simple protocol.
- `0001+` — incremental, **hand-written** SQL migrations on top.

Existing databases are not re-baselined: the migrator skips entries whose `when`
is `<=` the last applied value, so deployed prod/staging only pick up new migrations.

## Adding a migration

```bash
pnpm db:new add_widget_table     # scaffolds 00NN_add_widget_table.sql + journal entry
#   ...write your SQL in that file...
pnpm db:schema:dump              # regenerates schema.sql from the migrations (Docker)
git add src/db/migrations/00NN_add_widget_table.sql src/db/migrations/schema.sql src/db/migrations/meta/_journal.json
```

- **Do NOT run `drizzle-kit generate` / `pnpm db:generate`.** There is no drizzle
  snapshot lineage (the baseline is a pg_dump), so it produces garbage. It's
  disabled and will error.
- `pnpm db:new` computes the `when` timestamp and `idx` for you — never hand-pick them.
- Plain multi-statement SQL is fine (it runs via the simple protocol). Add
  `--> statement-breakpoint` between statements only if they must be isolated.

## Guardrails (CI)

- `pnpm db:check:journal` — journal is well-formed (sequential `idx`, strictly
  increasing `when`, every tag has a `.sql`, no orphan SQL). Runs on PRs + deploy.
- `pnpm db:drift` — builds a fresh DB from the migrations and asserts it reproduces
  `schema.sql` (the committed canonical snapshot). Runs on PRs + deploy.
  → If you changed the schema, regenerate with `pnpm db:schema:dump`.
- Integration tests (`pnpm test:integration`) build the test DB exactly like prod
  (no shim) and run against the real schema — **blocking on PRs** (`.github/workflows/ci.yml`).
- `pnpm db:check:prod-drift` (scheduled, `.github/workflows/prod-schema-drift.yml`)
  diffs LIVE prod against `schema.sql` to catch out-of-band `ALTER`s. Needs the
  `PROD_DB_URL` secret (Supabase **pooler** URL — runners have no IPv6).

## Refreshing the baseline (occasional)

To re-squash from current production (e.g. after several migrations accumulate):

```bash
pnpm db:baseline          # pg_dump prod -> 0000_baseline.sql  (uses .env DB_MIGRATION_URL)
# then reset the journal to just the baseline + regenerate schema.sql
```

## `_archive/`

The 26 old journaled migrations + 54 orphan ad-hoc scripts that predate the baseline.
Kept for history; **not** applied. The orphans (never in any journal) are exactly why
replaying the old chain could not reproduce prod.
