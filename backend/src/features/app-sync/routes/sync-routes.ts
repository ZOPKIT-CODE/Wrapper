import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { WrapperSyncService } from '../services/sync-service.js';
import { bootstrapService } from '../services/bootstrap-service.js';
import { db } from '../../../db/index.js';
import { applications, organizationApplications, tenantUsers, customRoles, entities, credits, creditTransactions, creditConfigurations, organizationMemberships } from '../../../db/schema/index.js';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import ErrorResponses from '../../../utils/error-responses.js';
import { BUSINESS_SUITE_MATRIX } from '../../../data/permission-matrix.js';
import { getAppSyncRepository } from '../adapters/postgres-app-sync-repository.js';

// Combined authentication middleware that accepts both Kinde tokens and service tokens
async function authenticateServiceOrToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    // Try service token validation first
    const authHeader = request.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Validate service token with strict secret handling
        const { verify } = await import('jsonwebtoken');
        const secret = process.env.SERVICE_TOKEN_SECRET || process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('SERVICE_TOKEN_SECRET or JWT_SECRET must be configured for service auth');
        }
        const allowedServiceNames = (process.env.ALLOWED_SERVICE_TOKENS || 'crm,accounting,ops,wrapper')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const decoded = verify(token, secret) as Record<string, unknown>;

        if ((decoded as any).type === 'service_token' && allowedServiceNames.includes(String((decoded as any).service || ''))) {
          (request as any).serviceAuth = decoded;
          return; // Service token is valid
        }
      } catch (_serviceTokenError) {
        // Not a valid service token, try regular Kinde authentication
      }
    }

    // Fall back to regular Kinde authentication
    await authenticateToken(request, reply);
  } catch (err: unknown) {
    const error = err as Error;
    console.log('❌ Service/Kinde authentication failed');
    throw error;
  }
}

/**
 * Guard: when a Kinde user (not a service token) calls a sync route, they can only
 * access their own tenant. Service tokens (M2M) may access any tenant.
 */
function assertTenantAccess(request: FastifyRequest, reply: FastifyReply, resolvedTenantId: string): boolean {
  const isServiceAuth = !!(request as any).serviceAuth;
  if (isServiceAuth) return true; // M2M — allowed to access any tenant
  const jwtTenantId = (request as any).userContext?.tenantId;
  if (jwtTenantId && jwtTenantId !== resolvedTenantId) {
    reply.code(403).send({
      success: false,
      error: 'Forbidden',
      message: 'You can only access data for your own tenant'
    });
    return false;
  }
  return true;
}

/**
 * Wrapper CRM Data Synchronization Routes
 * Provides endpoints for CRM to sync tenant data from Wrapper
 */
