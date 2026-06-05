/**
 * Vitest Global Setup — Integration Tests
 *
 * Lifecycle (runs in the MAIN process, before any worker is spawned):
 *   setup()    — pull/start a PostgreSQL container, apply the migrations (the
 *                squashed baseline + any later migrations) via the SAME applier
 *                the runtime uses, write the connection URL to
 *                process.env.DATABASE_URL so every test worker inherits it.
 *   teardown() — stop & remove the container after all tests finish.
 *
 * The container is shared across the entire integration-test run to keep
 * startup cost low (~10–30 s on first Docker pull, <5 s on subsequent runs
 * because the image is cached locally).
 *
 * NOTE: there is deliberately NO schema-drift shim here anymore. The baseline
 * (0000_baseline.sql) is a faithful pg_dump of production, so a fresh test DB
 * already matches prod. If a test ever needs a column the migrations don't
 * create, that is REAL drift — fix it with a migration (and the schema-drift CI
 * gate will catch it), do not patch it here.
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

import { applyAllMigrations } from '../apply-migrations.js';

// ---------------------------------------------------------------------------
// Resolve the migrations folder relative to this file
// (backend/src/db/test-helpers/ → backend/src/db/migrations/)
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../migrations');

// Keep a reference so teardown() can stop the container.
let container: StartedPostgreSqlContainer;

async function applyMigrations(connectionUrl: string): Promise<void> {
  console.log(`📦  [global-setup] Applying migrations from: ${MIGRATIONS_FOLDER}`);

  // Dedicated, short-lived connection — NOT the singleton from src/db/index.ts —
  // to avoid any module-initialization side effects.
  const migrationSql = postgres(connectionUrl, {
    max: 1,
    onnotice: () => {}, // silence noisy NOTICE messages during CREATE TABLE
  });

  try {
    // Provision the DB roles that 0001_grant_app_user GRANTs to. In real
    // environments `app_user` (the app's runtime role) and `wrapper_migration_user`
    // are created by infra/bootstrap; the ephemeral testcontainer only has the
    // container superuser, so create them idempotently before migrating.
    await migrationSql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          CREATE ROLE app_user;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wrapper_migration_user') THEN
          CREATE ROLE wrapper_migration_user;
        END IF;
      END $$;
    `);

    const applied = await applyAllMigrations(migrationSql, MIGRATIONS_FOLDER);
    console.log(`✅  [global-setup] Migrations applied (${applied.length}: ${applied.join(', ')})`);
  } catch (err) {
    console.error('❌  [global-setup] Migration failed:', err);
    throw err; // abort — tests would all fail anyway
  } finally {
    await migrationSql.end();
  }
}

// ---------------------------------------------------------------------------
// setup() — called once before ANY test worker starts
// ---------------------------------------------------------------------------
export async function setup(): Promise<void> {
  const useExistingDb =
    process.env.SKIP_TESTCONTAINERS === 'true' &&
    typeof (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL) === 'string' &&
    (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '').length > 0;

  if (useExistingDb) {
    console.log('\n🧪  [global-setup] SKIP_TESTCONTAINERS=true — using existing DATABASE_URL');
    console.log('ℹ️   Ensure DATABASE_URL points to a dedicated test database.');
    const externalUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    process.env.DATABASE_URL = externalUrl;
    process.env.TEST_DATABASE_URL = externalUrl;

    await applyMigrations(externalUrl as string);
    return;
  }

  console.log('\n🐳  [global-setup] Starting PostgreSQL container…');

  // Use a lightweight Alpine-based image for speed.
  // The database/user/password are arbitrary — we own the whole container.
  container = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('wrapper_test')
    .withUsername('tester')
    .withPassword('tester_pass')
    // Increase shared_buffers for faster bulk-inserts during migration.
    .withCommand(['postgres', '-c', 'shared_buffers=128MB'])
    .start();

  const connectionUrl = container.getConnectionUri();
  console.log(`✅  [global-setup] Container ready at: ${connectionUrl}`);

  // -------------------------------------------------------------------------
  // Make the URL available to every test worker.
  // Vitest worker processes are forked AFTER globalSetup completes, so they
  // inherit the env vars set here.
  // -------------------------------------------------------------------------
  process.env.DATABASE_URL = connectionUrl;
  process.env.TEST_DATABASE_URL = connectionUrl; // convenience alias
  await applyMigrations(connectionUrl);
}

// ---------------------------------------------------------------------------
// teardown() — called once after ALL test workers have finished
// ---------------------------------------------------------------------------
export async function teardown(): Promise<void> {
  if (process.env.SKIP_TESTCONTAINERS === 'true') {
    console.log('\nℹ️   [global-setup] SKIP_TESTCONTAINERS=true — no container teardown needed');
    return;
  }

  if (container) {
    console.log('\n🛑  [global-setup] Stopping PostgreSQL container…');
    await container.stop({ timeout: 10_000 });
    console.log('✅  [global-setup] Container stopped');
  }
}
