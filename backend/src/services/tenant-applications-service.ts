import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  applications,
  applicationModules,
  organizationApplications,
} from '../db/schema/core/suite-schema.js';

/**
 * Enrich each tenant app with full module definitions + permission maps so
 * dashboard UI (e.g. ApplicationDetailsPage) can render the modules matrix.
 * Mirrors logic in admin application-assignment `/tenant-apps/:tenantId`.
 */
async function enrichTenantApplicationsWithModules<
  T extends { appId: string; enabledModules: unknown; customPermissions?: unknown },
>(rows: T[]) {
  return Promise.all(
    rows.map(async (tenantApp) => {
      const appModules = await db
        .select({
          moduleId: applicationModules.moduleId,
          moduleCode: applicationModules.moduleCode,
          moduleName: applicationModules.moduleName,
          description: applicationModules.description,
          isCore: applicationModules.isCore,
          permissions: applicationModules.permissions,
        })
        .from(applicationModules)
        .where(eq(applicationModules.appId, tenantApp.appId))
        .orderBy(applicationModules.moduleCode);

      const enabledModulesPermissions: Record<string, unknown> = {};
      const enabled = tenantApp.enabledModules;
      if (Array.isArray(enabled) && enabled.length > 0) {
        for (const moduleCode of enabled as string[]) {
          const mod = appModules.find((m) => m.moduleCode === moduleCode);
          if (mod?.permissions) {
            enabledModulesPermissions[moduleCode] = mod.permissions;
          }
        }
      }

      let customPermissions: Record<string, unknown> = {};
      if (tenantApp.customPermissions && typeof tenantApp.customPermissions === 'object') {
        customPermissions = tenantApp.customPermissions as Record<string, unknown>;
      }

      return {
        ...tenantApp,
        modules: appModules,
        enabledModulesPermissions,
        customPermissions,
      };
    }),
  );
}

class TenantApplicationsService {
  async getEnabledApplicationsForTenant(tenantId: string) {
    const rows = await db
      .select({
        appId: applications.appId,
        appCode: applications.appCode,
        appName: applications.appName,
        description: applications.description,
        icon: applications.icon,
        baseUrl: applications.baseUrl,
        isCore: applications.isCore,
        sortOrder: applications.sortOrder,
        isEnabled: organizationApplications.isEnabled,
        subscriptionTier: organizationApplications.subscriptionTier,
        enabledModules: organizationApplications.enabledModules,
        customPermissions: organizationApplications.customPermissions,
      })
      .from(organizationApplications)
      .innerJoin(applications, eq(organizationApplications.appId, applications.appId))
      .where(
        and(
          eq(organizationApplications.tenantId, tenantId),
          eq(organizationApplications.isEnabled, true),
        ),
      )
      .orderBy(applications.sortOrder, applications.appName);

    return enrichTenantApplicationsWithModules(rows);
  }
}

export default new TenantApplicationsService();
