#!/usr/bin/env bash
#
# Catch OUT-OF-BAND production changes — the original sin that caused this whole
# mess (someone ALTERs prod by hand without a migration). The in-repo drift gate
# (check-schema-drift.sh) only proves migrations -> schema.sql; THIS proves
# schema.sql -> actual prod.
#
#   PROD_DB_URL=<prod connection> bash scripts/db/check-prod-drift.sh
#
# Run on a schedule (see .github/workflows/prod-schema-drift.yml).
#
# IMPORTANT:
#   - PROD_DB_URL must be IPv4-reachable. Supabase's direct `db.<ref>.supabase.co`
#     endpoint is IPv6-only; GitHub-hosted runners have no IPv6 — use the Supabase
#     POOLER URL (aws-0-<region>.pooler.supabase.com) for CI.
#   - This only matches once the pending migrations are actually deployed to prod.
#     Before deploy it will (correctly) report the pending 0002/0003 changes.
#
set -euo pipefail
cd "$(dirname "$0")/../.."   # -> backend/

SNAPSHOT="src/db/migrations/schema.sql"
PGVER="${PGVER:-15}"
: "${PROD_DB_URL:?set PROD_DB_URL to a (read-capable) production connection string}"

normalize() {
  grep -vE '^\\(restrict|unrestrict)|^-- Dumped (from|by)|^SELECT pg_catalog\.set_config.*search_path|^CREATE SCHEMA public;' \
    | sed -e '/^-- Name: __drizzle_migrations_id_seq/d' -e '/^CREATE SEQUENCE public\.__drizzle_migrations_id_seq/,/;/d'
}

export PROD_DB_URL
# --network host: Supabase direct endpoints are IPv6-only.
docker run --rm --network host --env PROD_DB_URL "postgres:${PGVER}-alpine" \
  sh -c 'pg_dump --schema-only --no-owner --no-privileges --schema=public --exclude-table=public.__drizzle_migrations "$PROD_DB_URL"' \
  | normalize > /tmp/prod-actual.sql

if diff -u <(normalize < "$SNAPSHOT") /tmp/prod-actual.sql; then
  echo "✓ Production schema matches ${SNAPSHOT} — no out-of-band drift."
else
  echo ""
  echo "✗ PRODUCTION DRIFT: prod differs from ${SNAPSHOT}."
  echo "  Either (a) someone changed prod outside a migration — capture it as a migration,"
  echo "  or (b) pending migrations haven't been deployed to prod yet."
  exit 1
fi
