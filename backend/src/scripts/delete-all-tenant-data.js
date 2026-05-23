#!/usr/bin/env node
/**
 * Deletes all tenant data by dynamically discovering every public table with a
 * `tenant_id` column and deleting rows for all tenants. Repeats passes so FK
 * dependencies resolve themselves, then deletes the `tenants` table.
 *
 * Run from backend: npm run delete-all-tenants
 */
import 'dotenv/config';
import postgres from 'postgres';

const MAX_PASSES = 20;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const tables = (
      await sql`
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'tenant_id'
          AND table_name <> 'tenants'
        ORDER BY table_name
      `
    ).map((r) => r.table_name);

    console.log(`Deleting tenant data from ${tables.length} tables...`);

    const remaining = new Set(tables);
    for (let pass = 1; pass <= MAX_PASSES && remaining.size > 0; pass++) {
      let progress = false;
      for (const t of [...remaining]) {
        const ident = `"${t}"`;
        const baseStmt = `DELETE FROM ${ident} WHERE tenant_id IN (SELECT tenant_id FROM tenants)`;
        try {
          const r = await sql.unsafe(baseStmt);
          if (r.count > 0) console.log(`  pass ${pass}: ${t} -> ${r.count}`);
          remaining.delete(t);
          progress = true;
        } catch (e) {
          if (e.code === '23503') continue; // FK violation - retry next pass
          if (e.code === '42883') {
            // type mismatch (e.g. text vs uuid) - retry with cast
            try {
              const castStmt = `DELETE FROM ${ident} WHERE tenant_id::text IN (SELECT tenant_id::text FROM tenants)`;
              const r = await sql.unsafe(castStmt);
              if (r.count > 0) console.log(`  pass ${pass}: ${t} -> ${r.count} (cast)`);
              remaining.delete(t);
              progress = true;
            } catch (e2) {
              if (e2.code === '23503') continue;
              console.error(`  ${t}: ${e2.message}`);
              remaining.delete(t);
            }
            continue;
          }
          console.error(`  ${t}: ${e.message}`);
          remaining.delete(t);
        }
      }
      if (!progress) {
        console.error('No progress this pass; remaining:', [...remaining]);
        process.exit(1);
      }
    }

    const r = await sql.unsafe('DELETE FROM tenants');
    console.log(`tenants -> ${r.count}`);
    console.log('All tenant data deleted.');
  } catch (err) {
    console.error('FATAL:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
