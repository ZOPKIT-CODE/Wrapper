#!/usr/bin/env node

/**
 * Delete all data except applications and application_modules.
 * Uses DATABASE_URL from .env (works with Supabase; no psql needed).
 *
 * Usage (from backend folder):
 *   node src/scripts/run-delete-except-apps-modules.js
 *
 * Or with explicit env:
 *   DATABASE_URL="postgresql://..." node src/scripts/run-delete-except-apps-modules.js
 */

import postgres from 'postgres';
import 'dotenv/config';

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required. Set it in .env or pass it when running.');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, {
    prepare: false,
    connection: { search_path: 'public' },
  });

  console.log('🗑️  Deleting all data except applications and application_modules...\n');

  try {
    await sql.begin(async (tx) => {
      await tx.unsafe('TRUNCATE TABLE tenants RESTART IDENTITY CASCADE');
      await tx.unsafe('TRUNCATE TABLE webhook_logs RESTART IDENTITY CASCADE');
      await tx.unsafe('TRUNCATE TABLE event_tracking RESTART IDENTITY CASCADE');
    });
    console.log('✅ Done. Only applications and application_modules data remain.\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
