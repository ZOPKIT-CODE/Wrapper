import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { applications, applicationModules, customRoles, organizationApplications } from '../../../db/schema/index.js';
import { InterAppEventService } from './inter-app-event-service.js';
import Logger from '../../../utils/logger.js';

type PublishReason =
  | 'plan_change'
  | 'manual_assignment'
  | 'module_assignment'
  | 'permission_update'
  | 'bulk_assignment'
  | 'assignment_removal';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isOrganizationAdminRoleName(roleName?: string | null): boolean {
  const normalized = String(roleName || '').toLowerCase().replace(/\s+/g, '_');
  return normalized === 'organization_admin' || normalized === 'organizationadmin';
}

function normalizePermissionCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && item.trim().length > 0) {
      out.add(item.trim());
      continue;
    }
    if (item && typeof item === 'object' && typeof (item as { code?: unknown }).code === 'string') {
      out.add(String((item as { code: string }).code).trim());
    }
  }
  return Array.from(out).filter(Boolean);
}

async function syncOrganizationAdminRolePermissions(
  tenantId: string,
  actorId?: string
): Promise<void> {
  const snapshot = await getTenantApplicationSnapshot(tenantId);
  const enabledApps = snapshot.filter((app) => app.isEnabled === true);
  const appIds = Array.from(new Set(enabledApps.map((app) => String(app.appId || '')).filter(Boolean)));

  const moduleDefaults = new Map<string, string[]>();
  if (appIds.length > 0) {
    const moduleRows = await db
      .select({
        appId: applicationModules.appId,
        moduleCode: applicationModules.moduleCode,
        permissions: applicationModules.permissions,
      })
      .from(applicationModules)
      .where(inArray(applicationModules.appId, appIds));

    for (const row of moduleRows) {
      const key = `${String(row.appId)}:${String(row.moduleCode)}`;
      moduleDefaults.set(key, normalizePermissionCodes(row.permissions));
    }
  }

  const nextPermissions: Record<string, Record<string, string[]>> = {};
  for (const app of enabledApps) {
    const appCode = String(app.appCode || '').trim().toLowerCase();
    if (!appCode) continue;
    if (!nextPermissions[appCode]) nextPermissions[appCode] = {};

    const enabledModules = Array.isArray(app.enabledModules) ? app.enabledModules : [];
    const customPermissions =
      app.customPermissions && typeof app.customPermissions === 'object'
        ? (app.customPermissions as Record<string, unknown>)
        : {};

    for (const moduleCodeRaw of enabledModules) {
      const moduleCode = String(moduleCodeRaw || '').trim();
      if (!moduleCode) continue;

      const fromCustom = normalizePermissionCodes(customPermissions[moduleCode]);
      const fromDefault = moduleDefaults.get(`${String(app.appId)}:${moduleCode}`) ?? [];
      const finalActions = Array.from(new Set([...(fromCustom.length > 0 ? fromCustom : fromDefault)]));

      if (finalActions.length > 0) {
        nextPermissions[appCode][moduleCode] = finalActions;
      }
    }
  }

  const roleRows = await db
    .select({
      roleId: customRoles.roleId,
      roleName: customRoles.roleName,
    })
    .from(customRoles)
    .where(eq(customRoles.tenantId, tenantId));

  const orgAdminRoles = roleRows.filter((role) => isOrganizationAdminRoleName(role.roleName));
  if (orgAdminRoles.length === 0) {
    Logger.log('warning', 'general', 'syncOrganizationAdminRolePermissions', `No Organization Admin role found to sync for tenant ${tenantId}`, { tenantId });
    return;
  }

  const validActorId = actorId && UUID_REGEX.test(actorId) ? actorId : undefined;
  for (const role of orgAdminRoles) {
    await db
      .update(customRoles)
      .set({
        permissions: nextPermissions,
        updatedAt: new Date(),
        ...(validActorId ? { lastModifiedBy: validActorId } : {}),
      })
      .where(eq(customRoles.roleId, role.roleId));
  }

  Logger.log('info', 'general', 'syncOrganizationAdminRolePermissions', `Synced Organization Admin role permissions for tenant ${tenantId}`, { tenantId, roleCount: orgAdminRoles.length });
}

