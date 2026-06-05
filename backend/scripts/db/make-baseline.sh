#!/usr/bin/env bash
#
# Regenerate the squashed baseline migration from the canonical PRODUCTION schema.
#
# Why: replaying the historical migration chain on a fresh DB does NOT reproduce
# production (orphan ad-hoc SQL never made it into the journal). Like Rails
# structure.sql / GitLab init_structure.sql, we treat prod as the source of truth
# and bake one faithful baseline that a fresh DB loads to match prod exactly.
#
# Uses pg_dump (via a Postgres container — it captures triggers/functions/
# sequences that drizzle-kit introspect drops) against the PRIVILEGED migration
# URL (the app role can't see every table). Read-only against the DB.
#
# The output is drizzle/runtime-migrator compatible: the runtime migrator detects
# the absence of `--> statement-breakpoint` and applies it via the simple protocol.
#
# Usage:
#   bash scripts/db/make-baseline.sh                 # -> src/db/migrations/0000_baseline.sql
#   OUT=/tmp/baseline.sql bash scripts/db/make-baseline.sh
#
set -euo pipefail
cd "$(dirname "$0")/../.."   # -> backend/

OUT="${OUT:-src/db/migrations/0000_baseline.sql}"
PGVER="${PGVER:-15}"         # must match the prod major (prod is PostgreSQL 15.x)

# Resolve the PRIVILEGED prod connection from .env WITHOUT printing it.
export __DBURL="$(node --input-type=commonjs -e "require('dotenv').config(); process.stdout.write(process.env.DB_MIGRATION_URL||process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL||'')")"
if [ -z "${__DBURL}" ]; then
  echo "✗ No DB_MIGRATION_URL / MIGRATION_DATABASE_URL / DATABASE_URL found in .env" >&2
  exit 1
fi

echo "→ pg_dump --schema-only (via postgres:${PGVER} container, host network for Supabase IPv6)…"
# --network host: Supabase's direct endpoint is IPv6-only; the Docker bridge has no IPv6 route.
# Strip psql-only meta-commands (\restrict/\unrestrict) and `CREATE SCHEMA public;` (always pre-exists).
docker run --rm --network host --env __DBURL "postgres:${PGVER}-alpine" \
  sh -c 'pg_dump --schema-only --no-owner --no-privileges --schema=public --exclude-table=public.__drizzle_migrations "$__DBURL"' \
  | grep -vE '^\\(restrict|unrestrict)|^CREATE SCHEMA public;|^SELECT pg_catalog\.set_config.*search_path' \
  | sed -e '/^-- Name: __drizzle_migrations_id_seq/d' -e '/^CREATE SEQUENCE public\.__drizzle_migrations_id_seq/,/;/d' \
  > "${OUT}"
unset __DBURL

tables=$(grep -cE '^CREATE TABLE' "${OUT}" || true)
echo "✓ Wrote ${OUT} — ${tables} tables, $(wc -l < "${OUT}") lines."
echo "  Next: archive the old migrations + point _journal.json at this single baseline (see scripts/db/README.md)."
