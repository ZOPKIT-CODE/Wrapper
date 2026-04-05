#!/usr/bin/env node

/**
 * 🔄 **CREATE EXTERNAL APPLICATIONS TABLE MIGRATION SCRIPT**
 * Creates the external_applications table
 *
 * This script creates the external_applications table that stores registered
 * external applications that can send notifications.
 *
 * Usage:
 *   node src/db/migrations/scripts/create-external-applications-table.js
 *   pnpm run db:migrate:create-external-applications
 */

import postgres from 'postgres';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createExternalApplicationsTable() {
  console.log('🚀 Starting External Applications Table Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, {
    prepare: false,
    connection: {
      search_path: 'public',
    },
  });

  try {
    // Check if table already exists
    console.log('🔍 Checking if external_applications table exists...\n');

    const checkTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'external_applications'
      ) as exists;
    `;

    if (checkTable[0]?.exists) {
      console.log('⚠️  Table external_applications already exists');
      console.log('   Skipping migration (table already created)\n');

      // Verify indexes exist
      console.log('🔍 Verifying indexes...\n');
      const indexes = await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'external_applications'
        AND schemaname = 'public';
      `;

      if (indexes.length > 0) {
        console.log(`✅ Found ${indexes.length} indexes on external_applications table`);
        indexes.forEach((idx) => console.log(`   - ${idx.indexname}`));
      } else {
        console.log('⚠️  No indexes found, but table exists');
      }

      await sql.end();
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Migration check completed');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      process.exit(0);
    }

    console.log('✅ Table does not exist, proceeding with migration...\n');

    // Read migration file
    const migrationPath = join(__dirname, '..', 'create_external_applications_table.sql');
    let migrationSQL;

    try {
      migrationSQL = readFileSync(migrationPath, 'utf8');
      console.log('📄 Read migration file:', migrationPath);
    } catch (fileError) {
      console.error('❌ Failed to read migration file:', fileError.message);
      console.log('📝 Using inline SQL instead...\n');
      migrationSQL = `
-- Create external_applications table
CREATE TABLE IF NOT EXISTS "external_applications" (
\t"app_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
\t"app_name" text NOT NULL,
\t"app_description" text,
\t"api_key" text NOT NULL UNIQUE,
\t"api_secret" text,
\t"webhook_url" text,
\t"webhook_secret" text,
\t"rate_limit" integer DEFAULT 100 NOT NULL,
\t"allowed_tenants" jsonb,
\t"permissions" jsonb DEFAULT '[]' NOT NULL,
\t"is_active" boolean DEFAULT true NOT NULL,
\t"created_by" uuid REFERENCES "tenant_users"("user_id"),
\t"created_at" timestamp DEFAULT now() NOT NULL,
\t"updated_at" timestamp DEFAULT now() NOT NULL,
\t"last_used_at" timestamp,
\t"request_count" integer DEFAULT 0 NOT NULL,
\t"last_request_at" timestamp,
\t"metadata" jsonb DEFAULT '{}'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_external_applications_api_key
ON external_applications(api_key);

CREATE INDEX IF NOT EXISTS idx_external_applications_is_active
ON external_applications(is_active);

CREATE INDEX IF NOT EXISTS idx_external_applications_created_by
ON external_applications(created_by);

CREATE INDEX IF NOT EXISTS idx_external_applications_last_used_at
ON external_applications(last_used_at DESC);
      `.trim();
    }

    // Execute migration
    console.log('\n🔄 Executing migration...\n');

    // Better SQL splitting: split by semicolon, but preserve multi-line statements
    // Remove comments first
    const cleanSQL = migrationSQL
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // Split by semicolon, but keep statements that span multiple lines
    const statements = cleanSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (let i = 0; i < statements.length; i++) {
      let statement = statements[i];
      if (statement.length === 0) continue;

      // Add semicolon back if not present (for execution)
      if (!statement.endsWith(';')) {
        statement += ';';
      }

      try {
        const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`   [${i + 1}/${statements.length}] Executing: ${preview}...`);
        await sql.unsafe(statement);
        console.log(`   ✅ Statement ${i + 1} executed successfully\n`);
      } catch (stmtError) {
        // If table/index already exists, that's okay (IF NOT EXISTS handles it)
        if (
          stmtError.message?.includes('already exists') ||
          stmtError.code === '42P07' || // duplicate table
          stmtError.code === '42710' // duplicate object
        ) {
          console.log(
            `   ⚠️  Object already exists (non-critical): ${stmtError.message.split('\n')[0]}\n`
          );
        } else {
          console.error(`   ❌ Failed to execute statement ${i + 1}:`, stmtError.message);
          throw stmtError;
        }
      }
    }

    // Verify table was created
    console.log('🔍 Verifying migration...\n');

    const verifyTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'external_applications'
      ) as exists;
    `;

    if (verifyTable[0]?.exists) {
      console.log('✅ Table external_applications created successfully\n');
    } else {
      console.error('❌ Table was not created\n');
      throw new Error('Table creation verification failed');
    }

    // Verify indexes
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'external_applications'
      AND schemaname = 'public';
    `;

    console.log(`✅ Found ${indexes.length} indexes on external_applications table`);
    indexes.forEach((idx) => console.log(`   - ${idx.indexname}`));

    await sql.end();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Changes Applied:');
    console.log('   • Created external_applications table');
    console.log('   • Created indexes for efficient querying');
    console.log('\n📝 Next Steps:');
    console.log('   • The external applications feature should now work');
    console.log('   • You can register external applications via the admin dashboard');
    console.log('');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    await sql.end();
    process.exit(1);
  }
}

// Run migration
createExternalApplicationsTable().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

