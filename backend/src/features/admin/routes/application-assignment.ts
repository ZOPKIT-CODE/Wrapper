import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/index.js';
import {
  applications,
  organizationApplications,
  applicationModules,
  tenants,
  entities
} from '../../../db/schema/index.js';
import { eq, and, sql, count, inArray } from 'drizzle-orm';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { publishTenantApplicationSyncEvent } from '../../messaging/services/tenant-application-event-service.js';
import { requirePlatformPermission } from '../../../middleware/auth/platform-permission-middleware.js';

/**
 * Admin Application Assignment Routes
 * Handles assignment of applications to tenants and entities
 */

export default async function applicationAssignmentRoutes(fastify: FastifyInstance, _options?: object): Promise<void> {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/tenant-apps/:tenantId', {
    schema: {
      description: 'Get tenant-specific applications with modules and permissions',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';

      console.log('🔍 Tenant-apps route called');
      console.log('🔍 Tenant ID:', tenantId);
      console.log('🔍 Headers:', request.headers);
      console.log('🔍 User:', request.user);

      // Get tenant applications with modules and permissions
      const tenantApplications = await db
        .select({
          id: organizationApplications.id,
          appId: applications.appId,
          appCode: applications.appCode,
          appName: applications.appName,
          description: applications.description,
          icon: applications.icon,
          baseUrl: applications.baseUrl,
          isCore: applications.isCore,
          isEnabled: organizationApplications.isEnabled,
          subscriptionTier: organizationApplications.subscriptionTier,
          enabledModules: organizationApplications.enabledModules,
          customPermissions: organizationApplications.customPermissions,
          maxUsers: organizationApplications.maxUsers,
          createdAt: organizationApplications.createdAt
        })
        .from(organizationApplications)
        .innerJoin(applications, eq(organizationApplications.appId, applications.appId))
        .where(eq(organizationApplications.tenantId, tenantId))
        .orderBy(applications.appName);

      console.log(`🔍 Found ${tenantApplications.length} tenant applications for tenant ${tenantId}`);

      // Process each tenant application to include modules and permissions
      const processedApplications = await Promise.all(
        tenantApplications.map(async (tenantApp) => {
          try {
            console.log(`🔍 Processing app: ${tenantApp.appCode} (${tenantApp.appId})`);

            // Get all modules for this application
            const appModules = await db
              .select({
                moduleId: applicationModules.moduleId,
                moduleCode: applicationModules.moduleCode,
                moduleName: applicationModules.moduleName,
                description: applicationModules.description,
                isCore: applicationModules.isCore,
                permissions: applicationModules.permissions
              })
              .from(applicationModules)
              .where(eq(applicationModules.appId, tenantApp.appId))
              .orderBy(applicationModules.moduleCode);

            console.log(`📦 Found ${appModules.length} modules for app ${tenantApp.appCode}`);

            const enabledModulesPermissions: Record<string, any> = {};
            let customPermissions: Record<string, any> = {};

            if (tenantApp.enabledModules && Array.isArray(tenantApp.enabledModules) && tenantApp.enabledModules.length > 0) {
              (tenantApp.enabledModules as string[]).forEach((moduleCode: string) => {
                const module = appModules.find((m: any) => m.moduleCode === moduleCode);
                if (module && module.permissions) {
                  enabledModulesPermissions[moduleCode] = module.permissions;
                  console.log(`✅ Added permissions for enabled module ${moduleCode}:`, module.permissions);
                } else {
                  console.log(`⚠️ Module ${moduleCode} not found or has no permissions`);
                }
              });
            } else {
              console.log(`⚠️ No enabled modules for tenant app ${tenantApp.appCode}`);
            }

            // Extract custom permissions if they exist
            if (tenantApp.customPermissions) {
              try {
                // customPermissions is already a JSON object, no need to parse
                customPermissions = tenantApp.customPermissions || {};
                console.log(`🎯 Custom permissions for ${tenantApp.appCode}:`, customPermissions);
              } catch (parseError) {
                console.log(`❌ Error parsing custom permissions for tenant app ${tenantApp.id}:`, parseError);
                customPermissions = {};
              }
            } else {
              console.log(`📋 No custom permissions set for ${tenantApp.appCode}`);
            }

            return {
              ...tenantApp,
              modules: appModules,
              enabledModulesPermissions: enabledModulesPermissions,
              customPermissions: customPermissions
            };
          } catch (err: unknown) {
      const error = err as Error;
            console.log(`Error processing permissions for tenant app ${tenantApp.id}:`, error);
            return {
              ...tenantApp,
              modules: [],
              enabledModulesPermissions: {},
              customPermissions: {}
            };
          }
        })
      );

      console.log(`🏢 Processed ${processedApplications.length} tenant applications`);
      reply.send({
        success: true,
        data: {
          tenantId,
          applications: processedApplications
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching tenant applications:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenant applications'
      });
    }
  });

  /**
   * GET /api/admin/application-assignments/overview
   * Get overview of application assignments across all tenants
   */
  fastify.get('/overview', {
    schema: {
      description: 'Get overview of application assignments across all tenants',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const totalApps = await db
        .select({ count: count() })
        .from(applications);

      // Get total assignments
      const totalAssignments = await db
        .select({ count: count() })
        .from(organizationApplications);

      // Get tenant stats
      const tenantsWithApps = await db
        .select({
          tenantId: organizationApplications.tenantId,
          count: count()
        })
        .from(organizationApplications)
        .groupBy(organizationApplications.tenantId);

      const totalTenants = await db
        .select({ count: count() })
        .from(tenants);

      const tenantStats = {
        withApps: tenantsWithApps.length,
        withoutApps: Math.max(0, Number((totalTenants[0] as any)?.count ?? 0) - tenantsWithApps.length)
      };

      // Get application usage stats
      const applicationStats = await db
        .select({
          appId: applications.appId,
          appCode: applications.appCode,
          appName: applications.appName,
          assignmentCount: sql`count(${organizationApplications.id})`,
          enabledCount: sql`count(case when ${organizationApplications.isEnabled} = true then 1 end)`
        })
        .from(applications)
        .leftJoin(organizationApplications, eq(applications.appId, organizationApplications.appId))
        .groupBy(applications.appId, applications.appCode, applications.appName)
        .orderBy(applications.appName);

      return reply.send({
        success: true,
        data: {
          totalApplications: (totalApps[0] as any)?.count ?? 0,
          totalAssignments: (totalAssignments[0] as any)?.count ?? 0,
          tenantStats,
          applicationStats
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching application assignment overview:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch application assignment overview'
      });
    }
  });

  /**
   * GET /api/admin/application-assignments/tenants
   * Get all tenants with their application assignments
   */
  fastify.get('/tenants', {
    schema: {
      description: 'Get all tenants with their application assignments',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const queryParams = request.query as Record<string, string>;
    try {
      const search = queryParams.search;
      const hasApps = queryParams.hasApps;
      const appCode = queryParams.appCode;
      const limit = Number(queryParams.limit) || 50;
      const offset = Number(queryParams.offset) || 0;

      // Build base query - simplified version
      let tenantsQuery = db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          isActive: tenants.isActive,
          createdAt: tenants.createdAt
        })
        .from(tenants);

      if (search) {
        tenantsQuery = tenantsQuery.where(sql`(${tenants.companyName} ILIKE ${`%${search}%`} OR ${tenants.subdomain} ILIKE ${`%${search}%`})`) as typeof tenantsQuery;
      }

      const tenantList = await tenantsQuery
        .orderBy(tenants.companyName)
        .limit(limit)
        .offset(offset);

      // Get detailed application info for each tenant
      const tenantsWithDetails = await Promise.all(
        tenantList.map(async (tenant) => {
          try {
            const tenantApplications = await db
              .select({
                id: organizationApplications.id,
                appId: applications.appId,
                appCode: applications.appCode,
                appName: applications.appName,
                isEnabled: organizationApplications.isEnabled,
                subscriptionTier: organizationApplications.subscriptionTier,
                enabledModules: organizationApplications.enabledModules,
                customPermissions: organizationApplications.customPermissions,
                maxUsers: organizationApplications.maxUsers,
                createdAt: organizationApplications.createdAt
              })
              .from(organizationApplications)
              .innerJoin(applications, eq(organizationApplications.appId, applications.appId))
              .where(eq(organizationApplications.tenantId, tenant.tenantId))
              .orderBy(applications.appName);

            // Process tenant applications to include permissions
            const processedTenantApplications = await Promise.all(
              tenantApplications.map(async (tenantApp) => {
                try {
                  // Get all modules for this application to include permissions
                  console.log(`🔍 Fetching modules for app ${tenantApp.appCode} (${tenantApp.appId})`);
                  const appModules = await db
                    .select({
                      moduleId: applicationModules.moduleId,
                      moduleCode: applicationModules.moduleCode,
                      moduleName: applicationModules.moduleName,
                      permissions: applicationModules.permissions
                    })
                    .from(applicationModules)
                    .where(eq(applicationModules.appId, tenantApp.appId))
                    .orderBy(applicationModules.moduleCode);

                  console.log(`📦 Found ${appModules.length} modules for app ${tenantApp.appCode}`);
                  console.log(`🔧 Enabled modules for tenant:`, tenantApp.enabledModules);

                  const enabledModulesPermissions: Record<string, any> = {};

                  if (tenantApp.enabledModules && Array.isArray(tenantApp.enabledModules) && tenantApp.enabledModules.length > 0) {
                    (tenantApp.enabledModules as string[]).forEach((moduleCode: string) => {
                      const module = appModules.find((m: any) => m.moduleCode === moduleCode);
                      if (module && module.permissions) {
                        enabledModulesPermissions[moduleCode] = module.permissions;
                        console.log(`✅ Added permissions for module ${moduleCode}:`, module.permissions);
                      } else {
                        console.log(`⚠️ Module ${moduleCode} not found or has no permissions`);
                      }
                    });
                  } else {
                    console.log(`⚠️ No enabled modules for tenant app ${tenantApp.appCode}`);
                  }

                  // Extract custom permissions if they exist
                  let customPermissions = {};
                  if (tenantApp.customPermissions) {
                    try {
                      // customPermissions is already a JSON object, no need to parse
                      customPermissions = tenantApp.customPermissions || {};
                      console.log(`🎯 Custom permissions for ${tenantApp.appCode}:`, customPermissions);
                    } catch (parseError) {
                      console.log(`❌ Error parsing custom permissions for tenant app ${tenantApp.id}:`, parseError);
                      customPermissions = {};
                    }
                  } else {
                    console.log(`📋 No custom permissions set for ${tenantApp.appCode}`);
                  }

                  const result = {
                    ...tenantApp,
                    availableModules: appModules,
                    enabledModulesPermissions: enabledModulesPermissions,
                    customPermissions: customPermissions
                  };

                  console.log(`📤 Final response for ${tenantApp.appCode}:`, {
                    enabledModulesCount: (Array.isArray(tenantApp.enabledModules) ? tenantApp.enabledModules.length : 0),
                    availableModulesCount: appModules.length,
                    enabledModulesPermissionsCount: Object.keys(enabledModulesPermissions).length,
                    customPermissionsKeys: Object.keys(customPermissions)
                  });

                  return result;
                } catch (err: unknown) {
      const error = err as Error;
                  console.log(`Error processing permissions for tenant app ${tenantApp.id}:`, error);
                  return {
                    ...tenantApp,
                    availableModules: [],
                    enabledModulesPermissions: {},
                    customPermissions: {}
                  };
                }
              })
            );

            const tenantResult = {
              ...tenant,
              assignmentCount: tenantApplications.length,
              enabledCount: tenantApplications.filter(app => app.isEnabled).length,
              applications: processedTenantApplications
            };

            console.log(`🏢 Processed tenant ${tenant.companyName} (${tenant.tenantId}):`, {
              totalApps: tenantApplications.length,
              enabledApps: tenantApplications.filter(app => app.isEnabled).length,
              appsWithPermissions: processedTenantApplications.filter(app => Object.keys(app.enabledModulesPermissions).length > 0).length
            });

            return tenantResult;
          } catch (err: unknown) {
      const error = err as Error;
            // If there's an error getting applications for this tenant, return tenant with empty applications
            console.log(`Error getting applications for tenant ${tenant.tenantId}:`, error);
            return {
              ...tenant,
              assignmentCount: 0,
              enabledCount: 0,
              applications: []
            };
          }
        })
      );

      // Apply hasApps filter after fetching data
      let filteredTenants = tenantsWithDetails;
      if (hasApps !== undefined) {
        if (hasApps) {
          filteredTenants = tenantsWithDetails.filter(tenant => tenant.assignmentCount > 0);
        } else {
          filteredTenants = tenantsWithDetails.filter(tenant => tenant.assignmentCount === 0);
        }
      }

      return {
        success: true,
        data: {
          tenants: filteredTenants,
          pagination: {
            limit,
            offset,
            total: filteredTenants.length
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching tenants with applications:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenants with applications'
      });
    }
  });

  /**
   * GET /api/admin/application-assignments/tenant/:tenantId
   * Get application assignments for a specific tenant
   */
  fastify.get('/tenant/:tenantId', {
    schema: {
      description: 'Get application assignments for a specific tenant',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const tenantId = params.tenantId ?? '';

      // Verify tenant exists
      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Tenant not found'
        });
      }

      // Get all applications with assignment status
      const allApps = await db
        .select({
          appId: applications.appId,
          appCode: applications.appCode,
          appName: applications.appName,
          description: applications.description,
          icon: applications.icon,
          baseUrl: applications.baseUrl,
          isCore: applications.isCore,
          sortOrder: applications.sortOrder,
          // Assignment details (null if not assigned)
          id: organizationApplications.id,
          isEnabled: organizationApplications.isEnabled,
          subscriptionTier: organizationApplications.subscriptionTier,
          enabledModules: organizationApplications.enabledModules,
          licenseCount: organizationApplications.licenseCount,
          maxUsers: organizationApplications.maxUsers,
          expiresAt: organizationApplications.expiresAt,
          assignedAt: organizationApplications.createdAt
        })
        .from(applications)
        .leftJoin(
          organizationApplications,
          and(
            eq(organizationApplications.appId, applications.appId),
            eq(organizationApplications.tenantId, tenantId)
          )
        )
        .orderBy(applications.sortOrder, applications.appName);

      // Get modules for each application with permissions
      const appsWithModules = await Promise.all(
        allApps.map(async (app) => {
          const modules = await db
            .select({
              moduleId: applicationModules.moduleId,
              moduleCode: applicationModules.moduleCode,
              moduleName: applicationModules.moduleName,
              description: applicationModules.description,
              isCore: applicationModules.isCore,
              permissions: applicationModules.permissions
            })
            .from(applicationModules)
            .where(eq(applicationModules.appId, app.appId))
            .orderBy(applicationModules.moduleName);

          // For assigned applications, get current custom permissions or use default module permissions
          let customPermissions = {};
          if (app.id) {
            const assignment = await db
              .select({ customPermissions: organizationApplications.customPermissions })
              .from(organizationApplications)
              .where(eq(organizationApplications.id, app.id))
              .limit(1);

            customPermissions = assignment[0]?.customPermissions || {};
          }

          // Parse and merge module permissions with custom permissions
          const modulesWithPermissions = modules.map(module => {
            // Parse the JSON permissions string from database
            let defaultPermissions = [];
            try {
              if (module.permissions && typeof module.permissions === 'string') {
                defaultPermissions = JSON.parse(module.permissions);
              } else if (Array.isArray(module.permissions)) {
                defaultPermissions = module.permissions;
              }
            } catch (err: unknown) {
      const error = err as Error;
              console.warn(`Failed to parse permissions for module ${module.moduleCode}:`, error);
              defaultPermissions = [];
            }

            // Get custom permissions or use defaults
            const moduleCustomPermissions = (customPermissions as Record<string, any>)[module.moduleCode] || defaultPermissions;

            return {
              ...module,
              permissions: defaultPermissions, // Keep original parsed permissions
              customPermissions: moduleCustomPermissions
            };
          });

          return {
            ...app,
            isAssigned: app.id !== null,
            modules: modulesWithPermissions,
            customPermissions
          };
        })
      );

      return {
        success: true,
        data: {
          tenant: tenant[0],
          applications: appsWithModules
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching tenant application assignments:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenant application assignments'
      });
    }
  });

  /**
   * POST /api/admin/application-assignments/assign
   * Assign an application to a tenant
   */
  fastify.post('/assign', {
    schema: {
      description: 'Assign an application to a tenant',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const tenantId = body.tenantId;
      const appId = body.appId;
      const isEnabled = body.isEnabled !== false;
      const subscriptionTier = body.subscriptionTier ?? 'basic';
      const enabledModules = Array.isArray(body.enabledModules) ? body.enabledModules : [];
      const customPermissions = body.customPermissions;
      const licenseCount = Number(body.licenseCount) || 0;
      const maxUsers = body.maxUsers ? Number(body.maxUsers) : null;
      const expiresAt = body.expiresAt || null;

      // Verify tenant and application exist
      const [tenant, app] = await Promise.all([
        db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1),
        db.select().from(applications).where(eq(applications.appId, appId)).limit(1)
      ]);

      if (tenant.length === 0) {
        return reply.code(404).send({ success: false, error: 'Tenant not found' });
      }

      if (app.length === 0) {
        return reply.code(404).send({ success: false, error: 'Application not found' });
      }

      // Check if assignment already exists
      const existing = await db
        .select()
        .from(organizationApplications)
        .where(and(
          eq(organizationApplications.tenantId, tenantId),
          eq(organizationApplications.appId, appId)
        ))
        .limit(1);

      let assignmentId;
      if (existing.length > 0) {
        // Update existing assignment instead of throwing error
        console.log('📝 Updating existing application assignment');

        // Handle permissions: use customPermissions if provided, otherwise get default permissions
        let finalCustomPermissions = {};
        if (enabledModules && enabledModules.length > 0) {
          if (customPermissions && Object.keys(customPermissions).length > 0) {
            // Use the provided custom permissions
            finalCustomPermissions = customPermissions;
            console.log('Using custom permissions:', finalCustomPermissions);
          } else {
            // Get default permissions for enabled modules
            const modulesData = await db
              .select({
                moduleCode: applicationModules.moduleCode,
                permissions: applicationModules.permissions
              })
              .from(applicationModules)
              .where(and(
                eq(applicationModules.appId, appId),
                inArray(applicationModules.moduleCode, enabledModules)
              ));

            // Set default permissions for each enabled module
            modulesData.forEach(module => {
              let parsedPermissions = [];
              try {
                if (module.permissions && typeof module.permissions === 'string') {
                  parsedPermissions = JSON.parse(module.permissions);
                } else if (Array.isArray(module.permissions)) {
                  parsedPermissions = module.permissions;
                }
              } catch (err: unknown) {
      const error = err as Error;
                console.warn(`Failed to parse permissions for module ${module.moduleCode}:`, error);
                parsedPermissions = [];
              }
              // Only set permissions for this specific application's modules
              // Don't merge with permissions from other applications
              (finalCustomPermissions as Record<string, any>)[module.moduleCode] = parsedPermissions;
            });
            console.log('Using default permissions for app', appId, ':', finalCustomPermissions);
          }
        }

        // Update the existing assignment
        const updatedAssignment = await db
          .update(organizationApplications)
          .set({
            isEnabled,
            subscriptionTier,
            enabledModules,
            customPermissions: Object.keys(finalCustomPermissions).length > 0 ? finalCustomPermissions : null,
            licenseCount,
            maxUsers,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            updatedAt: new Date()
          })
          .where(eq(organizationApplications.id, existing[0].id))
          .returning();

        assignmentId = updatedAssignment[0].id;

        try {
          const actorId = ((request as any).user?.userId || (request as any).user?.id || 'system') as string;
          await publishTenantApplicationSyncEvent({
            tenantId,
            reason: 'manual_assignment',
            actorId,
          });
        } catch (publishError: unknown) {
          request.log.warn({ err: publishError, tenantId }, 'Failed to publish tenant application sync event');
        }

        return {
          success: true,
          data: {
            assignment: updatedAssignment[0],
            tenant: tenant[0],
            application: app[0],
            action: 'updated'
          }
        };
      }

      // Handle permissions: use customPermissions if provided, otherwise get default permissions
      let finalCustomPermissions: Record<string, any> = {};
      if (enabledModules && Array.isArray(enabledModules) && enabledModules.length > 0) {
        if (customPermissions && typeof customPermissions === 'object' && customPermissions !== null && Object.keys(customPermissions).length > 0) {
          // Use the provided custom permissions
          finalCustomPermissions = customPermissions as Record<string, any>;
          console.log('Using custom permissions:', finalCustomPermissions);
        } else {
          // Get default permissions for enabled modules
          const modulesData = await db
            .select({
              moduleCode: applicationModules.moduleCode,
              permissions: applicationModules.permissions
            })
            .from(applicationModules)
            .where(and(
              eq(applicationModules.appId, appId),
              inArray(applicationModules.moduleCode, enabledModules)
            ));

          // Set default permissions for each enabled module
          modulesData.forEach(module => {
            let parsedPermissions = [];
            try {
              if (module.permissions && typeof module.permissions === 'string') {
                parsedPermissions = JSON.parse(module.permissions);
              } else if (Array.isArray(module.permissions)) {
                parsedPermissions = module.permissions;
              }
            } catch (err: unknown) {
      const error = err as Error;
              console.warn(`Failed to parse permissions for module ${module.moduleCode}:`, error);
              parsedPermissions = [];
            }
            (finalCustomPermissions as Record<string, any>)[module.moduleCode] = parsedPermissions;
          });
          console.log('Using default permissions:', finalCustomPermissions);
        }
      }

      // Create assignment
      const assignment = await db
        .insert(organizationApplications)
        .values({
          tenantId,
          appId,
          isEnabled,
          subscriptionTier,
          enabledModules,
          customPermissions: Object.keys(finalCustomPermissions).length > 0 ? finalCustomPermissions : null,
          licenseCount,
          maxUsers,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        })
        .returning();

      try {
        const actorId = ((request as any).user?.userId || (request as any).user?.id || 'system') as string;
        await publishTenantApplicationSyncEvent({
          tenantId,
          reason: 'manual_assignment',
          actorId,
        });
      } catch (publishError: unknown) {
        request.log.warn({ err: publishError, tenantId }, 'Failed to publish tenant application sync event');
      }

      return {
        success: true,
        data: {
          assignment: assignment[0],
          tenant: tenant[0],
          application: app[0],
          action: 'created'
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error assigning application to tenant:', error.message);
      console.error('❌ Stack:', error.stack);
      request.log.error(error, 'Error assigning application to tenant:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to assign application to tenant'
      });
    }
  });

  /**
   * PUT /api/admin/application-assignments/:assignmentId
   * Update an application assignment
   */
  fastify.put('/:assignmentId', {
    schema: {
      description: 'Update an application assignment',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const assignmentId = params.assignmentId;
      const updateData = body;

      // Verify assignment exists
      const existing = await db
        .select()
        .from(organizationApplications)
        .where(eq(organizationApplications.id, assignmentId))
        .limit(1);

      if (existing.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Assignment not found'
        });
      }

      const updates: Record<string, any> = {
        ...(typeof updateData === 'object' && updateData !== null ? updateData : {}),
        updatedAt: new Date()
      };

      if (updateData && (updateData as any).expiresAt) {
        updates.expiresAt = new Date((updateData as any).expiresAt);
      }

      // Update assignment
      const updated = await db
        .update(organizationApplications)
        .set(updates)
        .where(eq(organizationApplications.id, assignmentId))
        .returning();

      try {
        const actorId = ((request as any).user?.userId || (request as any).user?.id || 'system') as string;
        const tenantId = existing[0].tenantId;
        if (!tenantId) {
          request.log.warn({ assignmentId }, 'Skipping tenant application sync event: missing tenantId');
        } else {
          await publishTenantApplicationSyncEvent({
            tenantId,
            reason: 'manual_assignment',
            actorId,
          });
        }
      } catch (publishError: unknown) {
        request.log.warn({ err: publishError, assignmentId }, 'Failed to publish tenant application sync event');
      }

      return {
        success: true,
        data: {
          assignment: updated[0]
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error updating application assignment:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to update application assignment'
      });
    }
  });

  /**
   * DELETE /api/admin/application-assignments/:assignmentId
   * Remove an application assignment
   */
  fastify.delete('/:assignmentId', {
    schema: {
      description: 'Remove an application assignment',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const assignmentId = params.assignmentId;

      // Verify assignment exists
      const existing = await db
        .select()
        .from(organizationApplications)
        .where(eq(organizationApplications.id, assignmentId))
        .limit(1);

      if (existing.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Assignment not found'
        });
      }

      // Delete assignment
      await db
        .delete(organizationApplications)
        .where(eq(organizationApplications.id, assignmentId));

      try {
        const actorId = ((request as any).user?.userId || (request as any).user?.id || 'system') as string;
        const tenantId = existing[0].tenantId;
        if (!tenantId) {
          request.log.warn({ assignmentId }, 'Skipping tenant application sync event: missing tenantId');
        } else {
          await publishTenantApplicationSyncEvent({
            tenantId,
            reason: 'assignment_removal',
            actorId,
          });
        }
      } catch (publishError: unknown) {
        request.log.warn({ err: publishError, assignmentId }, 'Failed to publish tenant application sync event');
      }

      return {
        success: true,
        data: {
          message: 'Application assignment removed successfully',
          removedAssignment: existing[0]
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error removing application assignment:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to remove application assignment'
      });
    }
  });

  /**
   * POST /api/admin/application-assignments/bulk-assign
   * Bulk assign applications to multiple tenants
   */
  fastify.post('/bulk-assign', {
    schema: {
      description: 'Bulk assign applications to multiple tenants',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const tenantIds = body.tenantIds ?? [];
      const appIds = body.appIds ?? [];
      const defaultConfig = body.defaultConfig ?? {};

      const [tenantsList, appsList] = await Promise.all([
        db.select().from(tenants).where(inArray(tenants.tenantId, tenantIds)),
        db.select().from(applications).where(inArray(applications.appId, appIds))
      ]);

      if (tenantsList.length !== tenantIds.length) {
        return reply.code(400).send({
          success: false,
          error: 'Some tenants not found'
        });
      }

      if (appsList.length !== appIds.length) {
        return reply.code(400).send({
          success: false,
          error: 'Some applications not found'
        });
      }

      // Check for existing assignments
      const existing = await db
        .select()
        .from(organizationApplications)
        .where(and(
          inArray(organizationApplications.tenantId, tenantIds),
          inArray(organizationApplications.appId, appIds)
        ));

      const existingMap = new Set(
        existing.map(e => `${e.tenantId}-${e.appId}`)
      );

      // Create assignments for non-existing combinations
      const assignments = [];
      for (const tenantId of tenantIds) {
        for (const appId of appIds) {
          const key = `${tenantId}-${appId}`;
          if (!existingMap.has(key)) {
            const enabledModules = defaultConfig.enabledModules ?? [];

            // Handle permissions: use customPermissions from config if provided, otherwise get default permissions
            let customPermissions: Record<string, any> = {};
            if (enabledModules.length > 0) {
              if (defaultConfig.customPermissions && Object.keys(defaultConfig.customPermissions as object).length > 0) {
                // Use the provided custom permissions
                customPermissions = (defaultConfig.customPermissions ?? {}) as Record<string, any>;
                console.log('Bulk assign: Using custom permissions:', customPermissions);
              } else {
                // Get default permissions for enabled modules
                const modulesData = await db
                  .select({
                    moduleCode: applicationModules.moduleCode,
                    permissions: applicationModules.permissions
                  })
                  .from(applicationModules)
                  .where(and(
                    eq(applicationModules.appId, appId),
                    inArray(applicationModules.moduleCode, enabledModules)
                  ));

                // Set default permissions for each enabled module
                modulesData.forEach(module => {
                  let parsedPermissions = [];
                  try {
                    if (module.permissions && typeof module.permissions === 'string') {
                      parsedPermissions = JSON.parse(module.permissions);
                    } else if (Array.isArray(module.permissions)) {
                      parsedPermissions = module.permissions;
                    }
                  } catch (err: unknown) {
      const error = err as Error;
                    console.warn(`Failed to parse permissions for module ${module.moduleCode}:`, error);
                    parsedPermissions = [];
                  }
                  customPermissions[module.moduleCode] = parsedPermissions;
                });
                console.log('Bulk assign: Using default permissions:', customPermissions);
              }
            }

            assignments.push({
              tenantId,
              appId,
              isEnabled: defaultConfig.isEnabled ?? true,
              subscriptionTier: defaultConfig.subscriptionTier ?? 'basic',
              enabledModules,
              customPermissions: Object.keys(customPermissions).length > 0 ? customPermissions : null,
              licenseCount: defaultConfig.licenseCount ?? 0,
              maxUsers: defaultConfig.maxUsers
            });
          }
        }
      }

      let created: any[] = [];
      if (assignments.length > 0) {
        created = await db
          .insert(organizationApplications)
          .values(assignments as any)
          .returning();
      }

      if (created.length > 0) {
        const actorId = ((request as any).user?.userId || (request as any).user?.id || 'system') as string;
        await Promise.allSettled(
          tenantIds.map((tenantId: string) =>
            publishTenantApplicationSyncEvent({
              tenantId,
              reason: 'bulk_assignment',
              actorId,
            })
          )
        );
      }

      return reply.send({
        success: true,
        data: {
          message: `Successfully assigned ${created.length} applications`,
          created: created.length,
          skipped: (tenantIds.length * appIds.length) - created.length,
          assignments: created
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error bulk assigning applications:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to bulk assign applications'
      });
    }
  });

  /**
   * GET /api/admin/application-assignments/applications
   * Get all available applications for assignment
   */
  fastify.get('/applications', {
    schema: {
      description: 'Get all available applications for assignment',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const includeModules = query.includeModules === true || query.includeModules === 'true';

      const apps = await db
        .select()
        .from(applications)
        .orderBy(applications.sortOrder, applications.appName);

      let appsWithDetails = apps;

      if (includeModules) {
        appsWithDetails = await Promise.all(
          apps.map(async (app) => {
            const modules = await db
              .select({
                moduleId: applicationModules.moduleId,
                moduleCode: applicationModules.moduleCode,
                moduleName: applicationModules.moduleName,
                description: applicationModules.description,
                isCore: applicationModules.isCore,
                permissions: applicationModules.permissions
              })
              .from(applicationModules)
              .where(eq(applicationModules.appId, app.appId))
              .orderBy(applicationModules.moduleName);

            // Parse permissions for each module
            const modulesWithParsedPermissions = modules.map(module => {
              let parsedPermissions = [];
              try {
                if (module.permissions && typeof module.permissions === 'string') {
                  parsedPermissions = JSON.parse(module.permissions);
                } else if (Array.isArray(module.permissions)) {
                  parsedPermissions = module.permissions;
                }
              } catch (err: unknown) {
      const error = err as Error;
                console.warn(`Failed to parse permissions for module ${module.moduleCode}:`, error);
                parsedPermissions = [];
              }

              return {
                ...module,
                permissions: parsedPermissions
              };
            });

            return {
              ...app,
              modules: modulesWithParsedPermissions
            };
          })
        );
      }

      return {
        success: true,
        data: {
          applications: appsWithDetails
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching applications:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch applications'
      });
    }
  });

  /**
   * POST /api/admin/application-assignments/assign-module
   * Assign a specific module to a tenant
   */
  fastify.post('/assign-module', {
    schema: {
      description: 'Assign a specific module to a tenant',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = (body.tenantId as string) ?? '';
      const moduleId = (body.moduleId as string) ?? '';

      // Verify tenant exists
      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return reply.code(404).send({ success: false, error: 'Tenant not found' });
      }

      // Verify module exists
      const module = await db
        .select({
          moduleId: applicationModules.moduleId,
          moduleCode: applicationModules.moduleCode,
          moduleName: applicationModules.moduleName,
          appId: applicationModules.appId,
          appCode: applications.appCode,
          appName: applications.appName,
          permissions: applicationModules.permissions // Add permissions field
        })
        .from(applicationModules)
        .innerJoin(applications, eq(applicationModules.appId, applications.appId))
        .where(eq(applicationModules.moduleId, moduleId))
        .limit(1);

      if (module.length === 0) {
        return reply.code(404).send({ success: false, error: 'Module not found' });
      }

      // Verify tenant and application exist before proceeding
      console.log(`🔍 Verifying tenant ${tenantId} and app ${module[0].appId} exist...`);

      const tenantExists = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenantExists.length === 0) {
        throw new Error(`Tenant ${tenantId} not found in database`);
      }

      const appExists = await (db as any)
        .select()
        .from(applications)
        .where(eq(applications.appId, module[0].appId ?? ''))
        .limit(1);

      if (appExists.length === 0) {
        throw new Error(`Application ${module[0].appId} not found in database`);
      }

      console.log(`✅ Tenant and application verified`);

      // Check if tenant already has this application assigned
      const existingAssignment = await (db as any)
        .select()
        .from(organizationApplications)
        .where(and(
          eq(organizationApplications.tenantId, tenantId),
          eq(organizationApplications.appId, module[0].appId ?? '')
        ))
        .limit(1);

      // Parse permissions from the module (declare outside if/else blocks)
      let modulePermissions = [];
      try {
        if (module[0].permissions && typeof module[0].permissions === 'string') {
          modulePermissions = JSON.parse(module[0].permissions);
        } else if (Array.isArray(module[0].permissions)) {
          modulePermissions = module[0].permissions;
        }
        console.log(`📋 Assigning module ${module[0].moduleCode} with ${modulePermissions.length} permissions:`, modulePermissions);
      } catch (err: unknown) {
      const error = err as Error;
        console.warn(`Failed to parse permissions for module ${module[0].moduleCode}:`, error);
        modulePermissions = [];
      }

      let assignmentId;

      if (existingAssignment.length > 0) {
        // Update existing assignment to add the module
        assignmentId = existingAssignment[0].id;
        const currentModules = Array.isArray(existingAssignment[0].enabledModules) ? existingAssignment[0].enabledModules : [];
        const updatedModules = [...new Set([...currentModules, module[0].moduleCode])];

        // Update custom permissions to include the new module's permissions
        const currentCustomPermissions = (existingAssignment[0].customPermissions as Record<string, any>) || {};

        // Only update permissions for the specific module being assigned
        // Don't merge with existing permissions from other modules
        const updatedCustomPermissions: Record<string, any> = {
          ...currentCustomPermissions
        };

        // Only add the new module's permissions if it doesn't already exist
        if (!updatedCustomPermissions[module[0].moduleCode]) {
          updatedCustomPermissions[module[0].moduleCode] = modulePermissions;
        }

        console.log(`🔄 Updating existing assignment ${assignmentId} with modules:`, updatedModules);
        console.log(`🔄 Updating custom permissions for module ${module[0].moduleCode}:`, modulePermissions);

        // Validate data before update
        if (!Array.isArray(updatedModules)) {
          throw new Error(`Invalid updatedModules: expected array, got ${typeof updatedModules}`);
        }
        if (typeof updatedCustomPermissions !== 'object' || updatedCustomPermissions === null) {
          throw new Error(`Invalid customPermissions: expected object, got ${typeof updatedCustomPermissions}`);
        }

        const updateResult = await db
          .update(organizationApplications)
          .set({
            enabledModules: updatedModules,
            customPermissions: updatedCustomPermissions,
            updatedAt: new Date()
          })
          .where(eq(organizationApplications.id, assignmentId))
          .returning();

        console.log(`✅ Update result:`, updateResult);
      } else {
        // Create new assignment with just this module and its permissions
        const customPermissions = {
          [module[0].moduleCode]: modulePermissions
        };

        console.log(`🆕 Creating new assignment for tenant ${tenantId} with app ${module[0].appId}`);
        console.log(`🆕 New assignment data:`, {
          tenantId,
          appId: module[0].appId,
          enabledModules: [module[0].moduleCode],
          customPermissions
        });

        // Validate data before insert
        if (!tenantId || typeof tenantId !== 'string') {
          throw new Error(`Invalid tenantId: ${tenantId}`);
        }
        if (!module[0].appId || typeof module[0].appId !== 'string') {
          throw new Error(`Invalid appId: ${module[0].appId}`);
        }
        if (!Array.isArray([module[0].moduleCode])) {
          throw new Error(`Invalid enabledModules: expected array`);
        }
        if (typeof customPermissions !== 'object' || customPermissions === null) {
          throw new Error(`Invalid customPermissions: expected object, got ${typeof customPermissions}`);
        }

        const newAssignment = await db
          .insert(organizationApplications)
          .values({
            tenantId,
            appId: module[0].appId,
            isEnabled: true,
            subscriptionTier: 'basic',
            enabledModules: [module[0].moduleCode],
            customPermissions,
            licenseCount: 1
          })
          .returning();

        assignmentId = newAssignment[0].id;
        console.log(`✅ New assignment created with ID: ${assignmentId}`);
      }

      console.log(`✅ Module ${module[0].moduleCode} assigned successfully to tenant ${tenantId} with ${modulePermissions.length} permissions`);

      try {
        const actorId = ((request as any).user?.userId || (request as any).user?.id || 'system') as string;
        await publishTenantApplicationSyncEvent({
          tenantId,
          reason: 'module_assignment',
          actorId,
        });
      } catch (publishError: unknown) {
        request.log.warn({ err: publishError, tenantId }, 'Failed to publish tenant application sync event');
      }

      return {
        success: true,
        data: {
          assignmentId,
          tenant: tenant[0],
          module: module[0],
          permissionsCount: modulePermissions.length
        }
      };
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      console.error('❌ Error assigning module:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', {
        message: error.message,
        code: (error as any).code,
        name: error.name
      });

      request.log.error(error, 'Error assigning module:');
      return reply.code(500).send({
        success: false,
        error: `Failed to assign module: ${error.message || 'Unknown error'}`
      });
    }
  });

  /**
   * PUT /api/admin/application-assignments/update-module-permissions
   * Update specific permissions for a module
   */
  fastify.put('/module-permissions', {
    schema: {
      description: 'Update specific permissions for a module assigned to a tenant',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const tenantId = body.tenantId;
      const moduleId = body.moduleId;
      const permissions = body.permissions;

      // Verify tenant exists
      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return reply.code(404).send({ success: false, error: 'Tenant not found' });
      }

      // Verify module exists
      const module = await db
        .select({
          moduleId: applicationModules.moduleId,
          moduleCode: applicationModules.moduleCode,
          appId: applicationModules.appId
        })
        .from(applicationModules)
        .where(eq(applicationModules.moduleId, moduleId))
        .limit(1);

      if (module.length === 0) {
        return reply.code(404).send({ success: false, error: 'Module not found' });
      }

      // Find and update the assignment
      const existingAssignment = await (db as any)
        .select()
        .from(organizationApplications)
        .where(and(
          eq(organizationApplications.tenantId, tenantId),
          eq(organizationApplications.appId, module[0].appId ?? '')
        ))
        .limit(1);

      if (existingAssignment.length === 0) {
        return reply.code(404).send({ success: false, error: 'Application assignment not found' });
      }

      // Update custom permissions for the specific module
      const currentCustomPermissions = existingAssignment[0].customPermissions || {};
      const updatedCustomPermissions = {
        ...currentCustomPermissions,
        [module[0].moduleCode]: permissions
      };

      console.log(`🔄 Updating permissions for module ${module[0].moduleCode} to:`, permissions);

      await db
        .update(organizationApplications)
        .set({
          customPermissions: updatedCustomPermissions,
          updatedAt: new Date()
        })
        .where(eq(organizationApplications.id, existingAssignment[0].id));

      try {
        const actorId = ((request as any).user?.userId || (request as any).user?.id || 'system') as string;
        await publishTenantApplicationSyncEvent({
          tenantId,
          reason: 'permission_update',
          actorId,
        });
      } catch (publishError: unknown) {
        request.log.warn({ err: publishError, tenantId }, 'Failed to publish tenant application sync event');
      }

      return {
        success: true,
        data: {
          tenantId,
          moduleCode: module[0].moduleCode,
          permissions: permissions,
          permissionsCount: permissions.length
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error updating module permissions:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to update module permissions'
      });
    }
  });

  /**
   * DELETE /api/admin/application-assignments/remove-module
   * Remove a specific module from a tenant
   */
  fastify.delete('/modules', {
    schema: {
      description: 'Remove a specific module from a tenant',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = (body.tenantId as string) ?? '';
      const moduleId = (body.moduleId as string) ?? '';

      // Get module information
      const module = await db
        .select({
          moduleId: applicationModules.moduleId,
          moduleCode: applicationModules.moduleCode,
          appId: applicationModules.appId
        })
        .from(applicationModules)
        .where(eq(applicationModules.moduleId, moduleId))
        .limit(1) as any;

      if (module.length === 0) {
        return reply.code(404).send({ success: false, error: 'Module not found' });
      }

      // Find and update the assignment
      const existingAssignment = await (db
        .select()
        .from(organizationApplications)
        .where(and(
          eq(organizationApplications.tenantId, tenantId),
          eq(organizationApplications.appId, module[0].appId)
        ))
        .limit(1)) as any;

      if (existingAssignment.length === 0) {
        return reply.code(404).send({ success: false, error: 'Application assignment not found' });
      }

      const currentModules = (existingAssignment[0] as any).enabledModules || [];
      const updatedModules = currentModules.filter((code: string) => code !== module[0].moduleCode);

      // Update custom permissions to remove the module's permissions
      const currentCustomPermissions = (existingAssignment[0].customPermissions as Record<string, unknown>) || {};
      const updatedCustomPermissions: Record<string, unknown> = { ...currentCustomPermissions };
      delete updatedCustomPermissions[module[0].moduleCode];

      if (updatedModules.length === 0) {
        // If no modules left, delete the entire assignment
        await db
          .delete(organizationApplications)
          .where(eq(organizationApplications.id, existingAssignment[0].id));
      } else {
        // Update assignment with remaining modules and permissions
        await db
          .update(organizationApplications)
          .set({
            enabledModules: updatedModules,
            customPermissions: Object.keys(updatedCustomPermissions).length > 0 ? updatedCustomPermissions : null,
            updatedAt: new Date()
          })
          .where(eq(organizationApplications.id, existingAssignment[0].id));
      }

      try {
        const actorId = ((request as any).user?.userId || (request as any).user?.id || 'system') as string;
        await publishTenantApplicationSyncEvent({
          tenantId,
          reason: updatedModules.length === 0 ? 'assignment_removal' : 'module_assignment',
          actorId,
        });
      } catch (publishError: unknown) {
        request.log.warn({ err: publishError, tenantId }, 'Failed to publish tenant application sync event');
      }

      return {
        success: true,
        data: {
          tenantId,
          moduleCode: module[0].moduleCode,
          remainingModules: updatedModules.length
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error removing module:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to remove module'
      });
    }
  });

  /**
   * GET /api/admin/application-assignments/tenant-modules/:tenantId
   * Get all modules assigned to a specific tenant
   */
  fastify.get('/tenant-modules/:tenantId', {
    schema: {
      description: 'Get all modules assigned to a specific tenant',
      tags: ['Admin', 'Application Assignment']
    },
    preHandler: requirePlatformPermission('org_assignments:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const tenantId = params.tenantId ?? '';

      // Verify tenant exists
      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return reply.code(404).send({ success: false, error: 'Tenant not found' });
      }

      // Get all assignments for this tenant
      const assignments = await db
        .select({
          id: organizationApplications.id,
          appId: organizationApplications.appId,
          appCode: applications.appCode,
          appName: applications.appName,
          isEnabled: organizationApplications.isEnabled,
          enabledModules: organizationApplications.enabledModules,
          subscriptionTier: organizationApplications.subscriptionTier
        })
        .from(organizationApplications)
        .innerJoin(applications, eq(organizationApplications.appId, applications.appId))
        .where(eq(organizationApplications.tenantId, tenantId));

      // Get detailed module information for each assignment
      const assignmentsWithModules = await Promise.all(
        assignments.map(async (assignment) => {
          const enabledModuleCodes = (assignment as any).enabledModules || [];

          const allModules = await (db as any)
            .select({
              moduleId: applicationModules.moduleId,
              moduleCode: applicationModules.moduleCode,
              moduleName: applicationModules.moduleName,
              description: applicationModules.description,
              isCore: applicationModules.isCore
            })
            .from(applicationModules)
            .where(eq(applicationModules.appId, assignment.appId ?? ''))
            .orderBy(applicationModules.moduleName);

          // Mark which modules are enabled
          const modulesWithStatus = allModules.map((mod: any) => ({
            ...mod,
            isEnabled: enabledModuleCodes.includes(mod.moduleCode)
          }));

          return {
            ...assignment,
            modules: modulesWithStatus
          };
        })
      );

      return {
        success: true,
        data: {
          tenant: tenant[0],
          assignments: assignmentsWithModules
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching tenant modules:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenant modules'
      });
    }
  });
}
