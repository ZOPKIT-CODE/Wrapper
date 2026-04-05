import fs from 'node:fs';
import path from 'node:path';

type Journal = {
  entries: Array<{ tag: string }>;
};

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function main(): void {
  const migrationsDir = path.resolve(process.cwd(), 'src/db/migrations');
  const journalPath = path.join(migrationsDir, 'meta', '_journal.json');
  const allowlistPath = path.join(migrationsDir, 'meta', 'untracked-sql-allowlist.json');

  const journal = readJsonFile<Journal>(journalPath);
  const trackedSql = new Set(journal.entries.map((entry) => `${entry.tag}.sql`));

  const allowlistedSql = fs.existsSync(allowlistPath)
    ? new Set(readJsonFile<string[]>(allowlistPath))
    : new Set<string>();

  const allSql = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const missingJournalFiles = [...trackedSql].filter((file) => !allSql.includes(file));
  const untrackedSql = allSql.filter((file) => !trackedSql.has(file) && !allowlistedSql.has(file));

  if (missingJournalFiles.length > 0 || untrackedSql.length > 0) {
    console.error('\n❌ Migration registry check failed.\n');

    if (missingJournalFiles.length > 0) {
      console.error('Journal entries that point to missing SQL files:');
      for (const file of missingJournalFiles) console.error(`  - ${file}`);
      console.error('');
    }

    if (untrackedSql.length > 0) {
      console.error('SQL files present in migrations folder but not tracked in _journal.json:');
      for (const file of untrackedSql) console.error(`  - ${file}`);
      console.error('');
      console.error('Fix:');
      console.error('  1) If this is a real versioned migration, register it in src/db/migrations/meta/_journal.json');
      console.error('  2) If it is intentionally unmanaged legacy SQL, add it to meta/untracked-sql-allowlist.json');
      console.error('');
    }

    process.exit(1);
  }

  console.log('✅ Migration registry check passed');
}

main();

