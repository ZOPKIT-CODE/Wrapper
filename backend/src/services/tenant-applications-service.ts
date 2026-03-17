import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { applications, organizationApplications } from '../db/schema/core/suite-schema.js';

class TenantApplicationsService {
  async getEnabledApplicationsForTenant(tenantId: string) {
    return db
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
  }
}

export default new TenantApplicationsService();
