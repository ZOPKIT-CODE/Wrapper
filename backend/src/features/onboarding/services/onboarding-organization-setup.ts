import { systemDbConnection } from '../../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { applications, organizationApplications, applicationModules } from '../../../db/schema/core/suite-schema.js';
import { v4 as uuidv4 } from 'uuid';
import { publishTenantApplicationSyncEvent } from '../../messaging/services/tenant-application-event-service.js';

interface PlanChangeOptions { skipIfRecentlyUpdated?: boolean }

class OnboardingOrganizationSetupService {
  // Update organization applications based on credit package (legacy; no DB writes)
  async updateOrganizationApplicationsForCreditPackage(tenantId: string, creditPackage: string): Promise<Record<string, unknown>> {
    try {
      console.log('🔄 Updating organization applications for credit package:', { tenantId, creditPackage });

      const applicationsByPackage: Record<string, string[]> = {
        basic: ['crm'],
        standard: ['crm', 'hr'],
        premium: ['crm', 'hr', 'affiliate'],
        enterprise: ['crm', 'hr', 'affiliate', 'accounting', 'inventory']
      };

      const availableApplications = applicationsByPackage[creditPackage as keyof typeof applicationsByPackage] || ['crm'];
      console.log('✅ Organization applications updated for credit package:', availableApplications);

      return {
        success: true,
        tenantId,
        creditPackage,
        applicationsUpdated: availableApplications
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error updating organization applications for credit package:', error);
      throw error;
    }
  }

  /**
   * Assign applications to the tenant based on plan (starter, professional, enterprise).
   * Inserts into organization_applications so the Applications dashboard shows all plan apps (e.g. CRM + HR for Professional).
   */
  async updateOrganizationApplicationsForPlanChange(tenantId: string, planId: string, options: PlanChangeOptions = {}): Promise<Record<string, unknown>> {
    try {
      console.log('🔄 Updating organization applications for plan change:', { tenantId, planId });

      const { PLAN_ACCESS_MATRIX } = await import('../../../data/permission-matrix.js');
      const planAccess = (PLAN_ACCESS_MATRIX as Record<string, { applications?: string[]; modules?: Record<string, unknown> }>)[planId] || (PLAN_ACCESS_MATRIX as Record<string, unknown>).free as { applications?: string[]; modules?: Record<string, unknown> };
      const appCodes = planAccess.applications || ['crm'];
      const modulesByApp = planAccess.modules || {} as Record<string, unknown>;

      const normalizeAppCode = (code: string): string => {
        const codeMap: Record<string, string> = {
          affiliateconnect: 'affiliateConnect',
          affiliate: 'affiliateConnect',
          project_management: 'project_management',
          projectmanagement: 'project_management'
        };
        return codeMap[String(code).toLowerCase()] || code;
      };

      const resolveAppId = (appCode: string, map: Record<string, string>): string | null => {
        const normalized = normalizeAppCode(appCode);
        return map[normalized] ?? map[appCode] ?? map[normalized.replace(/_/g, '')] ?? null;
      };

      const appRecords = await systemDbConnection
        .select({ appId: applications.appId, appCode: applications.appCode })
        .from(applications)
        .where(eq(applications.status, 'active'));

      const appCodeToIdMap: Record<string, string> = {};
      appRecords.forEach(app => {
        appCodeToIdMap[app.appCode] = app.appId;
      });

      const existing = await systemDbConnection
        .select({ appId: organizationApplications.appId })
        .from(organizationApplications)
        .where(eq(organizationApplications.tenantId, tenantId));
      const existingAppIds = new Set(existing.map(r => r.appId));

      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const applicationsToInsert: Record<string, unknown>[] = [];
      const applicationsToUpdate: { appId: string; appCode: string; enabledModules: string[]; }[] = [];

      for (const appCode of appCodes) {
        const appId = resolveAppId(appCode, appCodeToIdMap);
        if (!appId) {
          console.warn(`⚠️ Application code "${appCode}" not found in applications table. Skipping. Available: ${Object.keys(appCodeToIdMap).join(', ')}`);
          continue;
        }

        let enabledModules = modulesByApp[appCode] || [];
        if (enabledModules === '*') {
          const allModules = await systemDbConnection
            .select({ moduleCode: applicationModules.moduleCode })
            .from(applicationModules)
            .where(eq(applicationModules.appId, appId));
          enabledModules = allModules.map(m => m.moduleCode);
        }
        const resolvedModules = Array.isArray(enabledModules) ? enabledModules : [];

        if (existingAppIds.has(appId)) {
          // Existing app — update tier, modules, and expiry to match the new plan
          applicationsToUpdate.push({ appId, appCode, enabledModules: resolvedModules });
        } else {
          // New app — insert
          applicationsToInsert.push({
            id: uuidv4(),
            tenantId,
            appId,
            subscriptionTier: planId,
            isEnabled: true,
            enabledModules: resolvedModules,
            expiresAt: expiryDate
          });
          console.log(`✅ Will assign application ${appCode} (${appId}) to tenant ${tenantId}`);
        }
      }

      // Update existing apps with new plan's tier, modules, and re-enable if in plan
      for (const app of applicationsToUpdate) {
        await systemDbConnection
          .update(organizationApplications)
          .set({
            isEnabled: true,
            subscriptionTier: planId,
            enabledModules: app.enabledModules,
            expiresAt: expiryDate,
            updatedAt: new Date(),
          })
          .where(and(
            eq(organizationApplications.tenantId, tenantId),
            eq(organizationApplications.appId, app.appId)
          ));
        console.log(`🔄 Updated application ${app.appCode} to ${planId} tier with ${app.enabledModules.length} modules (enabled)`);
      }

      if (applicationsToInsert.length > 0) {
        await systemDbConnection
          .insert(organizationApplications)
          .values(applicationsToInsert);
        console.log(`✅ Assigned ${applicationsToInsert.length} new application(s) for plan ${planId} to tenant ${tenantId}`);
      }

      // Disable apps that are NOT in the new plan (e.g., downgrade from Enterprise to Starter)
      const planAppIds = new Set(
        appCodes.map(code => resolveAppId(code, appCodeToIdMap)).filter(Boolean) as string[]
      );
      const appsToDisable = existing.filter(r => r.appId && !planAppIds.has(r.appId));

      for (const app of appsToDisable) {
        await systemDbConnection
          .update(organizationApplications)
          .set({
            isEnabled: false,
            subscriptionTier: planId,
            updatedAt: new Date(),
          })
          .where(and(
            eq(organizationApplications.tenantId, tenantId),
            eq(organizationApplications.appId as any, app.appId)
          ));
      }

      if (appsToDisable.length > 0) {
        const disabledCodes = appsToDisable.map(a => {
          return Object.entries(appCodeToIdMap).find(([, id]) => id === a.appId)?.[0] ?? a.appId;
        });
        console.log(`🔒 Disabled ${appsToDisable.length} app(s) not in ${planId} plan: ${disabledCodes.join(', ')}`);
      }

      if (applicationsToInsert.length === 0 && applicationsToUpdate.length === 0 && appsToDisable.length === 0) {
        console.log(`ℹ️ No application changes needed for plan ${planId} (tenant already has all plan apps at correct tier).`);
      } else {
        console.log(`✅ Plan change complete: ${applicationsToUpdate.length} updated, ${applicationsToInsert.length} added, ${appsToDisable.length} disabled`);
      }

      // ── Publish thin tenant.app.provisioned for EACH newly granted app ──
      // These are the apps that did NOT exist in organization_applications before
      // this plan change. Each downstream app receives its own scoped event so
      // it knows to prepare for bootstrap on first user login.
      // This is separate from the fat tenant.applications.updated event below —
      // that event is for permission sync; these are for bootstrap triggering.
      if (applicationsToInsert.length > 0) {
        const newAppCodes = applicationsToInsert.map((a: any) => {
          // reverse-lookup appCode from appCodeToIdMap
          return Object.entries(appCodeToIdMap).find(([, id]) => id === a.appId)?.[0] ?? null;
        }).filter(Boolean) as string[];

        if (newAppCodes.length > 0) {
          const { InterAppEventService } = await import('../../messaging/services/inter-app-event-service.js');
          const { deriveEventId } = await import('../../messaging/services/event-id.js');

          await Promise.allSettled(
            newAppCodes.map(async (newAppCode) => {
              const appRow = applicationsToInsert.find((a: any) => appCodeToIdMap[newAppCode] === a.appId) as any;
              try {
                await InterAppEventService.publishEvent({
                  eventType:         'tenant.app.provisioned',
                  sourceApplication: 'wrapper',
                  // Route to THIS specific app's queue only
                  targetApplication: newAppCode,
                  tenantId,
                  entityId:          tenantId,
                  publishedBy:       'system',
                  // Deterministic: retrying the same plan upgrade for the
                  // same (tenant, app) collapses on the outbox unique key.
                  eventId: deriveEventId({
                    eventType: 'tenant.app.provisioned',
                    tenantId,
                    entityId: tenantId,
                    domainOpId: `plan_upgrade:${planId}`,
                    targetApplication: newAppCode,
                  }),
                  eventData: {
                    appCode:          newAppCode,
                    tenantId,
                    plan:             planId,
                    subscriptionTier: planId,
                    enabledModules:   Array.isArray(appRow?.enabledModules) ? appRow.enabledModules : [],
                    expiresAt:        appRow?.expiresAt ? new Date(appRow.expiresAt).toISOString() : null,
                    provisionReason:  'plan_upgrade',
                    // No domain data embedded — app bootstraps lazily on first login
                    bootstrapHint:    'lazy — call POST /api/sync/tenants/:id/bootstrap on first user login',
                  },
                });
                console.log(`  ✅ Published tenant.app.provisioned → ${newAppCode} (plan_upgrade for tenant ${tenantId})`);
              } catch (pubErr: unknown) {
                console.warn(`  ⚠️ Failed to publish tenant.app.provisioned → ${newAppCode}:`, (pubErr as Error).message);
              }
            })
          );
        }
      }

      // Skip tenant.applications.updated for plan changes — subscription.upgraded
      // (published by handleSubscriptionUpdated / handleCheckoutCompleted) already
      // carries the per-app modules and triggers the same role permission sync in
      // downstream apps. Publishing both causes redundant processing and 11× MQ
      // messages (one per active app) with identical fat payloads.
      // tenant.applications.updated is still published for manual admin operations
      // (module_assignment, permission_update, etc.) via application-assignment routes.

      return {
        success: true,
        tenantId,
        planId,
        applicationsAssigned: applicationsToInsert.length,
        applicationsInPlan: appCodes,
        newlyProvisionedApps: applicationsToInsert.length > 0
          ? applicationsToInsert.map((a: any) =>
              Object.entries(appCodeToIdMap).find(([, id]) => id === a.appId)?.[0] ?? 'unknown'
            )
          : [],
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error updating organization applications for plan change:', error);
      throw error;
    }
  }

  // Setup initial organization structure
  async setupInitialOrganizationStructure(tenantId: string, _organizationData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      console.log('🏗️ Setting up initial organization structure:', { tenantId });

      // This would typically create default roles, permissions, etc.
      // For now, just return success
      console.log('✅ Initial organization structure setup completed');

      return {
        success: true,
        tenantId,
        structure: {
          rolesCreated: [],
          permissionsSet: [],
          applicationsConfigured: []
        }
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error setting up initial organization structure:', error);
      throw error;
    }
  }

  // Configure applications for new organization based on credit package with modules from permission matrix
  async configureApplicationsForNewOrganization(tenantId: string, creditPackage: string, organizationId: string | null = null): Promise<Record<string, unknown>> {
    try {
      console.log('⚙️ Configuring applications for new organization:', { tenantId, creditPackage, organizationId });

      // Import permission matrix to get plan-based modules
      const { PLAN_ACCESS_MATRIX } = await import('../../../data/permission-matrix.js');
      const planAccess = (PLAN_ACCESS_MATRIX as Record<string, { applications?: string[]; modules?: Record<string, unknown> }>)[creditPackage];
      
      if (!planAccess) {
        throw new Error(`Plan ${creditPackage} not found in PLAN_ACCESS_MATRIX`);
      }

      // Get applications and modules from permission matrix
      const appCodes = planAccess.applications || [];
      const modulesByApp = planAccess.modules || {};
      
      console.log(`📋 Assigning applications for ${creditPackage} plan:`, appCodes);
      console.log(`📋 Modules per application:`, modulesByApp);

      // Normalize app codes to match database (case-insensitive matching)
      const normalizeAppCode = (code: string): string => {
        const codeMap: Record<string, string> = {
          'affiliateconnect': 'affiliateConnect',
          'affiliate': 'affiliateConnect'
        };
        return codeMap[code.toLowerCase()] ?? code;
      };

      // Get application IDs from app codes
      const appRecords = await systemDbConnection
        .select({ appId: applications.appId, appCode: applications.appCode })
        .from(applications)
        .where(eq(applications.status, 'active'));

      const appCodeToIdMap: Record<string, string> = {};
      appRecords.forEach(app => {
        appCodeToIdMap[app.appCode] = app.appId;
      });

      // Calculate expiry date (1 year from now for free plan, or based on plan)
      const expiryDate = new Date();
      const expiryMonths = creditPackage === 'free' ? 12 : (creditPackage === 'enterprise' ? 24 : 12);
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      // Insert organization applications with enabled modules from permission matrix
      const applicationsToInsert: Record<string, unknown>[] = [];
      for (const appCode of appCodes) {
        const normalizedCode = normalizeAppCode(appCode);
        const appId = appCodeToIdMap[normalizedCode];
        if (appId) {
          // Get enabled modules for this application from permission matrix
          const enabledModules = modulesByApp[appCode] || [];
          
          // If modules is '*', get all modules for this app (for enterprise plan)
          let finalEnabledModules = enabledModules;
          if (enabledModules === '*') {
            // Get all modules for this application from application_modules table
            const { applicationModules } = await import('../../../db/schema/core/suite-schema.js');
            const allModules = await systemDbConnection
              .select({ moduleCode: applicationModules.moduleCode })
              .from(applicationModules)
              .where(eq(applicationModules.appId, appId));
            finalEnabledModules = allModules.map(m => m.moduleCode);
          }
          
          applicationsToInsert.push({
            id: uuidv4(),
            tenantId,
            appId,
            subscriptionTier: creditPackage,
            isEnabled: true,
            enabledModules: finalEnabledModules, // CRITICAL FIX: Populate from permission matrix
            customPermissions: {},
            expiresAt: expiryDate
          });
          
          console.log(`✅ Application ${appCode} configured with modules:`, finalEnabledModules);
        } else {
          console.warn(`⚠️ Application with code ${normalizedCode} (original: ${appCode}) not found in database. Available apps:`, Object.keys(appCodeToIdMap));
        }
      }

      if (applicationsToInsert.length > 0) {
        await systemDbConnection
          .insert(organizationApplications)
          .values(applicationsToInsert);
        
        console.log(`✅ Successfully assigned ${applicationsToInsert.length} applications with modules to tenant ${tenantId}`);
      } else {
        console.warn(`⚠️ No applications were assigned to tenant ${tenantId}`);
      }

      return {
        success: true,
        tenantId,
        creditPackage,
        applicationsConfigured: appCodes,
        applicationsAssigned: applicationsToInsert.length,
        modulesConfigured: applicationsToInsert.reduce((acc: Record<string, unknown>, app: Record<string, unknown>) => {
          acc[app.appId as string] = app.enabledModules;
          return acc;
        }, {} as Record<string, unknown>)
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error configuring applications for new organization:', error);
      throw error;
    }
  }
}

export { OnboardingOrganizationSetupService };
export default new OnboardingOrganizationSetupService();
