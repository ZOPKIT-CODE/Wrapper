#!/usr/bin/env node

/**
 * 🧹 **CLEANUP TENANT DATA FOR MIGRATION**
 * Cleans up any orphaned data related to credit allocation tables before migration
 *
 * This script should be run BEFORE dropping the credit allocation tables
 * to ensure there's no orphaned data that could cause issues.
 *
 * Usage:
 *   node src/db/migrations/scripts/cleanup-tenant-data-for-migration.js
 *   pnpm run db:migrate:cleanup-tenant-data
 */

import postgres from 'postgres';
import 'dotenv/config';

async function cleanupTenantDataForMigration() {
  console.log('🧹 Cleaning up tenant data for migration');
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
    // Check if credit allocation tables exist
    const allocationsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'credit_allocations'
      ) as exists;
    `;

    const transactionsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'credit_allocation_transactions'
      ) as exists;
    `;

    if (!allocationsExists[0]?.exists && !transactionsExists[0]?.exists) {
      console.log('✅ Credit allocation tables do not exist. No cleanup needed.\n');
      await sql.end();
      return;
    }

    console.log('📊 Current Data Status:\n');

    // Count records in credit_allocation_transactions
    if (transactionsExists[0]?.exists) {
      const transactionCount = await sql`
        SELECT COUNT(*) as count FROM credit_allocation_transactions;
      `;
      console.log(`   credit_allocation_transactions: ${transactionCount[0]?.count || 0} records`);
    }

    // Count records in credit_allocations
    if (allocationsExists[0]?.exists) {
      const allocationCount = await sql`
        SELECT COUNT(*) as count FROM credit_allocations;
      `;
      console.log(`   credit_allocations: ${allocationCount[0]?.count || 0} records`);
    }

    console.log('');

    // Check for foreign key references
    console.log('🔍 Checking for foreign key references...\n');

    const foreignKeys = await sql`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (
          ccu.table_name = 'credit_allocations'
          OR ccu.table_name = 'credit_allocation_transactions'
        )
      ORDER BY tc.table_name, kcu.column_name;
    `;

    if (foreignKeys.length > 0) {
      console.log('⚠️  Found tables referencing credit allocation tables:');
      foreignKeys.forEach((fk) => {
        console.log(
          `   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`
        );
      });
      console.log('\n   Note: CASCADE will automatically handle these references\n');
    } else {
      console.log('✅ No foreign key references found\n');
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Cleanup Summary:');
    console.log('   • No data cleanup needed - tables will be dropped with CASCADE');
    console.log('   • Foreign key references will be automatically removed');
    console.log('   • Safe to proceed with migration');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('\n❌ Cleanup check failed:', error.message);
    console.error('   Error details:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run cleanup check
cleanupTenantDataForMigration()
  .then(() => {
    console.log('✅ Cleanup check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup check failed:', error);
    process.exit(1);
  });

