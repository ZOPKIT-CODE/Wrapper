/**
 * Tenant Snapshot Service
 *
 * Single source of truth for the "tenant.onboarded" event payload shape. Used by:
 *   - publishAppProvisioningEvents() in unified-onboarding-service.ts (push path)
 *   - GET /api/internal/tenants/:tenantId/snapshot               (pull path)
 *
 * Downstreams (CRM, FA) use the pull endpoint to recover from missed SNS events
 * or to detect drift. Both paths must return byte-compatible eventData so a
 * downstream replay handler is identical to its event handler.
 */

import { db } from '../../../db/index.js';
import { applications, organizationApplications, tenants } from '../../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { BootstrapService, type BootstrapPayload } from '../../app-sync/services/bootstrap-service.js';

// ─── Public Types ──────────────────────────────────────────────────────────

export interface TenantSnapshotEnabledApp {
  appCode: string;
  subscriptionTier: string | null;
  enabledModules: string[];
  expiresAt: string | null;
}

/**
 * The exact shape published as `eventData` for `tenant.onboarded` events.
 * Keep field names and ordering aligned with the SNS contract.
 */
export interface TenantSnapshotEventData {
  appCode: string;
  tenantId: string;
  plan: string;
  subscriptionTier: string | null;
  enabledModules: string[];
  expiresAt: string | null;
  tenantName: string;
  idpOrgId: string | null;
  snapshot: {
    tenant: BootstrapPayload['tenant'];
    organizations: BootstrapPayload['organizations'];
    users: BootstrapPayload['users'];
    roles: BootstrapPayload['roles'];
    employeeAssignments: BootstrapPayload['employeeAssignments'];
    roleAssignments: BootstrapPayload['roleAssignments'];
    creditConfigs: BootstrapPayload['creditConfigs'];
    entityCredits: BootstrapPayload['entityCredits'];
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Fetch the list of apps this tenant has enabled (and their per-app subscription
 * tier / modules / expiry) from `organization_applications`.
 */
export async function getEnabledAppsForTenant(tenantId: string): Promise<TenantSnapshotEnabledApp[]> {
  const rows = await db
    .select({
      appCode:          applications.appCode,
      subscriptionTier: organizationApplications.subscriptionTier,
      enabledModules:   organizationApplications.enabledModules,
      expiresAt:        organizationApplications.expiresAt,
    })
    .from(organizationApplications)
    .innerJoin(applications, eq(applications.appId, organizationApplications.appId))
    .where(and(
      eq(organizationApplications.tenantId, tenantId),
      eq(organizationApplications.isEnabled, true),
      eq(applications.status, 'active'),
    ));

  return rows.map((r) => ({
    appCode:          r.appCode,
    subscriptionTier: r.subscriptionTier ?? null,
    enabledModules:   Array.isArray(r.enabledModules) ? (r.enabledModules as string[]) : [],
    expiresAt:        r.expiresAt ? new Date(r.expiresAt as unknown as string | Date).toISOString() : null,
  }));
}

/**
 * Assemble one tenant.onboarded eventData payload for a single app.
 */
function buildEventDataForApp(
  tenantId: string,
  plan: string,
  app: TenantSnapshotEnabledApp,
  bootstrap: BootstrapPayload,
): TenantSnapshotEventData {
  return {
    appCode:          app.appCode,
    tenantId,
    plan,
    subscriptionTier: app.subscriptionTier,
    enabledModules:   app.enabledModules,
    expiresAt:        app.expiresAt,
    tenantName:       bootstrap.tenant?.tenantName ?? '',
    idpOrgId:         bootstrap.tenant?.idpOrgId ?? null,
    snapshot: {
      tenant:              bootstrap.tenant,
      organizations:       bootstrap.organizations,
      users:               bootstrap.users,
      roles:               bootstrap.roles,
      employeeAssignments: bootstrap.employeeAssignments,
      roleAssignments:     bootstrap.roleAssignments,
      creditConfigs:       bootstrap.creditConfigs,
      entityCredits:       bootstrap.entityCredits,
    },
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Build one app-scoped snapshot. Used by the event publisher (per app) and by
 * the pull endpoint when `?appCode=` is supplied.
 *
 * Returns `null` if the tenant has no enabled apps OR if `appCode` is supplied
 * but isn't enabled for the tenant.
 */
export async function buildTenantSnapshot(
  tenantId: string,
  appCode: string,
  plan: string,
  opts?: { enabledApps?: TenantSnapshotEnabledApp[] },
): Promise<TenantSnapshotEventData | null> {
  const enabledApps = opts?.enabledApps ?? await getEnabledAppsForTenant(tenantId);
  if (!enabledApps.length) return null;

  const app = enabledApps.find((a) => a.appCode === appCode);
  if (!app) return null;

  const bootstrap = await new BootstrapService().assemble(tenantId, appCode);
  return buildEventDataForApp(tenantId, plan, app, bootstrap);
}

/**
 * Build snapshots for every enabled app. Used by the pull endpoint when no
 * `appCode` query param is supplied.
 *
 * Returns a map of appCode → eventData. Empty object if no apps enabled.
 */
export async function buildAllTenantSnapshots(
  tenantId: string,
  plan: string,
): Promise<Record<string, TenantSnapshotEventData>> {
  const enabledApps = await getEnabledAppsForTenant(tenantId);
  if (!enabledApps.length) return {};

  const out: Record<string, TenantSnapshotEventData> = {};

  // Sequential to avoid hammering the DB; each assemble() already fans out internally.
  for (const app of enabledApps) {
    const bootstrap = await new BootstrapService().assemble(tenantId, app.appCode);
    out[app.appCode] = buildEventDataForApp(tenantId, plan, app, bootstrap);
  }
  return out;
}

/**
 * Resolve the tenant's current plan from the subscriptions table.
 * Falls back to `'free'` if no active subscription is found.
 */
export async function resolveTenantPlan(tenantId: string): Promise<string> {
  try {
    const { SubscriptionService } = await import('../../subscriptions/services/subscription-service.js');
    const sub = await SubscriptionService.getCurrentSubscription(tenantId);
    return (sub?.plan as string | undefined) ?? 'free';
  } catch {
    return 'free';
  }
}

/**
 * Check whether a tenant exists. Used by the pull endpoint to return a clean 404.
 */
export async function tenantExists(tenantId: string): Promise<boolean> {
  const rows = await db
    .select({ tenantId: tenants.tenantId })
    .from(tenants)
    .where(eq(tenants.tenantId, tenantId))
    .limit(1);
  return rows.length > 0;
}
