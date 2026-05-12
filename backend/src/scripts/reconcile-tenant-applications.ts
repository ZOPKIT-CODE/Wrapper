/**
 * reconcile-tenant-applications.ts
 *
 * For every tenant: reads their plan from subscriptions, then upserts
 * organization_applications rows from PLAN_ACCESS_MATRIX.
 *
 * Idempotent — safe to run multiple times. Uses ON CONFLICT DO UPDATE.
 *
 * Usage:
 *   pnpm --filter wrapper-backend run reconcile-tenant-apps         # live run
 *   pnpm --filter wrapper-backend run reconcile-tenant-apps --dry-run
 *   pnpm --filter wrapper-backend run reconcile-tenant-apps --tenant-id <uuid>
 */

import { db } from '../db/index.js';
import { tenants, subscriptions } from '../db/schema/index.js';
import { applications, organizationApplications, applicationModules } from '../db/schema/core/suite-schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { PLAN_ACCESS_MATRIX } from '../data/permission-matrix.js';

// In a standalone tsx script, app-fastify.ts never runs so global.logToES is not set.
// Provide a structured-JSON fallback that writes to stdout.
if (typeof global.logToES !== 'function') {
  global.logToES = (level: string, message: string, data: Record<string, unknown> = {}) => {
    process.stdout.write(JSON.stringify({ level, message, ...data, ts: new Date().toISOString() }) + '\n');
  };
}

const isDryRun = process.argv.includes('--dry-run');
const tenantIdFilter = (() => {
  const idx = process.argv.indexOf('--tenant-id');
  return idx !== -1 ? process.argv[idx + 1] : undefined;
})();

type PlanAccess = {
  applications?: string[];
  modules?: Record<string, unknown>;
};

function normalizeAppCode(code: string): string {
  const codeMap: Record<string, string> = {
    affiliateconnect: 'affiliateConnect',
    affiliate: 'affiliateConnect',
  };
  return codeMap[code.toLowerCase()] || code;
}

async function reconcileTenant(
  tenantId: string,
  planId: string,
  allActiveApps: { appId: string; appCode: string }[],
  allModulesByApp: Record<string, string[]>,
  dryRun: boolean,
): Promise<{
  tenantId: string;
  planId: string;
  before: number;
  after: number;
  added: number;
  kept: number;
}> {
  const planAccess = (PLAN_ACCESS_MATRIX as Record<string, PlanAccess>)[planId] ??
    (PLAN_ACCESS_MATRIX as Record<string, PlanAccess>)['free'];

  const expectedAppCodes = (planAccess.applications ?? []).map(normalizeAppCode);
  const modulesByApp = planAccess.modules ?? {};

  // Count before
  const [{ beforeCount }] = await db
    .select({ beforeCount: sql<number>`count(*)::int` })
    .from(organizationApplications)
    .where(eq(organizationApplications.tenantId, tenantId));

  const appCodeToId: Record<string, string> = {};
  for (const app of allActiveApps) appCodeToId[app.appCode] = app.appId;

  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + (planId === 'enterprise' ? 24 : 12));

  let added = 0;
  let kept = 0;

  for (const appCode of expectedAppCodes) {
    const appId = appCodeToId[appCode];
    if (!appId) {
      global.logToES('warn', '[reconcile] app_not_in_db', { tenantId, appCode, planId });
      continue;
    }

    const rawModules = modulesByApp[appCode];
    const enabledModules = rawModules === '*'
      ? (allModulesByApp[appId] ?? [])
      : (Array.isArray(rawModules) ? rawModules : []);

    if (dryRun) {
      kept++;
      continue;
    }

    const result = await db
      .insert(organizationApplications)
      .values({
        id: uuidv4(),
        tenantId,
        appId,
        subscriptionTier: planId,
        isEnabled: true,
        enabledModules,
        customPermissions: {},
        expiresAt: expiryDate,
      })
      .onConflictDoUpdate({
        target: [organizationApplications.tenantId, organizationApplications.appId],
        set: {
          subscriptionTier: planId,
          isEnabled: true,
          enabledModules,
          expiresAt: expiryDate,
        },
      })
      .returning({ id: organizationApplications.id });

    // Drizzle onConflictDoUpdate always returns 1 row; we can't easily tell
    // insert vs update here, so just count toward kept.
    if (result.length > 0) kept++;
  }

  const [{ afterCount }] = await db
    .select({ afterCount: sql<number>`count(*)::int` })
    .from(organizationApplications)
    .where(eq(organizationApplications.tenantId, tenantId));

  added = Math.max(0, Number(afterCount) - Number(beforeCount));
  kept = Math.max(0, expectedAppCodes.length - added);

  return {
    tenantId,
    planId,
    before: Number(beforeCount),
    after: Number(afterCount),
    added,
    kept,
  };
}

async function main() {
  global.logToES('info', '[reconcile] start', { dryRun: isDryRun, tenantIdFilter });

  // Load all active apps once
  const allActiveApps = await db
    .select({ appId: applications.appId, appCode: applications.appCode })
    .from(applications)
    .where(eq(applications.status, 'active'));

  // Pre-load module codes by appId
  const allModules = await db
    .select({ appId: applicationModules.appId, moduleCode: applicationModules.moduleCode })
    .from(applicationModules);
  const allModulesByApp: Record<string, string[]> = {};
  for (const m of allModules) {
    if (!m.appId) continue;
    if (!allModulesByApp[m.appId]) allModulesByApp[m.appId] = [];
    allModulesByApp[m.appId].push(m.moduleCode);
  }

  // Fetch tenants (optionally filtered)
  const allTenants = tenantIdFilter
    ? await db.select({ tenantId: tenants.tenantId }).from(tenants).where(eq(tenants.tenantId, tenantIdFilter))
    : await db.select({ tenantId: tenants.tenantId }).from(tenants);

  const errors: Array<{ tenantId: string; error: string }> = [];
  const stats = { total: 0, success: 0, skipped: 0 };

  for (const { tenantId } of allTenants) {
    stats.total++;
    try {
      // Resolve plan from subscriptions
      const [sub] = await db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')))
        .limit(1);
      const planId = sub?.plan ?? 'free';

      const delta = await reconcileTenant(tenantId, planId, allActiveApps, allModulesByApp, isDryRun);
      stats.success++;

      global.logToES('info', '[reconcile] tenant_delta', delta);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ tenantId, error: message });
      global.logToES('error', '[reconcile] tenant_failed', { tenantId, error: message });
    }
  }

  global.logToES('info', '[reconcile] done', {
    dryRun: isDryRun,
    ...stats,
    errors: errors.length,
  });

  if (errors.length > 0) {
    global.logToES('error', '[reconcile] completed_with_errors', { errors });
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  global.logToES('error', '[reconcile] fatal', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
