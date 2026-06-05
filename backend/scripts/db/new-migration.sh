#!/usr/bin/env bash
#
# Scaffold a new migration so nobody has to hand-pick the `when` timestamp or idx
# (the custom migrator skips entries whose `when` <= the last-applied value, so a
# too-small `when` is silently skipped on existing DBs).
#
#   pnpm db:new add_widget_table
#     -> creates src/db/migrations/00NN_add_widget_table.sql (empty)
#        and appends a journal entry with idx = last+1, when = last+1.
#
# Then: write your SQL in that file, run `pnpm db:schema:dump` to refresh
# schema.sql, and commit both. (Do NOT use `drizzle-kit generate` — this repo
# uses a pg_dump baseline with no drizzle snapshot lineage. See README.md.)
#
set -euo pipefail
cd "$(dirname "$0")/../.."   # -> backend/

NAME="${1:-}"
if [ -z "$NAME" ] || ! printf '%s' "$NAME" | grep -qE '^[a-z0-9_]+$'; then
  echo "usage: pnpm db:new <snake_case_name>   (lowercase, digits, underscores)" >&2
  exit 1
fi

TAG="$(node --input-type=module -e '
  import fs from "node:fs";
  const p = "src/db/migrations/meta/_journal.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const last = j.entries[j.entries.length - 1];
  const idx = last.idx + 1;
  const when = last.when + 1;                 // strictly greater -> always applies
  const tag = String(idx).padStart(4, "0") + "_" + process.argv[1];
  if (j.entries.some(e => e.tag === tag)) { console.error("tag already exists: " + tag); process.exit(1); }
  j.entries.push({ idx, version: "5", when, tag, breakpoints: false });
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  process.stdout.write(tag);
' "$NAME")"

FILE="src/db/migrations/${TAG}.sql"
printf -- "-- %s\n-- (plain SQL; statements run via the simple protocol. Add\n-- '%s' between statements only if you need them isolated.)\n\n" "$TAG" "--> statement-breakpoint" > "$FILE"

echo "✓ Created $FILE + journal entry."
echo "  Next: write your SQL, then  pnpm db:schema:dump  and commit $FILE, schema.sql, meta/_journal.json"
