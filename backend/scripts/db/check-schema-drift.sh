#!/usr/bin/env bash
#
# Schema-drift gate (Rails structure.sql / Atlas `migrate diff` style).
#
# Builds a FRESH database purely from the migrations, dumps its schema, and
# compares it to the committed canonical snapshot `src/db/migrations/schema.sql`.
#
#   - In CI / normally:   bash scripts/db/check-schema-drift.sh
#       Exits non-zero if the migrations no longer reproduce schema.sql
#       (i.e. a migration changed the schema but schema.sql wasn't regenerated,
#        or someone edited schema.sql by hand).
#
#   - After adding a migration:  WRITE=1 bash scripts/db/check-schema-drift.sh
#       Regenerates schema.sql from the migrations. Commit the result.
#
# Pair this with a periodic job that diffs schema.sql against a prod `pg_dump`
# to catch OUT-OF-BAND prod changes (the exact failure mode that created the
# original drift). Requires Docker.
#
set -euo pipefail
cd "$(dirname "$0")/../.."   # -> backend/

SNAPSHOT="src/db/migrations/schema.sql"
PGVER="${PGVER:-15}"
PORT="${DRIFT_PORT:-5489}"
NAME="wrapper-drift-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "→ Spinning a fresh postgres:${PGVER} and applying ALL migrations…"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=driftdb -p "${PORT}:5432" "postgres:${PGVER}-alpine" >/dev/null
# Readiness: pg_isready is satisfiable by the TEMP server the official image
# runs during initdb, which then shuts down ("the database system is shutting
# down") right as our first real psql connects — a flaky race on slow runners.
# Require TWO consecutive successful real queries 1s apart; the brief temp-server
# window cannot produce that.
ok=0
for _ in $(seq 1 60); do
  if docker exec "$NAME" psql -U postgres -d driftdb -qAt -c 'SELECT 1' >/dev/null 2>&1; then
    ok=$((ok+1)); [ "$ok" -ge 2 ] && break
  else
    ok=0
  fi
  sleep 1
done
if [ "$ok" -lt 2 ]; then
  echo "✗ postgres container never became ready" >&2
  docker logs "$NAME" 2>&1 | tail -20 >&2
  exit 2
fi

# Roles the grant migration (0001) targets — created by infra in real envs.
docker exec "$NAME" psql -U postgres -d driftdb -q -c \
  "DO \$\$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_user') THEN CREATE ROLE app_user; END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wrapper_migration_user') THEN CREATE ROLE wrapper_migration_user; END IF;
   END \$\$;"

# Apply migrations via the SAME runtime migrator the app uses.
# Override ALL three connection vars (dotenv won't override pre-set vars) so this
# can NEVER touch the prod DB from .env, even by precedence accident.
URL="postgres://postgres:test@localhost:${PORT}/driftdb"
DATABASE_URL="$URL" MIGRATION_DATABASE_URL="$URL" DB_MIGRATION_URL="$URL" \
  node --import tsx src/db/run-migrations.ts >/dev/null

# Dump + normalize (strip volatile bits: the random \restrict token + version banner).
normalize() { grep -vE '^\\(restrict|unrestrict)|^-- Dumped (from|by)|^SELECT pg_catalog\.set_config.*search_path|^CREATE SCHEMA public;' \
  | sed -e '/^-- Name: __drizzle_migrations_id_seq/d' -e '/^CREATE SEQUENCE public\.__drizzle_migrations_id_seq/,/;/d'; }
docker exec "$NAME" pg_dump --schema-only --no-owner --no-privileges --schema=public \
  --exclude-table=public.__drizzle_migrations -U postgres -d driftdb | normalize > /tmp/drift-actual.sql

if [ "${WRITE:-0}" = "1" ]; then
  cp /tmp/drift-actual.sql "$SNAPSHOT"
  echo "✓ Regenerated ${SNAPSHOT} ($(grep -cE '^CREATE TABLE' "$SNAPSHOT") tables). Commit it."
  exit 0
fi

if [ ! -f "$SNAPSHOT" ]; then
  echo "✗ ${SNAPSHOT} is missing. Generate it once with: WRITE=1 bash scripts/db/check-schema-drift.sh"
  exit 1
fi

if diff -u <(normalize < "$SNAPSHOT") /tmp/drift-actual.sql; then
  echo "✓ No schema drift — the migrations reproduce ${SNAPSHOT} exactly."
else
  echo ""
  echo "✗ SCHEMA DRIFT: applying the migrations no longer reproduces ${SNAPSHOT}."
  echo "  If you intended a schema change, add a migration and regenerate the snapshot:"
  echo "      WRITE=1 bash scripts/db/check-schema-drift.sh && git add ${SNAPSHOT}"
  exit 1
fi
