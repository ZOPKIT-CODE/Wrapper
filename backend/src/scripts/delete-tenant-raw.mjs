#!/usr/bin/env node
/**
 * Delete all data for a tenant by ID using raw SQL (uses DATABASE_URL from .env).
 * Use when the tenant row may already be missing (cleans leftover child data).
 *
 * Usage: node src/scripts/delete-tenant-raw.mjs <tenantId>
 * Example: node src/scripts/delete-tenant-raw.mjs 4df36773-07a4-4dc9-ab62-5f71b7c87bcf
 */
import postgres from 'postgres';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from backend root (src/scripts -> src -> backend)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const tenantId = process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in backend/.env');
  process.exit(1);
}
if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
  console.error('❌ Usage: node src/scripts/delete-tenant-raw.mjs <tenantId>');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

const run = (query) => sql.unsafe(query);

async function main() {
  console.log(`\n🗑️  Deleting all data for tenant: ${tenantId}\n`);

  try {
    await sql.begin(async (tx) => {
      const t = (q) => tx.unsafe(q);

      // Tables that may not exist in all environments - run and ignore errors, or skip
      const steps = [
        () => t(`DELETE FROM responsibility_history WHERE assignment_id IN (SELECT assignment_id FROM responsible_persons WHERE tenant_id = '${tenantId}')`),
        () => t(`DELETE FROM credit_transactions WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM user_role_assignments WHERE user_id IN (SELECT user_id FROM tenant_users WHERE tenant_id = '${tenantId}')`),
        () => t(`DELETE FROM user_application_permissions WHERE user_id IN (SELECT user_id FROM tenant_users WHERE tenant_id = '${tenantId}')`),
        () => t(`DELETE FROM credit_usage WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM user_sessions WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM credits WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM credit_purchases WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM organization_memberships WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM responsible_persons WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM audit_logs WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM notifications WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM event_tracking WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM organization_applications WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM tenant_invitations WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM credit_configurations WHERE tenant_id = '${tenantId}'`),
        () => t(`UPDATE tenant_users SET primary_organization_id = NULL WHERE tenant_id = '${tenantId}'`),
        // Entities: delete leaves first (hierarchy)
        () => t(`DELETE FROM entities WHERE tenant_id = '${tenantId}' AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id)`),
        () => t(`DELETE FROM entities WHERE tenant_id = '${tenantId}' AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id)`),
        () => t(`DELETE FROM entities WHERE tenant_id = '${tenantId}' AND NOT EXISTS (SELECT 1 FROM entities e2 WHERE e2.parent_entity_id = entities.entity_id)`),
        () => t(`DELETE FROM entities WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM custom_roles WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM tenant_users WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM payments WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM subscriptions WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM seasonal_credit_allocations WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM onboarding_events WHERE tenant_id = '${tenantId}'`),
        () => t(`DELETE FROM tenants WHERE tenant_id = '${tenantId}'`),
      ];

      for (let i = 0; i < steps.length; i++) {
        try {
          await steps[i]();
          console.log(`   ✅ step ${i + 1}/${steps.length}`);
        } catch (err) {
          if (err.message && (err.message.includes('does not exist') || err.message.includes('relation'))) {
            console.log(`   ⏭️  step ${i + 1} (table missing, skipped)`);
          } else {
            throw err;
          }
        }
      }
    });

    console.log('\n🎉 Tenant data deleted successfully.\n');
  } catch (err) {
    console.error('\n🚨 Error:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
