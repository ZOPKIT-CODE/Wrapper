/**
 * Vitest Global Setup — Integration Tests
 *
 * Lifecycle (runs in the MAIN process, before any worker is spawned):
 *   setup()    — pull/start a PostgreSQL container, run Drizzle migrations,
 *                write the connection URL to process.env.DATABASE_URL so every
 *                test worker inherits it automatically.
 *   teardown() — stop & remove the container after all tests finish.
 *
 * The container is shared across the entire integration-test run to keep
 * startup cost low (~10–30 s on first Docker pull, <5 s on subsequent runs
 * because the image is cached locally).
 *
 * Each test is responsible for creating its own isolated data (unique UUIDs)
 * so tests never interfere with each other.
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Resolve the migrations folder relative to this file
// (backend/src/db/test-helpers/ → backend/src/db/migrations/)
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../migrations');

// Keep a reference so teardown() can stop the container.
let container: StartedPostgreSqlContainer;

async function applyMigrationsAndSchemaPatches(connectionUrl: string): Promise<void> {
  // -------------------------------------------------------------------------
  // Run Drizzle migrations against the test database.
  // We create a dedicated, short-lived connection — NOT the singleton from
  // src/db/index.ts — to avoid any module-initialization side effects.
  // -------------------------------------------------------------------------
  console.log(`📦  [global-setup] Applying migrations from: ${MIGRATIONS_FOLDER}`);

  const migrationSql = postgres(connectionUrl, {
    max: 1,
    onnotice: () => {}, // silence noisy NOTICE messages during CREATE TABLE
  });

  const migrationDb = drizzle(migrationSql);

  try {
    // Provision DB roles that the migrations GRANT to / assume already exist.
    // In real environments `app_user` (the app's runtime role) and
    // `wrapper_migration_user` are created by infra/bootstrap; the ephemeral
    // testcontainer only has the container superuser, so migration 0023
    // (`GRANT … TO app_user`) fails without them. Create them idempotently here
    // before migrating. Test-only — mirrors the prod role model without
    // touching the canonical migration files.
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

    await migrate(migrationDb, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log('✅  [global-setup] Migrations applied successfully');
  } catch (err) {
    console.error('❌  [global-setup] Migration failed:', err);
    throw err; // abort — tests would all fail anyway
  } finally {
    await migrationSql.end();
  }

  // -------------------------------------------------------------------------
  // Schema-drift sync
  //
  // Some columns exist in the TypeScript Drizzle schema but were never added
  // to the canonical migration SQL files (the developer updated the TypeScript
  // types but forgot to generate a migration).  Application code that uses
  // `.select()` without arguments will try to SELECT all schema columns, which
  // fails if any column is absent from the DB.
  //
  // We patch the test DB here with ADD COLUMN IF NOT EXISTS so that:
  //   a) Application-under-test code can run unmodified.
  //   b) We don't have to modify the production migration files.
  //
  // This is intentionally a test-only shim.  The proper long-term fix is to
  // generate the missing migration using `pnpm db:generate` and commit it.
  // -------------------------------------------------------------------------
  const syncSql = postgres(connectionUrl, { max: 1, onnotice: () => {} });

  try {
    console.log('🔧  [global-setup] Applying schema-drift patches…');

    // entities — columns added to TypeScript schema but missing from 0000 migration
    await syncSql`
      ALTER TABLE entities
        ADD COLUMN IF NOT EXISTS contact_email  varchar(255),
        ADD COLUMN IF NOT EXISTS contact_phone  varchar(50)
    `;

    // tenants — columns added to TypeScript schema but never migrated
    await syncSql`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS tax_registered                  boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS vat_gst_registered              boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS organization_size               varchar(50),
        ADD COLUMN IF NOT EXISTS contact_job_title               varchar(150),
        ADD COLUMN IF NOT EXISTS preferred_contact_method        varchar(20),
        ADD COLUMN IF NOT EXISTS contact_salutation              varchar(20),
        ADD COLUMN IF NOT EXISTS contact_middle_name             varchar(100),
        ADD COLUMN IF NOT EXISTS contact_department              varchar(100),
        ADD COLUMN IF NOT EXISTS contact_direct_phone            varchar(50),
        ADD COLUMN IF NOT EXISTS contact_mobile_phone            varchar(50),
        ADD COLUMN IF NOT EXISTS contact_preferred_contact_method varchar(20),
        ADD COLUMN IF NOT EXISTS contact_authority_level         varchar(50),
        ADD COLUMN IF NOT EXISTS tax_registration_details        jsonb,
        ADD COLUMN IF NOT EXISTS billing_email                   varchar(255),
        ADD COLUMN IF NOT EXISTS mailing_address_same_as_registered boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS billing_street                  varchar(255),
        ADD COLUMN IF NOT EXISTS billing_city                    varchar(100),
        ADD COLUMN IF NOT EXISTS billing_state                   varchar(100),
        ADD COLUMN IF NOT EXISTS billing_zip                     varchar(20),
        ADD COLUMN IF NOT EXISTS billing_country                 varchar(100),
        ADD COLUMN IF NOT EXISTS phone                           varchar(50),
        ADD COLUMN IF NOT EXISTS default_language                varchar(10),
        ADD COLUMN IF NOT EXISTS default_locale                  varchar(20),
        ADD COLUMN IF NOT EXISTS default_currency                varchar(3),
        ADD COLUMN IF NOT EXISTS default_timezone                varchar(50),
        ADD COLUMN IF NOT EXISTS fiscal_year_start_month         integer,
        ADD COLUMN IF NOT EXISTS fiscal_year_end_month           integer,
        ADD COLUMN IF NOT EXISTS fiscal_year_start_day           integer,
        ADD COLUMN IF NOT EXISTS fiscal_year_end_day             integer,
        ADD COLUMN IF NOT EXISTS bank_name                       varchar(255),
        ADD COLUMN IF NOT EXISTS bank_branch                     varchar(255),
        ADD COLUMN IF NOT EXISTS account_holder_name             varchar(255),
        ADD COLUMN IF NOT EXISTS account_number                  varchar(50),
        ADD COLUMN IF NOT EXISTS account_type                    varchar(20),
        ADD COLUMN IF NOT EXISTS bank_account_currency           varchar(3),
        ADD COLUMN IF NOT EXISTS swift_bic_code                  varchar(20),
        ADD COLUMN IF NOT EXISTS iban                            varchar(50),
        ADD COLUMN IF NOT EXISTS routing_number_us               varchar(20),
        ADD COLUMN IF NOT EXISTS sort_code_uk                    varchar(20),
        ADD COLUMN IF NOT EXISTS ifsc_code_india                 varchar(20),
        ADD COLUMN IF NOT EXISTS bsb_number_australia            varchar(20),
        ADD COLUMN IF NOT EXISTS payment_terms                   varchar(50),
        ADD COLUMN IF NOT EXISTS credit_limit                    numeric(15,2),
        ADD COLUMN IF NOT EXISTS preferred_payment_method        varchar(50),
        ADD COLUMN IF NOT EXISTS tax_residence_country           varchar(100),
        ADD COLUMN IF NOT EXISTS tax_exempt_status               varchar(50),
        ADD COLUMN IF NOT EXISTS tax_exemption_certificate_number varchar(100),
        ADD COLUMN IF NOT EXISTS tax_exemption_expiry_date       date,
        ADD COLUMN IF NOT EXISTS withholding_tax_applicable      boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS withholding_tax_rate            numeric(5,2),
        ADD COLUMN IF NOT EXISTS tax_treaty_country              varchar(100),
        ADD COLUMN IF NOT EXISTS w9_status_us                    varchar(50),
        ADD COLUMN IF NOT EXISTS w8_form_type_us                 varchar(50),
        ADD COLUMN IF NOT EXISTS reverse_charge_mechanism        boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS vat_gst_rate_applicable         numeric(5,2),
        ADD COLUMN IF NOT EXISTS regulatory_compliance_status    varchar(50),
        ADD COLUMN IF NOT EXISTS industry_specific_licenses      jsonb,
        ADD COLUMN IF NOT EXISTS data_protection_registration    varchar(100),
        ADD COLUMN IF NOT EXISTS professional_indemnity_insurance boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS insurance_policy_number         varchar(100),
        ADD COLUMN IF NOT EXISTS insurance_expiry_date           date
    `;

    // audit_logs — user_id is typed UUID in the migration, but the application
    // uses the literal string 'system' as a placeholder for background operations
    // (e.g. createRole's internal logAuditEvent call).  Drop the FK first, then
    // widen the column to varchar so both UUIDs and 'system' are accepted.
    await syncSql`
      ALTER TABLE audit_logs
        DROP CONSTRAINT IF EXISTS audit_logs_user_id_tenant_users_user_id_fk
    `;
    await syncSql`
      ALTER TABLE audit_logs
        ALTER COLUMN user_id TYPE varchar(255) USING COALESCE(user_id::text, NULL)
    `;

    // payments — refund tracking, tax, metadata, and audit columns added after initial migration.
    await syncSql`
      ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS amount_refunded  numeric(10, 2)  DEFAULT 0,
        ADD COLUMN IF NOT EXISTS refund_reason    varchar(100),
        ADD COLUMN IF NOT EXISTS is_partial_refund boolean        DEFAULT false,
        ADD COLUMN IF NOT EXISTS refunded_at      timestamp,
        ADD COLUMN IF NOT EXISTS tax_amount       numeric(10, 2)  DEFAULT 0,
        ADD COLUMN IF NOT EXISTS metadata         jsonb           DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS stripe_raw_data  jsonb           DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS updated_at       timestamp       DEFAULT now()
    `;

    // seasonal_credit_allocations — used by credit-balance/transfer flows.
    // Some migration paths in tests may not include this table yet.
    await syncSql`
      CREATE TABLE IF NOT EXISTS seasonal_credit_allocations (
        allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid,
        tenant_id uuid NOT NULL,
        entity_id uuid NOT NULL,
        entity_type varchar(50) DEFAULT 'organization',
        target_application varchar(50),
        allocated_credits numeric(15, 4) NOT NULL DEFAULT '0',
        used_credits numeric(15, 4) NOT NULL DEFAULT '0',
        distribution_status varchar(50) DEFAULT 'pending',
        distribution_error text,
        is_active boolean DEFAULT true,
        is_expired boolean DEFAULT false,
        allocated_at timestamp DEFAULT now(),
        expires_at timestamp NOT NULL DEFAULT now() + interval '30 days',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `;

    console.log('✅  [global-setup] Schema-drift patches applied');
  } catch (err) {
    console.error('❌  [global-setup] Schema-drift patch failed:', err);
    throw err;
  } finally {
    await syncSql.end();
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

    await applyMigrationsAndSchemaPatches(externalUrl as string);
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
  await applyMigrationsAndSchemaPatches(connectionUrl);
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
