/**
 * Shared migration loader/applier used by BOTH the runtime migrator
 * (run-migrations.ts) and the integration test harness (test-helpers/global-setup.ts),
 * so a fresh database is built exactly one way.
 *
 * Supports two kinds of migration files:
 *   - drizzle-generated migrations, delimited by `--> statement-breakpoint`
 *     (applied statement-by-statement), and
 *   - the squashed baseline (`0000_baseline.sql`), a raw `pg_dump` with no
 *     breakpoints (applied whole via the simple query protocol, which — like
 *     psql — accepts multiple statements in one round-trip).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Sql } from 'postgres';

export interface LoadedMigration {
  tag: string;
  when: number;
  hash: string;
  sqlContent: string;
  statements: string[];
  hasBreakpoints: boolean;
}

/** Read the drizzle journal + SQL files into ordered migration descriptors. */
export function loadMigrations(migrationsFolder: string): LoadedMigration[] {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ tag: string; when: number }>;
  };

  return journal.entries.map((entry) => {
    const sqlContent = fs.readFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), 'utf8');
    const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');
    const hasBreakpoints = sqlContent.includes('--> statement-breakpoint');
    const statements = sqlContent
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    return { tag: entry.tag, when: entry.when, hash, sqlContent, statements, hasBreakpoints };
  });
}

/**
 * Apply a single migration's SQL against an open postgres-js client.
 * Breakpoint-delimited files run statement-by-statement; a no-breakpoint baseline
 * runs as one simple-protocol batch.
 */
export async function applyMigration(client: Sql, migration: LoadedMigration): Promise<void> {
  if (migration.hasBreakpoints) {
    for (const statement of migration.statements) {
      await client.unsafe(statement);
    }
  } else {
    await client.unsafe(migration.sqlContent).simple();
  }
}

/**
 * Apply every migration in order against a FRESH database (no journal-skip logic).
 * Used by the integration test harness. Returns the tags applied.
 */
export async function applyAllMigrations(client: Sql, migrationsFolder: string): Promise<string[]> {
  const migrations = loadMigrations(migrationsFolder);
  for (const migration of migrations) {
    await applyMigration(client, migration);
  }
  return migrations.map((m) => m.tag);
}
