import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/index.js';
import { tenants, subscriptions } from '../../../db/schema/index.js';
import { applications, organizationApplications, applicationModules } from '../../../db/schema/core/suite-schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { PLAN_ACCESS_MATRIX } from '../../../data/permission-matrix.js';
import { authenticateToken } from '../../../middleware/auth/auth.js';

function normalizeAppCode(code: string): string {
  const m: Record<string, string> = { affiliateconnect: 'affiliateConnect', affiliate: 'affiliateConnect' };
  return m[code.toLowerCase()] || code;
}

async function reconcileOneTenant(
  tenantId: string,
  planId: string,
  dryRun = false,
): Promise<{ tenantId: string; planId: string; before: number; after: number; added: number }> {
  type PlanAccess = { applications?: string[]; modules?: Record<string, unknown> };
  const planAccess = (PLAN_ACCESS_MATRIX as Record<string, PlanAccess>)[planId]
    ?? (PLAN_ACCESS_MATRIX as Record<string, PlanAccess>)['free'];

  const expectedCodes = (planAccess.applications ?? []).map(normalizeAppCode);
  const modulesByApp = planAccess.modules ?? {};

  const allActiveApps = await db
    .select({ appId: applications.appId, appCode: applications.appCode })
    .from(applications)
    .where(eq(applications.status, 'active'));

  const allModules = await db
    .select({ appId: applicationModules.appId, moduleCode: applicationModules.moduleCode })
    .from(applicationModules);
  const modsByApp: Record<string, string[]> = {};
  for (const m of allModules) {
    if (!m.appId) continue;
    if (!modsByApp[m.appId]) modsByApp[m.appId] = [];
    modsByApp[m.appId].push(m.moduleCode);
  }

  const appCodeToId: Record<string, string> = {};
  for (const a of allActiveApps) appCodeToId[a.appCode] = a.appId;

  const [{ beforeCount }] = await db
    .select({ beforeCount: sql<number>`count(*)::int` })
    .from(organizationApplications)
    .where(eq(organizationApplications.tenantId, tenantId));

  if (!dryRun) {
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (planId === 'enterprise' ? 24 : 12));

    for (const appCode of expectedCodes) {
      const appId = appCodeToId[appCode];
      if (!appId) continue;

      const rawMods = modulesByApp[appCode];
      const enabledModules = rawMods === '*' ? (modsByApp[appId] ?? []) : (Array.isArray(rawMods) ? rawMods : []);

      await db
        .insert(organizationApplications)
        .values({ id: uuidv4(), tenantId, appId, subscriptionTier: planId, isEnabled: true, enabledModules, customPermissions: {}, expiresAt: expiryDate })
        .onConflictDoUpdate({
          target: [organizationApplications.tenantId, organizationApplications.appId],
          set: { subscriptionTier: planId, isEnabled: true, enabledModules, expiresAt: expiryDate },
        });
    }
  }

  const [{ afterCount }] = await db
    .select({ afterCount: sql<number>`count(*)::int` })
    .from(organizationApplications)
    .where(eq(organizationApplications.tenantId, tenantId));

  return {
    tenantId,
    planId,
    before: Number(beforeCount),
    after: Number(afterCount),
    added: Math.max(0, Number(afterCount) - Number(beforeCount)),
  };
}

export default async function tenantApplicationsReconcileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/', {
    preHandler: [authenticateToken],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { tenantId?: string; dryRun?: boolean };
    const { tenantId, dryRun = false } = body ?? {};

    try {
      if (!tenantId) {
        return reply.code(400).send({ success: false, error: 'tenantId is required' });
      }

      const [tenantRow] = await db
        .select({ tenantId: tenants.tenantId })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenantRow) {
        return reply.code(404).send({ success: false, error: 'Tenant not found' });
      }

      const [sub] = await db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')))
        .limit(1);
      const planId = sub?.plan ?? 'free';

      const result = await reconcileOneTenant(tenantId, planId, dryRun);

      global.logToES('info', '[reconcile] admin_reconcile', { ...result, dryRun, requestedBy: (request as any).userContext?.userId });

      return reply.send({ success: true, data: result });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      global.logToES('error', '[reconcile] admin_reconcile_failed', { tenantId, error: error.message });
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}