async function getTargetApps(): Promise<string[]> {
  const fromEnv = process.env.BUSINESS_SUITE_TARGET_APPS
    ? process.env.BUSINESS_SUITE_TARGET_APPS.split(',').map((v: string) => v.trim()).filter(Boolean)
    : [];

  // Dynamically include every active application so provisioning changes are
  // pushed suite-wide without relying on a static env list.
  const activeApps = await db
    .select({ appCode: applications.appCode })
    .from(applications)
    .where(eq(applications.status, 'active'));

  const dynamicAppCodes = activeApps
    .map((row) => String(row.appCode || '').trim())
    .filter(Boolean);

  // Never send to wrapper itself.
  return [...new Set([...dynamicAppCodes, ...fromEnv])].filter((app) => app !== 'wrapper');
}

async function getTenantApplicationSnapshot(tenantId: string): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select({
      assignmentId: organizationApplications.id,
      appId: applications.appId,
      appCode: applications.appCode,
      appName: applications.appName,
      isEnabled: organizationApplications.isEnabled,
      subscriptionTier: organizationApplications.subscriptionTier,
      enabledModules: organizationApplications.enabledModules,
      customPermissions: organizationApplications.customPermissions,
      maxUsers: organizationApplications.maxUsers,
      licenseCount: organizationApplications.licenseCount,
      expiresAt: organizationApplications.expiresAt,
      updatedAt: organizationApplications.updatedAt,
      createdAt: organizationApplications.createdAt,
    })
    .from(organizationApplications)
    .innerJoin(applications, eq(organizationApplications.appId, applications.appId))
    .where(eq(organizationApplications.tenantId, tenantId));

  return rows.map((row) => ({
    ...row,
    enabledModules: Array.isArray(row.enabledModules) ? row.enabledModules : [],
    customPermissions:
      row.customPermissions && typeof row.customPermissions === 'object'
        ? row.customPermissions
        : {},
  }));
}

export async function publishTenantApplicationSyncEvent(params: {
  tenantId: string;
  reason: PublishReason;
  planId?: string;
  actorId?: string;
}): Promise<void> {
  const { tenantId, reason, planId, actorId } = params;

  const targetApps = await getTargetApps();
  if (!tenantId || targetApps.length === 0) return;

  try {
    // Keep Wrapper source role in sync so downstream Wrapper->FA sync does not revert entitlement updates.
    await syncOrganizationAdminRolePermissions(tenantId, actorId);
  } catch (syncError) {
    Logger.log('warning', 'general', 'publishTenantApplicationSyncEvent', `Failed to sync Organization Admin role permissions for tenant ${tenantId}`, { tenantId, error: (syncError as Error).message });
  }

  const applicationsSnapshot = await getTenantApplicationSnapshot(tenantId);
  const enabledAppCodes = applicationsSnapshot
    .filter((app) => app.isEnabled === true)
    .map((app) => String(app.appCode));

  const eventData: Record<string, unknown> = {
    tenantId,
    reason,
    planId: planId ?? null,
    applications: applicationsSnapshot,
    enabledAppCodes,
    emittedAt: new Date().toISOString(),
  };

  const publishResults = await Promise.allSettled(
    targetApps.map((targetApp) =>
      InterAppEventService.publishEvent({
        eventType: 'tenant.applications.updated',
        sourceApplication: 'wrapper',
        targetApplication: targetApp,
        tenantId,
        entityId: tenantId,
        eventData,
        publishedBy: actorId || 'system',
      })
    )
  );

  const failed = publishResults.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    Logger.log('error', 'general', 'publishTenantApplicationSyncEvent', `Failed to publish tenant.applications.updated for tenant ${tenantId}`, { tenantId, failedCount: failed.length, totalTargets: targetApps.length });
  } else {
    Logger.log('info', 'general', 'publishTenantApplicationSyncEvent', `Published tenant.applications.updated for tenant ${tenantId}`, { tenantId, targets: targetApps.join(', ') });
  }
}

