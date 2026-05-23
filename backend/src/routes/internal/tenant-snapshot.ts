/**
 * Internal Tenant Snapshot Routes
 *
 * Pull endpoints so downstream apps (CRM, FA, etc.) can authoritatively
 * rehydrate state when they miss an SNS event or want to detect drift.
 *
 * Routes:
 *   GET /api/internal/tenants/:tenantId/snapshot?appCode=&correlationId=
 *       → returns the exact same shape as the `eventData` field of a
 *         `tenant.onboarded` event. If appCode is given, scopes to that app;
 *         otherwise returns a map keyed by appCode.
 *
 *   GET /api/internal/tenants/:tenantId/entitlements?appCode=
 *       → returns the current entitlement state from organization_applications
 *         for a single app.
 *
 * Auth: validateInternalApiKey — same internal auth used by all other
 * /api/internal/* routes in this codebase.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateInternalApiKey } from '../../middleware/auth/internal.js';
import ErrorResponses from '../../utils/error-responses.js';
import { db } from '../../db/index.js';
import { applications, organizationApplications } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import {
  buildAllTenantSnapshots,
  buildTenantSnapshot,
  getEnabledAppsForTenant,
  resolveTenantPlan,
  tenantExists,
} from '../../features/tenants/services/tenant-snapshot-service.js';

function resolveCorrelationId(request: FastifyRequest): string {
  const q = (request.query as Record<string, unknown> | undefined)?.correlationId;
  const h = request.headers['x-correlation-id'];
  if (typeof q === 'string' && q.length > 0) return q;
  if (typeof h === 'string' && h.length > 0) return h;
  if (Array.isArray(h) && h[0]) return h[0];
  return (request.id as string) ?? 'unknown';
}

export default async function internalTenantSnapshotRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /tenants/:tenantId/snapshot ─────────────────────────────────────
  fastify.get('/tenants/:tenantId/snapshot', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };
    const { appCode } = (request.query as { appCode?: string }) ?? {};
    const correlationId = resolveCorrelationId(request);

    request.log.info({
      type:  'internal_tenant_snapshot_pull',
      tenantId,
      appCode: appCode ?? null,
      correlationId,
    }, 'tenant snapshot rehydrate request');

    try {
      if (!await tenantExists(tenantId)) {
        return ErrorResponses.notFound(reply, 'Tenant', `Tenant ${tenantId} not found`);
      }

      const plan = await resolveTenantPlan(tenantId);

      if (appCode) {
        const snapshot = await buildTenantSnapshot(tenantId, appCode, plan);
        if (!snapshot) {
          return ErrorResponses.notFound(
            reply,
            'TenantApplication',
            `Tenant ${tenantId} has no active enabled app '${appCode}'`,
          );
        }
        return { success: true, correlationId, data: snapshot };
      }

      const snapshots = await buildAllTenantSnapshots(tenantId, plan);
      return { success: true, correlationId, data: snapshots };
    } catch (err: unknown) {
      fastify.log.error({ err, tenantId, correlationId }, 'tenant snapshot rehydrate failed');
      return reply.code(500).send({
        error: 'Failed to build tenant snapshot',
        correlationId,
      });
    }
  });

  // ── GET /tenants/:tenantId/entitlements ─────────────────────────────────
  fastify.get('/tenants/:tenantId/entitlements', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };
    const { appCode } = (request.query as { appCode?: string }) ?? {};
    const correlationId = resolveCorrelationId(request);

    request.log.info({
      type: 'internal_tenant_entitlement_pull',
      tenantId,
      appCode: appCode ?? null,
      correlationId,
    }, 'tenant entitlement pull request');

    if (!appCode) {
      return reply.code(400).send({
        error: 'appCode query parameter is required',
        correlationId,
      });
    }

    try {
      if (!await tenantExists(tenantId)) {
        return ErrorResponses.notFound(reply, 'Tenant', `Tenant ${tenantId} not found`);
      }

      const [row] = await db
        .select({
          appCode:          applications.appCode,
          subscriptionTier: organizationApplications.subscriptionTier,
          enabledModules:   organizationApplications.enabledModules,
          expiresAt:        organizationApplications.expiresAt,
          isEnabled:        organizationApplications.isEnabled,
          appStatus:        applications.status,
        })
        .from(organizationApplications)
        .innerJoin(applications, eq(applications.appId, organizationApplications.appId))
        .where(and(
          eq(organizationApplications.tenantId, tenantId),
          eq(applications.appCode, appCode),
        ))
        .limit(1);

      if (!row) {
        return ErrorResponses.notFound(
          reply,
          'TenantApplication',
          `No organization_applications row for tenant=${tenantId} appCode=${appCode}`,
        );
      }

      const expiresAtIso = row.expiresAt
        ? new Date(row.expiresAt as unknown as string | Date).toISOString()
        : null;
      const now = Date.now();
      const notExpired = !expiresAtIso || new Date(expiresAtIso).getTime() > now;
      const isActive = Boolean(row.isEnabled) && row.appStatus === 'active' && notExpired;

      // Best-effort: surface the plan name for downstreams that key off plan.
      const plan = await resolveTenantPlan(tenantId);

      // Sanity assertion: app must appear in getEnabledAppsForTenant() when isActive=true.
      // (Defensive — not a hard failure if mismatched, just logged.)
      if (isActive) {
        const enabled = await getEnabledAppsForTenant(tenantId);
        if (!enabled.some((a) => a.appCode === appCode)) {
          request.log.warn({ tenantId, appCode, correlationId },
            'entitlement says active but app not in enabled-apps query — possible drift');
        }
      }

      return {
        success: true,
        correlationId,
        data: {
          tenantId,
          appCode:          row.appCode,
          plan,
          subscriptionTier: row.subscriptionTier ?? null,
          enabledModules:   Array.isArray(row.enabledModules) ? row.enabledModules : [],
          expiresAt:        expiresAtIso,
          isActive,
        },
      };
    } catch (err: unknown) {
      fastify.log.error({ err, tenantId, appCode, correlationId }, 'tenant entitlement pull failed');
      return reply.code(500).send({
        error: 'Failed to fetch tenant entitlement',
        correlationId,
      });
    }
  });
}
