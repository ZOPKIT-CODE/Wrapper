#!/usr/bin/env node

/**
 * 🔄 **CREATE NOTIFICATION TEMPLATES TABLE MIGRATION SCRIPT**
 * Creates the notification_templates table
 *
 * This script creates the notification_templates table that stores reusable
 * notification templates for admin use.
 *
 * Usage:
 *   node src/db/migrations/scripts/create-notification-templates-table.js
 *   pnpm run db:migrate:create-notification-templates
 */

import postgres from 'postgres';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createNotificationTemplatesTable() {
  console.log('🚀 Starting Notification Templates Table Migration');
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
    console.log('🔍 Checking if notification_templates table exists...\n');

    const checkTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'notification_templates'
      ) as exists;
    `;

    if (checkTable[0]?.exists) {
      console.log('⚠️  Table notification_templates already exists');
      console.log('   Skipping migration (table already created)\n');

      // Verify indexes exist
      console.log('🔍 Verifying indexes...\n');
      const indexes = await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'notification_templates'
        AND schemaname = 'public';
      `;

      if (indexes.length > 0) {
        console.log(`✅ Found ${indexes.length} indexes on notification_templates table`);
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
    const migrationPath = join(__dirname, '..', 'create_notification_templates_table.sql');
    let migrationSQL;

    try {
      migrationSQL = readFileSync(migrationPath, 'utf8');
      console.log('📄 Read migration file:', migrationPath);
    } catch (fileError) {
      console.error('❌ Failed to read migration file:', fileError.message);
      console.log('📝 Using inline SQL instead...\n');
      migrationSQL = `
-- Create notification_templates table
CREATE TABLE IF NOT EXISTS "notification_templates" (
\t"template_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
\t"name" text NOT NULL,
\t"category" text DEFAULT 'custom' NOT NULL,
\t"description" text,
\t"type" text NOT NULL,
\t"priority" text DEFAULT 'medium' NOT NULL,
\t"title" text NOT NULL,
\t"message" text NOT NULL,
\t"action_url" text,
\t"action_label" text,
\t"variables" jsonb DEFAULT '{}',
\t"metadata" jsonb DEFAULT '{}',
\t"is_active" boolean DEFAULT true NOT NULL,
\t"is_system" boolean DEFAULT false NOT NULL,
\t"version" text DEFAULT '1.0.0',
\t"created_by" uuid REFERENCES "tenant_users"("user_id"),
\t"created_at" timestamp DEFAULT now() NOT NULL,
\t"updated_at" timestamp DEFAULT now() NOT NULL,
\t"last_used_at" timestamp
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_templates_category_active
ON notification_templates(category, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_templates_type_active
ON notification_templates(type, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active
ON notification_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_notification_templates_created_by
ON notification_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_notification_templates_created_at
ON notification_templates(created_at DESC);
      `.trim();
    }

    // Execute migration
    console.log('\n🔄 Executing migration...\n');

    // Split SQL into statements (handle both ; and statement-breakpoint)
    const statements = migrationSQL
      .split(/--> statement-breakpoint|;/)
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length === 0) continue;

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
        AND table_name = 'notification_templates'
      ) as exists;
    `;

    if (verifyTable[0]?.exists) {
      console.log('✅ Table notification_templates created successfully\n');
    } else {
      console.error('❌ Table was not created\n');
      throw new Error('Table creation verification failed');
    }

    // Verify indexes
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'notification_templates'
      AND schemaname = 'public';
    `;

    console.log(`✅ Found ${indexes.length} indexes on notification_templates table`);
    indexes.forEach((idx) => console.log(`   - ${idx.indexname}`));

    await sql.end();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Changes Applied:');
    console.log('   • Created notification_templates table');
    console.log('   • Created indexes for efficient querying');
    console.log('\n📝 Next Steps:');
    console.log('   • The notification templates feature should now work');
    console.log('   • You can create templates via the admin dashboard');
    console.log('');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    await sql.end();
    process.exit(1);
  }
}

// Run migration
createNotificationTemplatesTable().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

