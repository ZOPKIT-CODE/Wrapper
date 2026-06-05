/**
 * Validate the migration journal — replaces the old db:check:registry (which
 * relied on the now-archived untracked-sql-allowlist.json).
 *
 * Asserts, for src/db/migrations/meta/_journal.json:
 *   1. every entry's `${tag}.sql` file exists,
 *   2. every non-archived `*.sql` file is in the journal (no orphans like the
 *      54 ad-hoc scripts that caused the original drift),
 *   3. `idx` is 0,1,2,… sequential,
 *   4. `when` is STRICTLY INCREASING (the custom migrator skips entries whose
 *      `when` <= the last-applied value, so a non-increasing `when` would be
 *      silently skipped on existing databases — the "when footgun").
 *
 * Exits non-zero on any violation. Run via `pnpm db:check:journal`.
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.cwd(), 'src/db/migrations');
const journal = JSON.parse(fs.readFileSync(path.join(dir, 'meta/_journal.json'), 'utf8'));
const entries = journal.entries ?? [];
const errors = [];

const sqlFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.sql') && f !== 'schema.sql');
const journalTags = new Set(entries.map((e) => e.tag));

for (const f of sqlFiles) {
  if (!journalTags.has(f.replace(/\.sql$/, ''))) {
    errors.push(`orphan SQL not in journal: ${f} (add it to meta/_journal.json, or move it to _archive/)`);
  }
}

let prevWhen = -Infinity;
entries.forEach((e, i) => {
  if (!fs.existsSync(path.join(dir, `${e.tag}.sql`))) errors.push(`journal entry ${e.tag} has no ${e.tag}.sql`);
  if (e.idx !== i) errors.push(`journal idx out of order at position ${i}: idx=${e.idx} (expected ${i})`);
  if (!(e.when > prevWhen)) {
    errors.push(`journal "when" not strictly increasing at ${e.tag}: ${e.when} <= ${prevWhen} (would be silently skipped on existing DBs)`);
  }
  prevWhen = e.when;
});

if (errors.length) {
  console.error('✗ Migration journal invalid:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ Migration journal OK (${entries.length} entries, strictly increasing whens, no orphan SQL).`);