export default async function wrapperCrmSyncRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  const appSyncRepository = getAppSyncRepository();

  // ===============================
  // SYNC MANAGEMENT ENDPOINTS
  // ===============================

  // Trigger full tenant data synchronization
  fastify.post('/tenants/:tenantId/sync', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Trigger full tenant data synchronization for CRM'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const resolvedTenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!resolvedTenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, resolvedTenantId)) return;
      const tenantId = resolvedTenantId;
      const skipReferenceData = query.skipReferenceData === 'true';
      const forceSync = query.forceSync === 'true';

      const userContext = (request as any).userContext;
      console.log(`🔄 Triggering tenant sync for ${tenantId}`, {
        skipReferenceData,
        forceSync,
        requestedBy: userContext?.email ?? ''
      });

      const result = await (WrapperSyncService as any).triggerTenantSync(tenantId, {
        skipReferenceData,
        forceSync,
        requestedBy: userContext?.internalUserId ?? ''
      });

      return {
        success: true,
        message: 'Tenant data sync completed successfully',
        results: result
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error triggering tenant sync:', error);
      return reply.code(500).send({
        success: false,
        error: 'Sync failed',
        message: error.message
      });
    }
  });

  // Get sync status for tenant
  fastify.get('/tenants/:tenantId/sync/status', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get tenant sync status'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;

      const status = await (WrapperSyncService as any).getSyncStatus(tenantId);

      return {
        success: true,
        tenantId,
        status: status
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error getting sync status:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get sync status',
        message: error.message
      });
    }
  });

  // Get data requirements specification
  fastify.get('/data-requirements', {
    schema: {
      description: 'Get complete data requirements specification for CRM integration'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const requirements = (WrapperSyncService as any).getDataRequirements();

      return {
        success: true,
        data: requirements
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error getting data requirements:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get data requirements',
        message: error.message
      });
    }
  });

  // ===============================
  // TENANT DATA ENDPOINTS
  // ===============================

  // Get basic tenant information
  fastify.get('/tenants/:tenantId', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get basic tenant information for CRM'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const resolvedTenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!resolvedTenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, resolvedTenantId)) return;

      const tenant = await appSyncRepository.getBasicTenantById(resolvedTenantId);

      if (!tenant) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      return {
        success: true,
        data: {
          tenantId: tenant.tenantId,
          tenantName: tenant.companyName,
          status: tenant.isActive ? 'active' : 'inactive',
          settings: {},
          subscription: {},
          organization: {
            orgCode: tenant.tenantId,
            orgName: tenant.companyName
          }
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching tenant:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenant',
        message: error.message
      });
    }
  });

  // Get user profiles for tenant
  fastify.get('/tenants/:tenantId/users', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get user profiles for tenant (CRM format)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;
      const entityId = query.entityId ?? '';
      const includeInactive = query.includeInactive === 'true';
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const offset = (page - 1) * limit;

      // Build query conditions
      const conditions = [eq(tenantUsers.tenantId, tenantId)];
      if (entityId && (tenantUsers as any).entityId) {
        conditions.push(eq((tenantUsers as any).entityId, entityId));
      }
      if (!includeInactive) {
        conditions.push(eq(tenantUsers.isActive, true));
      }

      // Get user profiles - only select fields that exist in database (include kindeUserId for Operations sync: UUID→kinde map for role assignments)
      const users = await db
        .select({
          userId: tenantUsers.userId,
          kindeUserId: tenantUsers.kindeUserId,
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          isActive: tenantUsers.isActive,
          tenantId: tenantUsers.tenantId,
          createdAt: tenantUsers.createdAt,
          updatedAt: tenantUsers.updatedAt
        })
        .from(tenantUsers)
        .where(and(...conditions))
        .orderBy(tenantUsers.createdAt)
        .limit(limit)
        .offset(offset);

      // Transform to CRM format
      const transformedUsers = users.map(user => {
        return {
          userId: user.userId,
          kindeId: user.kindeUserId ?? null,
          employeeCode: user.userId, // Use userId as employee code for now
          personalInfo: {
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || ''
          },
          organization: {
            orgCode: tenantId, // Default to tenant ID
            department: '', // Not available in current schema
            designation: ''  // Not available in current schema
          },
          status: {
            isActive: user.isActive !== null ? user.isActive : true,
            lastActivityAt: null // Not available in current schema
          },
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
      });

      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(tenantUsers)
        .where(and(...conditions)) as any[];
      const count = Number((countResult[0] as any)?.count ?? 0);

      return {
        success: true,
        data: transformedUsers,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching tenant users:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch users',
        message: error.message
      });
    }
  });

  // Get organizations for tenant
  fastify.get('/tenants/:tenantId/organizations', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get organizations for tenant (CRM format)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;
      const includeInactive = query.includeInactive === 'true';
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const offset = (page - 1) * limit;

      // Build query conditions
      const conditions = [eq(entities.tenantId, tenantId)];
      if (!includeInactive) {
        conditions.push(eq(entities.isActive, true));
      }

      // entity_code was dropped in migration 0015 — use entityId as the stable org code.
      const rawOrgs = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          parentEntityId: entities.parentEntityId,
          entityLevel: entities.entityLevel,
          isActive: entities.isActive,
          description: entities.description,
          entityType: entities.entityType,
          createdAt: entities.createdAt,
          updatedAt: entities.updatedAt,
        })
        .from(entities)
        .where(and(...conditions))
        .orderBy(entities.entityLevel, entities.entityName)
        .limit(limit)
        .offset(offset);

      // parentId resolves to parentEntityId UUID (entity_code dropped, entityId is the stable key)
      const parentIds = [...new Set(rawOrgs.map((r: any) => r.parentEntityId).filter(Boolean))];
      const parentCodeMap = new Map<string, string>();
      if (parentIds.length > 0) {
        const parents = await db
          .select({ entityId: entities.entityId })
          .from(entities)
          .where(and(eq(entities.tenantId, tenantId), inArray(entities.entityId, parentIds)));
        for (const p of parents) {
          parentCodeMap.set(p.entityId, p.entityId);
        }
      }

      const organizations = rawOrgs.map((r: any) => ({
        orgCode: r.entityId as string,
        entityId: r.entityId,
        orgName: r.entityName ?? '',
        parentId: r.parentEntityId ? (parentCodeMap.get(r.parentEntityId) ?? r.parentEntityId) : null,
        status: r.isActive ? 'active' : 'inactive',
        hierarchy: {
          level: r.entityLevel ?? 0,
          path: null,
          children: [],
        },
        metadata: {
          description: r.description ?? null,
          type: r.entityType ?? null,
          createdAt: r.createdAt ?? null,
          updatedAt: r.updatedAt ?? null,
        },
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(entities)
        .where(and(...conditions)) as any[];
      const count = Number((countResult[0] as any)?.count ?? 0);

      return {
        success: true,
        data: organizations,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching tenant organizations:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch organizations',
        message: error.message
      });
    }
  });

  // Get detailed tenant users information
  fastify.get('/tenants/:tenantId/tenant-users', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get detailed tenant users information for CRM'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;
      const includeInactive = query.includeInactive === 'true';
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const offset = (page - 1) * limit;

      // Build query conditions
      const conditions = [eq(tenantUsers.tenantId, tenantId)];
      if (!includeInactive) {
        conditions.push(eq(tenantUsers.isActive, true));
      }

      const tenantUsersData = await db
        .select({
          userId: tenantUsers.userId,
          tenantId: tenantUsers.tenantId,
          kindeId: tenantUsers.kindeUserId,
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          isResponsiblePerson: tenantUsers.isTenantAdmin,
          isTenantAdmin: tenantUsers.isTenantAdmin,
          onboardingCompleted: tenantUsers.onboardingCompleted,
          isActive: tenantUsers.isActive,
          createdAt: tenantUsers.createdAt,
          updatedAt: tenantUsers.updatedAt
        })
        .from(tenantUsers)
        .where(and(...conditions))
        .orderBy(tenantUsers.createdAt)
        .limit(limit)
        .offset(offset);

      // Transform to CRM format
      const transformedTenantUsers = tenantUsersData.map(user => {
        return {
          userId: user.userId,
          tenantId: user.tenantId,
          kindeId: user.kindeId,
          email: user.email || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          primaryOrganizationId: tenantId, // Default to tenant ID
          isResponsiblePerson: (user as any).isResponsiblePerson || false,
          isTenantAdmin: user.isTenantAdmin || false,
          isVerified: false,
          onboardingCompleted: user.onboardingCompleted || false,
          preferences: {},
          profile: {
            employeeCode: user.userId
          },
          security: {
            isActive: user.isActive !== null ? user.isActive : true
          },
          metadata: {},
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
      });

      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(tenantUsers)
        .where(and(...conditions)) as any[];
      const count = Number((countResult[0] as any)?.count ?? 0);

      return {
        success: true,
        data: transformedTenantUsers,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching detailed tenant users:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenant users',
        message: error.message
      });
    }
  });

  // Get role definitions for tenant, optionally filtered by application
  // Pass ?appCode=operations to get only roles with operations.* permissions
  fastify.get('/tenants/:tenantId/roles', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get role definitions for tenant, optionally filtered to a specific application'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const appCode = query.appCode ? String(query.appCode).trim() : null;
      const offset = (page - 1) * limit;

      const conditions = [eq(customRoles.tenantId, tenantId)];

      const roles = await db
        .select({
          roleId: customRoles.roleId,
          roleName: customRoles.roleName,
          permissions: customRoles.permissions,
          priority: customRoles.priority,
          isActive: sql`true`,
          description: customRoles.description,
          tenantId: customRoles.tenantId,
          createdAt: customRoles.createdAt,
          updatedAt: customRoles.updatedAt
        })
        .from(customRoles)
        .where(and(...conditions))
        .orderBy(customRoles.priority, customRoles.roleName)
        .limit(limit)
        .offset(offset);

      const transformedRoles = roles.map(role => {
        const flatPermissions: string[] = [];

        if (role.permissions) {
          let permissionsObj: Record<string, unknown> = role.permissions as Record<string, unknown>;

          if (typeof role.permissions === 'string') {
            try {
              permissionsObj = JSON.parse(role.permissions) as Record<string, unknown>;
            } catch (_e) {
              console.log('Failed to parse permissions JSON for role:', role.roleName, role.permissions);
              permissionsObj = {};
            }
          }

          if (permissionsObj && typeof permissionsObj === 'object') {
            if (appCode) {
              const appPerms = (permissionsObj as any)[appCode];
              if (appPerms && typeof appPerms === 'object') {
                Object.entries(appPerms).forEach(([resource, actions]) => {
                  if (Array.isArray(actions)) {
                    (actions as string[]).forEach(action => {
                      flatPermissions.push(`${appCode}.${resource}.${action}`);
                    });
                  }
                });
              }
            } else {
              Object.entries(permissionsObj).forEach(([module, modulePermissions]) => {
                if (modulePermissions && typeof modulePermissions === 'object') {
                  Object.entries(modulePermissions as Record<string, unknown>).forEach(([resource, actions]) => {
                    if (Array.isArray(actions)) {
                      (actions as string[]).forEach(action => {
                        flatPermissions.push(`${module}.${resource}.${action}`);
                      });
                    }
                  });
                }
              });
            }
          }
        }

        return {
          roleId: role.roleId,
          roleName: role.roleName || '',
          permissions: flatPermissions,
          priority: role.priority || 0,
          isActive: role.isActive,
          description: role.description || '',
          tenantId: role.tenantId,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt
        };
      }).filter(role => appCode ? role.permissions.length > 0 : true);

      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(customRoles)
        .where(and(...conditions)) as any[];
      const count = Number((countResult[0] as any)?.count ?? 0);

      return {
        success: true,
        data: transformedRoles,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching tenant roles:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch roles',
        message: error.message
      });
    }
  });

  // Get credit configurations for tenant, scoped to a specific application
  // Defaults to 'crm' for backward compat; pass ?appCode=operations for Ops-specific configs
  fastify.get('/tenants/:tenantId/credit-configs', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get credit configurations for tenant scoped by application (tenant-specific takes precedence over global)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;

      const appCode = (query.appCode ?? 'crm').toString().trim();

      // Get existing configurations for this tenant scoped to the requested app
      const existingConfigs = await db
        .select({
          configId: creditConfigurations.configId,
          tenantId: creditConfigurations.tenantId,
          operationCode: creditConfigurations.operationCode,
          operationName: creditConfigurations.operationName,
          creditCost: creditConfigurations.creditCost,
          unit: creditConfigurations.unit,
          isGlobal: creditConfigurations.isGlobal,
          isActive: creditConfigurations.isActive
        })
        .from(creditConfigurations)
        .where(and(
          or(
            eq(creditConfigurations.tenantId, tenantId),
            eq(creditConfigurations.isGlobal, true)
          ),
          eq(creditConfigurations.isActive, true),
          sql`${creditConfigurations.operationCode} LIKE ${appCode + '.%'}`
        ));

      const configMap = new Map<string, any>();

      existingConfigs.forEach(config => {
        if (config.isGlobal) {
          configMap.set(config.operationCode, { ...config, source: 'global' });
        }
      });

      existingConfigs.forEach(config => {
        if (!config.isGlobal) {
          configMap.set(config.operationCode, { ...config, source: 'tenant' });
        }
      });

      const appMatrix = (BUSINESS_SUITE_MATRIX as any)[appCode];
      const appConfigs: any[] = [];

      if (appMatrix && appMatrix.modules) {
        Object.entries(appMatrix.modules).forEach(([moduleKey, moduleDataUnknown]) => {
          const moduleData = moduleDataUnknown as any;
          if (moduleData.permissions && Array.isArray(moduleData.permissions)) {
            moduleData.permissions.forEach((permission: any) => {
              const operationCode = `${appCode}.${moduleKey}.${permission.code}`;

              const existingConfig = configMap.get(operationCode);

              if (existingConfig) {
                appConfigs.push({
                  configId: existingConfig.configId,
                  tenantId: existingConfig.tenantId,
                  entityId: existingConfig.isGlobal ? null : tenantId,
                  configName: existingConfig.operationName || `${moduleData.moduleName} - ${permission.name}`,
                  operationCode: operationCode,
                  description: existingConfig.operationName || permission.description,
                  creditCost: parseFloat(existingConfig.creditCost || 0),
                  unit: existingConfig.unit || 'operation',
                  isGlobal: existingConfig.isGlobal,
                  source: existingConfig.source,
                  moduleName: moduleData.moduleName,
                  permissionName: permission.name
                });
              } else {
                appConfigs.push({
                  configId: null,
                  tenantId: tenantId,
                  entityId: null,
                  configName: `${moduleData.moduleName} - ${permission.name}`,
                  operationCode: operationCode,
                  description: permission.description,
                  creditCost: 0,
                  unit: 'operation',
                  isGlobal: true,
                  source: 'default',
                  moduleName: moduleData.moduleName,
                  permissionName: permission.name
                });
              }
            });
          }
        });
      }

      appConfigs.sort((a, b) => a.operationCode.localeCompare(b.operationCode));

      return {
        success: true,
        data: appConfigs,
        summary: {
          totalOperations: appConfigs.length,
          tenantSpecific: appConfigs.filter(c => c.source === 'tenant').length,
          global: appConfigs.filter(c => c.source === 'global').length,
          default: appConfigs.filter(c => c.source === 'default').length,
          modules: Object.keys((appMatrix as any)?.modules || {}).length,
          appCode
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching credit configurations:', error);
      const params = request.params as Record<string, string>;
      const tenantId = params.tenantId ?? '';
      return {
        success: true,
        data: [{
          configId: `default_${tenantId}`,
          tenantId: tenantId,
          entityId: tenantId,
          configName: 'Default Credit Configuration',
          creditLimit: 1000,
          resetPeriod: 'monthly',
          resetDay: 1,
          lastResetAt: null,
          isActive: true,
          metadata: {
            description: 'Default credit configuration for tenant',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1
        }
      };
    }
  });

  // Global-only credit configurations for a specific application
  // Returns the complete matrix of operations with DB overrides where they exist.
  // appCode is required to prevent accidental cross-app data leaks.
  fastify.get('/credit-configs/global', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get global credit configurations for a specific application (no tenant-specific overrides)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    try {
      const appCode = (query.appCode ?? '').toString().trim();
      if (!appCode) {
        return reply.code(400).send({ success: false, error: 'appCode query parameter is required' });
      }

      const appMatrix = (BUSINESS_SUITE_MATRIX as any)[appCode];
      if (!appMatrix || !appMatrix.modules) {
        return reply.code(400).send({ success: false, error: `Unknown appCode: ${appCode}` });
      }

      const globalConfigs = await db
        .select({
          configId: creditConfigurations.configId,
          operationCode: creditConfigurations.operationCode,
          operationName: creditConfigurations.operationName,
          creditCost: creditConfigurations.creditCost,
          unit: creditConfigurations.unit,
          isActive: creditConfigurations.isActive
        })
        .from(creditConfigurations)
        .where(and(
          eq(creditConfigurations.isGlobal, true),
          eq(creditConfigurations.isActive, true),
          sql`${creditConfigurations.operationCode} LIKE ${appCode + '.%'}`
        ));

      const configMap = new Map<string, any>();
      globalConfigs.forEach(config => {
        configMap.set(config.operationCode, config);
      });

      const appConfigs: any[] = [];
      Object.entries(appMatrix.modules).forEach(([moduleKey, moduleDataUnknown]) => {
        const moduleData = moduleDataUnknown as any;
        if (moduleData.permissions && Array.isArray(moduleData.permissions)) {
          moduleData.permissions.forEach((permission: any) => {
            const operationCode = `${appCode}.${moduleKey}.${permission.code}`;
            const existing = configMap.get(operationCode);

            if (existing) {
              appConfigs.push({
                configId: existing.configId,
                tenantId: null,
                entityId: null,
                configName: existing.operationName || `${moduleData.moduleName} - ${permission.name}`,
                operationCode,
                description: existing.operationName || permission.description,
                creditCost: parseFloat(existing.creditCost || 0),
                unit: existing.unit || 'operation',
                isGlobal: true,
                source: 'global',
                moduleName: moduleData.moduleName,
                permissionName: permission.name
              });
            } else {
              appConfigs.push({
                configId: null,
                tenantId: null,
                entityId: null,
                configName: `${moduleData.moduleName} - ${permission.name}`,
                operationCode,
                description: permission.description,
                creditCost: 0,
                unit: 'operation',
                isGlobal: true,
                source: 'default',
                moduleName: moduleData.moduleName,
                permissionName: permission.name
              });
            }
          });
        }
      });

      appConfigs.sort((a, b) => a.operationCode.localeCompare(b.operationCode));

      return {
        success: true,
        data: appConfigs,
        summary: {
          totalOperations: appConfigs.length,
          withDbConfig: appConfigs.filter(c => c.source === 'global').length,
          defaults: appConfigs.filter(c => c.source === 'default').length,
          modules: Object.keys(appMatrix.modules).length,
          appCode
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching global credit configurations:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch global credit configurations',
        message: error.message
      });
    }
  });

  // Tenant-specific credit configurations for a specific application
  // Returns ONLY configs that the tenant has explicitly overridden (no global defaults).
  // If a tenant has no overrides, the response data is an empty array.
  fastify.get('/tenants/:tenantId/credit-configs/tenant-specific', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get tenant-specific credit configuration overrides for a specific application (no global/default configs)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;

      const appCode = (query.appCode ?? '').toString().trim();
      if (!appCode) {
        return reply.code(400).send({ success: false, error: 'appCode query parameter is required' });
      }

      const appMatrix = (BUSINESS_SUITE_MATRIX as any)[appCode];
      const moduleMap = new Map<string, any>();
      if (appMatrix && appMatrix.modules) {
        Object.entries(appMatrix.modules).forEach(([moduleKey, moduleDataUnknown]) => {
          const moduleData = moduleDataUnknown as any;
          if (moduleData.permissions && Array.isArray(moduleData.permissions)) {
            moduleData.permissions.forEach((permission: any) => {
              moduleMap.set(`${appCode}.${moduleKey}.${permission.code}`, {
                moduleName: moduleData.moduleName,
                permissionName: permission.name,
                description: permission.description
              });
            });
          }
        });
      }

      const tenantConfigs = await db
        .select({
          configId: creditConfigurations.configId,
          tenantId: creditConfigurations.tenantId,
          operationCode: creditConfigurations.operationCode,
          operationName: creditConfigurations.operationName,
          creditCost: creditConfigurations.creditCost,
          unit: creditConfigurations.unit,
          isActive: creditConfigurations.isActive
        })
        .from(creditConfigurations)
        .where(and(
          eq(creditConfigurations.tenantId, tenantId),
          eq(creditConfigurations.isGlobal, false),
          eq(creditConfigurations.isActive, true),
          sql`${creditConfigurations.operationCode} LIKE ${appCode + '.%'}`
        ));

      const appConfigs = tenantConfigs.map(config => {
        const matrixInfo = moduleMap.get(config.operationCode);
        return {
          configId: config.configId,
          tenantId: config.tenantId,
          entityId: tenantId,
          configName: config.operationName || matrixInfo?.moduleName
            ? `${matrixInfo?.moduleName || 'Unknown'} - ${matrixInfo?.permissionName || config.operationCode}`
            : config.operationCode,
          operationCode: config.operationCode,
          description: config.operationName || matrixInfo?.description || '',
          creditCost: parseFloat(String(config.creditCost ?? 0)),
          unit: config.unit || 'operation',
          isGlobal: false,
          source: 'tenant',
          moduleName: matrixInfo?.moduleName || null,
          permissionName: matrixInfo?.permissionName || null
        };
      });

      appConfigs.sort((a, b) => a.operationCode.localeCompare(b.operationCode));

      return {
        success: true,
        data: appConfigs,
        summary: {
          totalOverrides: appConfigs.length,
          appCode,
          tenantId
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching tenant-specific credit configurations:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenant-specific credit configurations',
        message: error.message
      });
    }
  });

  // Get credit allocations for tenant entities, scoped by application
  // Defaults to 'crm' for backward compat; pass ?appCode=operations for Ops
  fastify.get('/tenants/:tenantId/entity-credits', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get credit allocations for tenant entities scoped by application'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;
      const entityId = query.entityId ?? '';
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const appCode = (query.appCode ?? 'crm').toString().trim();
      const offset = (page - 1) * limit;
      const allocationOpCode = `application_allocation:${appCode}`;

      const creditConditions = [eq(credits.tenantId, tenantId)];
      if (entityId) creditConditions.push(eq(credits.entityId, entityId));

      const entityCreditsData = await db
        .select({
          tenantId: credits.tenantId,
          entityId: credits.entityId,
          isActive: credits.isActive
        })
        .from(credits)
        .where(and(...creditConditions))
        .limit(limit)
        .offset(offset);

      const entityIds = entityCreditsData
        .map(c => c.entityId)
        .filter((id): id is string => Boolean(id));

      const allocationMap: Record<string, number> = {};
      // usageMap removed — apps track their own consumption

      if (entityIds.length > 0) {
        const allocations = await db
          .select({
            entityId: creditTransactions.entityId,
            totalAllocated: sql`COALESCE(SUM(${creditTransactions.amount}), 0)`
          })
          .from(creditTransactions)
          .where(and(
            eq(creditTransactions.tenantId, tenantId),
            eq(creditTransactions.operationCode, allocationOpCode),
            sql`${creditTransactions.entityId} IN (${sql.join(entityIds.map(id => sql`${id}::uuid`), sql`, `)})`
          ))
          .groupBy(creditTransactions.entityId) as any[];

        for (const row of allocations) {
          const eid = (row as any).entityId ?? '';
          if (eid) allocationMap[eid] = parseFloat(String((row as any).totalAllocated ?? 0));
        }

        // NOTE: usedCredits is NOT tracked by Wrapper — each app maintains its own
        // consumption ledger. Wrapper only knows how much was allocated to each app.
      }

      const entityCredits = entityCreditsData.map(credit => {
        const allocated = allocationMap[credit.entityId ?? ''] ?? 0;
        return {
          tenantId: credit.tenantId,
          entityId: credit.entityId,
          allocatedCredits: allocated,
          targetApplication: appCode,
          usedCredits: 0,                    // Apps track their own usage
          availableCredits: allocated,       // = allocated (from Wrapper's perspective)
          allocationType: 'organization',
          allocationPurpose: 'Organization credit balance',
          expiresAt: null,
          isActive: credit.isActive,
          allocationSource: 'system',
          allocatedBy: 'system',
          allocatedAt: new Date(),
          metadata: {}
        };
      });

      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(credits)
        .where(and(...creditConditions)) as any[];
      const count = Number((countResult[0] as any)?.count ?? 0);

      return {
        success: true,
        data: entityCredits,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching entity credits:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch entity credits',
        message: error.message
      });
    }
  });

  // Get employee organization assignments for tenant
  fastify.get('/tenants/:tenantId/employee-assignments', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get employee organization assignments for tenant (CRM format)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      console.log('🔐 Received token:', request.headers.authorization);

      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;
      const userId = query.userId ?? '';
      const entityId = query.entityId ?? '';
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const offset = (page - 1) * limit;

      // Build conditions for organization memberships
      let conditions = [
        eq(organizationMemberships.tenantId, tenantId),
        eq(organizationMemberships.membershipStatus, 'active')
      ];

      if (userId) {
        conditions.push(eq(organizationMemberships.userId, userId));
      }
      if (entityId) {
        conditions.push(eq(organizationMemberships.entityId, entityId));
      }

      // Get organization memberships with user and entity details
      const memberships = await db
        .select({
          membershipId: organizationMemberships.membershipId,
          userId: organizationMemberships.userId,
          tenantId: organizationMemberships.tenantId,
          entityId: organizationMemberships.entityId,
          membershipType: organizationMemberships.membershipType,
          membershipStatus: organizationMemberships.membershipStatus,
          accessLevel: organizationMemberships.accessLevel,
          isPrimary: organizationMemberships.isPrimary,
          assignedAt: organizationMemberships.createdAt,
          createdBy: organizationMemberships.createdBy,
          // User details
          userEmail: tenantUsers.email,
          userName: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.email})`,
          userIsActive: tenantUsers.isActive,
          // Entity details
          entityName: entities.entityName,
        })
        .from(organizationMemberships)
        .innerJoin(tenantUsers, eq(organizationMemberships.userId, tenantUsers.userId))
        .innerJoin(entities, eq(organizationMemberships.entityId, entities.entityId))
        .where(and(...conditions))
        .orderBy(organizationMemberships.createdAt)
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const totalResult = await db
        .select({ count: sql`count(*)` })
        .from(organizationMemberships)
        .where(and(...conditions)) as any[];

      const total = Number((totalResult[0] as any)?.count ?? 0);
      const totalPages = Math.ceil(total / limit);

      // Transform to CRM format
      const transformedAssignments = memberships.map(membership => ({
        assignmentId: membership.membershipId, // Use actual membership UUID
        tenantId: membership.tenantId,
        userId: membership.userId,
        entityId: membership.entityId,
        assignmentType: membership.membershipType || 'primary',
        isActive: membership.membershipStatus === 'active' && membership.userIsActive,
        assignedAt: membership.assignedAt?.toISOString(),
        expiresAt: null,
        assignedBy: membership.createdBy,
        deactivatedAt: null,
        deactivatedBy: null,
        priority: membership.isPrimary ? 1 : 2,
        metadata: {
          department: '',
          designation: '',
          employeeCode: membership.userId,
          organizationName: membership.entityName,
          organizationCode: membership.entityId,
          accessLevel: membership.accessLevel
        }
      }));

      return {
        success: true,
        data: transformedAssignments,
        pagination: {
          page,
          limit,
          total: String(total),
          totalPages
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching employee assignments:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch employee assignments',
        message: error.message
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // BFF BOOTSTRAP ENDPOINT
  // POST /tenants/:tenantId/bootstrap
  //
  // Returns a single, consistent, app-scoped snapshot of all tenant data
  // required for a downstream app's first-time bootstrap. All DB reads are
  // wrapped in one READ COMMITTED transaction on Wrapper's Postgres, so FA
  // receives a coherent cross-collection view with no races between calls.
  //
  // This is the ONLY place FA calls during bootstrap. The individual
  // /tenants/:id/users, /roles, etc. endpoints still exist and are still
  // used by UI and other direct consumers — we do NOT remove or bypass them.
  //
  // Why POST not GET:
  //   • Bootstrap is a stateful operation (transitions tenant_sync_status)
  //   • POST signals intent to consume/process, not just observe
  //   • We include body params (appCode, requestedBy) without URL pollution
  // ════════════════════════════════════════════════════════════════════════
  fastify.post('/tenants/:tenantId/bootstrap', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'BFF: Assemble and return a full, app-scoped bootstrap payload in one atomic read',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const body   = (request.body ?? {}) as Record<string, unknown>;
    const query  = request.query  as Record<string, string>;

    const rawTenantId = params.tenantId;
    // appCode can come from body OR query string (?appCode=accounting)
    const appCode     = String(body.appCode ?? query.appCode ?? 'accounting').trim().toLowerCase();
    const requestedBy = String(body.requestedBy ?? (request as any).serviceAuth?.service ?? 'unknown');

    if (!rawTenantId) {
      return reply.code(400).send({ success: false, error: 'tenantId is required' });
    }

    // Validate appCode is a known application
    const knownApp = await db
      .select({ appCode: applications.appCode, appName: applications.appName })
      .from(applications)
      .where(and(eq(applications.appCode, appCode), eq(applications.status, 'active')))
      .limit(1);

    if (!knownApp.length) {
      return reply.code(400).send({
        success: false,
        error:   `Unknown or inactive appCode: ${appCode}`,
        hint:    'Valid values: crm, accounting, hr, ops (must exist in applications table)',
      });
    }

    // Resolve tenantId (accept UUID or kindeOrgId)
    const resolvedTenantId = await appSyncRepository.resolveTenantId(rawTenantId);
    if (!resolvedTenantId) {
      return reply.code(404).send({ success: false, error: 'Tenant not found' });
    }
    if (!assertTenantAccess(request, reply, resolvedTenantId)) return;

    // Verify tenant has access to this app (entitlement gate on Wrapper side)
    const entitlement = await db
      .select({
        isEnabled:        organizationApplications.isEnabled,
        subscriptionTier: organizationApplications.subscriptionTier,
        enabledModules:   organizationApplications.enabledModules,
        expiresAt:        organizationApplications.expiresAt,
      })
      .from(organizationApplications)
      .innerJoin(applications, eq(applications.appId, organizationApplications.appId))
      .where(and(
        eq(organizationApplications.tenantId, resolvedTenantId),
        eq(applications.appCode, appCode),
      ))
      .limit(1);

    if (!entitlement.length || !entitlement[0].isEnabled) {
      return reply.code(403).send({
        success: false,
        error:   'ENTITLEMENT_DENIED',
        message: `Tenant ${resolvedTenantId} does not have access to app: ${appCode}`,
        hint:    'Check organization_applications table or tenant plan configuration',
      });
    }

    const ent = entitlement[0];
    const isExpired = ent.expiresAt && new Date(ent.expiresAt) < new Date();
    if (isExpired) {
      return reply.code(403).send({
        success: false,
        error:   'ENTITLEMENT_EXPIRED',
        message: `Tenant access to ${appCode} expired at ${ent.expiresAt}`,
      });
    }

    // Assemble the payload via BootstrapService (single DB transaction)
    try {
      console.log(`🚀 [Bootstrap] Assembling payload — tenant:${resolvedTenantId} app:${appCode} by:${requestedBy}`);

      const payload = await bootstrapService.assemble(resolvedTenantId, appCode);

      return reply.send({
        success: true,
        appCode,
        tenantId:         resolvedTenantId,
        snapshotAt:       payload.snapshotAt,
        subscriptionTier: ent.subscriptionTier ?? null,
        enabledModules:   ent.enabledModules   ?? [],
        data: {
          tenant:               payload.tenant,
          organizations:        payload.organizations,
          users:                payload.users,
          roles:                payload.roles,
          employeeAssignments:  payload.employeeAssignments,
          roleAssignments:      payload.roleAssignments,
          creditConfigs:        payload.creditConfigs,
          entityCredits:        payload.entityCredits,
        },
        recordCounts: payload.recordCounts,
        // warnings are non-fatal: FA should log them but still complete bootstrap
        warnings: payload.warnings,
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ [Bootstrap] Assembly failed:', error.message, { resolvedTenantId, appCode });
      return reply.code(500).send({
        success: false,
        error:   'Bootstrap assembly failed',
        message: error.message,
      });
    }
  });

  // Get role assignments for tenant
  fastify.get('/tenants/:tenantId/role-assignments', {
    preHandler: [authenticateServiceOrToken],
    schema: {
      description: 'Get role assignments for tenant (CRM format)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const tenantId = await appSyncRepository.resolveTenantId(params.tenantId);
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!assertTenantAccess(request, reply, tenantId)) return;
      const userId = query.userId ?? '';
      const roleId = query.roleId ?? '';
      const includeInactive = query.includeInactive === 'true';
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const offset = (page - 1) * limit;

      const { userRoleAssignments } = await import('../../../db/schema/index.js');

      // Build query conditions
      const conditions = [
        eq(tenantUsers.tenantId, tenantId), // Join condition and tenant filter
        eq(customRoles.tenantId, tenantId)  // Ensure roles belong to tenant
      ];

      if (!includeInactive) {
        conditions.push(eq(userRoleAssignments.isActive, true));
      }

      if (userId) {
        conditions.push(eq(userRoleAssignments.userId, userId));
      }

      if (roleId) {
        conditions.push(eq(userRoleAssignments.roleId, roleId));
      }

      // Get role assignments first, then enrich with organization data separately
      const roleAssignmentsData = await db
        .select({
          assignmentId: userRoleAssignments.id,
          tenantId: sql`${tenantId}` as any,
          userId: userRoleAssignments.userId,
          roleId: userRoleAssignments.roleId,
          roleOrgId: (userRoleAssignments as any).organizationId,
          assignedBy: userRoleAssignments.assignedBy,
          assignedAt: userRoleAssignments.assignedAt,
          expiresAt: userRoleAssignments.expiresAt,
          isActive: userRoleAssignments.isActive,
          isResponsiblePerson: userRoleAssignments.isResponsiblePerson,
          scope: userRoleAssignments.scope,
          isTemporary: userRoleAssignments.isTemporary,
          // User details
          userEmail: tenantUsers.email,
          userName: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.email})`,
          userIsActive: tenantUsers.isActive,
          // Role details
          roleName: customRoles.roleName,
          isSystemRole: customRoles.isSystemRole,
          isDefault: customRoles.isDefault
        })
        .from(userRoleAssignments)
        .innerJoin(tenantUsers, eq(userRoleAssignments.userId, tenantUsers.userId))
        .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
        .where(and(...conditions))
        .orderBy(userRoleAssignments.assignedAt)
        .limit(limit)
        .offset(offset);

      // Enrich with organization data — single batch query instead of one query per assignment.
      // Collect all distinct non-null roleOrgIds, fetch them all at once, then enrich in-memory.
      const distinctOrgIds = [
        ...new Set(
          roleAssignmentsData
            .map((a) => a.roleOrgId as string | null | undefined)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      const orgCodeMap = new Map<string, string>();
      if (distinctOrgIds.length > 0) {
        const orgRows = await db
          .select({ entityId: entities.entityId })
          .from(entities)
          .where(and(
            eq(entities.tenantId, tenantId),
            inArray(entities.entityId, distinctOrgIds),
          ));
        for (const row of orgRows) {
          orgCodeMap.set(row.entityId, row.entityId);
        }
      }

      const assignments = roleAssignmentsData.map((assignment) => ({
        ...assignment,
        orgCode: assignment.roleOrgId ? (orgCodeMap.get(assignment.roleOrgId as string) ?? null) : null,
      }));

      // Transform to CRM format
      const roleAssignments = assignments.map(assignment => ({
        assignmentId: assignment.assignmentId,
        tenantId: assignment.tenantId,
        userId: assignment.userId,
        roleId: assignment.roleId,
        entityId: assignment.orgCode || assignment.roleOrgId || tenantId, // Use actual orgCode from entities table, fallback to internal org ID, then tenantId
        assignedBy: assignment.assignedBy,
        assignedAt: assignment.assignedAt,
        expiresAt: assignment.expiresAt,
        isActive: assignment.isActive
      }));

      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(userRoleAssignments)
        .innerJoin(tenantUsers, eq(userRoleAssignments.userId, tenantUsers.userId))
        .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
        .where(and(...conditions)) as any[];
      const count = Number((countResult[0] as any)?.count ?? 0);

      return {
        success: true,
        data: roleAssignments,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error fetching role assignments:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch role assignments',
        message: error.message
      });
    }
  });

}

