#!/usr/bin/env node
/**
 * Applies only the "add FA entity fields" migration (legal_name, country, etc.) to entities.
 * Uses ALTER TABLE only — no CREATE TABLE.
 *
 * Requires: DB user must be OWNER of public.entities (or a superuser). The app DATABASE_URL
 * often is not the table owner (e.g. Supabase anon/key role), so you must use a privileged URL.
 *
 * Usage:
 *   MIGRATION_DATABASE_URL="postgresql://postgres:...@.../postgres" pnpm run db:migrate:fa-entity-fields
 * (Use the same URL you would use for full db:migrate — e.g. Supabase "postgres" or service_role.)
 *
 * Alternative: run the SQL by hand. Copy the contents of src/db/migrations/fa_entity_fields_standalone.sql
 * into Supabase Dashboard → SQL Editor and run as the project owner.
 */

import 'dotenv/config';
import postgres from 'postgres';

const statements = [
  `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'legal_name') THEN
    ALTER TABLE public.entities ADD COLUMN legal_name varchar(255);
  END IF;
END $$;`,
  `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'country') THEN
    ALTER TABLE public.entities ADD COLUMN country varchar(3);
  END IF;
END $$;`,
  `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'fiscal_year_end') THEN
    ALTER TABLE public.entities ADD COLUMN fiscal_year_end varchar(10) DEFAULT '12-31';
  END IF;
END $$;`,
  `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'tax_id') THEN
    ALTER TABLE public.entities ADD COLUMN tax_id varchar(50);
  END IF;
END $$;`,
  `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'registration_number') THEN
    ALTER TABLE public.entities ADD COLUMN registration_number varchar(100);
  END IF;
END $$;`,
  `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'contact_website') THEN
    ALTER TABLE public.entities ADD COLUMN contact_website varchar(500);
  END IF;
END $$;`,
];

async function main() {
  const databaseUrl =
    process.env.MIGRATION_DATABASE_URL ?? process.env.DB_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Set DATABASE_URL, MIGRATION_DATABASE_URL, or DB_MIGRATION_URL');
    process.exit(1);
  }

  const source = process.env.MIGRATION_DATABASE_URL
    ? 'MIGRATION_DATABASE_URL'
    : process.env.DB_MIGRATION_URL
      ? 'DB_MIGRATION_URL'
      : 'DATABASE_URL';
  const host = databaseUrl.match(/@([^/]+)\//)?.[1] ?? '***';
  console.log('Using', source, '(@' + host + ')');

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('Applying FA entity fields (legal_name, country, etc.) to public.entities...');
    for (let i = 0; i < statements.length; i++) {
      await sql.unsafe(statements[i]);
      console.log('  OK:', i + 1, '/', statements.length);
    }
    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    if (err.message && err.message.includes('must be owner')) {
      console.error('');
      console.error('The DB user in', source, 'is not the owner of public.entities.');
      console.error('In Supabase, tables are owned by the "postgres" role. Use the postgres connection string from');
      console.error('Project Settings → Database → Connection string (URI), or run the SQL in SQL Editor.');
      console.error('Standalone SQL: backend/src/db/migrations/fa_entity_fields_standalone.sql');
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

