import 'dotenv/config';
import path from 'node:path';

import postgres from 'postgres';

import { loadMigrations, applyMigration } from './apply-migrations.js';

async function runMigrations(): Promise<void> {
  // Use privileged URL for migrations when set (e.g. Supabase postgres / migration user)
  const databaseUrl =
    process.env.MIGRATION_DATABASE_URL ?? process.env.DB_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL, MIGRATION_DATABASE_URL, or DB_MIGRATION_URL is required');
  }

  const client = postgres(databaseUrl, { max: 1 });
  const migrationsFolder = path.resolve(process.cwd(), 'src/db/migrations');

  try {
    console.log(`🗄️ Applying versioned migrations from: ${migrationsFolder}`);

    const migrations = loadMigrations(migrationsFolder);

    try {
      await client`
        CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `;
    } catch (error: unknown) {
      const pgError = error as { code?: string; message?: string };
      if (pgError.code === '42501') {
        throw new Error(
          'Insufficient DB privileges for migrations: cannot create public.__drizzle_migrations. ' +
            'Use a privileged migration DB user (set MIGRATION_DATABASE_URL in CI) or grant CREATE on schema public.'
        );
      }
      throw error;
    }

    const appliedRows = await client<{ created_at: string }[]>`
      SELECT created_at
      FROM public.__drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const lastApplied = appliedRows[0] ? Number(appliedRows[0].created_at) : 0;

    if (lastApplied === 0) {
      // Existing production DBs were previously managed via push:pg.
      // Baseline migration history to avoid replaying old SQL on live tables.
      const existingTenants = await client<{ exists: boolean }[]>`
        SELECT to_regclass('public.tenants') IS NOT NULL AS exists
      `;

      if (existingTenants[0]?.exists) {
        console.log('ℹ️ Existing schema detected; baselining migration journal without replay');
        for (const migration of migrations) {
          await client`
            INSERT INTO public.__drizzle_migrations (hash, created_at)
            SELECT ${migration.hash}, ${migration.when}
            WHERE NOT EXISTS (
              SELECT 1 FROM public.__drizzle_migrations WHERE hash = ${migration.hash}
            )
          `;
        }
        console.log('✅ Baseline migration journal recorded');
        return;
      }
    }

    for (const migration of migrations) {
      if (migration.when <= lastApplied) continue;

      console.log(`➡️ Applying migration: ${migration.tag}`);
      await applyMigration(client, migration);

      await client`
        INSERT INTO public.__drizzle_migrations (hash, created_at)
        VALUES (${migration.hash}, ${migration.when})
      `;
    }

    console.log('✅ Migrations applied successfully');
  } finally {
    await client.end();
  }
}

runMigrations().catch((error: unknown) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
