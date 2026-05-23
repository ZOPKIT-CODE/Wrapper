/**
 * Internal User Access Routes
 * Audience: per-request permission lookups from suite apps.
 * Handles access validation, full permission aggregation, and available-tools enumeration.
 * All routes require X-Internal-API-Key.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateInternalApiKey } from '../../middleware/auth/internal.js';
import { TenantService } from '../../services/tenant-service.js';
import { db } from '../../db/index.js';
import { tenantUsers, customRoles, userRoleAssignments } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import DistributedSSOCache from '../../utils/distributed-sso-cache.js';
import ErrorResponses from '../../utils/error-responses.js';
import Logger from '../../utils/logger.js';

// Shared helper — extract tool names from a role permission map
export function getAvailableTools(roles: any[]): string[] {
  const tools = new Set<string>();
  roles.forEach((role: any) => {
    const permissions = typeof role.permissions === 'string'
      ? JSON.parse(role.permissions)
      : role.permissions;
    Object.keys(permissions || {}).forEach((tool: string) => {
      if (Object.keys((permissions as any)[tool] || {}).length > 0) {
        tools.add(tool);
      }
    });
  });
  return Array.from(tools);
}

export default async function internalUserAccessRoutes(fastify: FastifyInstance): Promise<void> {

  // Basic user access check: is the user active and does the tenant exist?
  fastify.post('/validate-access', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const tenantId = (body.tenantId as string) ?? '';
    const userId   = (body.userId   as string) ?? '';
    const tool     = (body.tool     as string) ?? '';

    if (!tenantId || !userId || !tool) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    try {
      const tenant = await TenantService.getTenantDetails(tenantId);
      if (!tenant || !tenant.isActive) {
        return reply.code(403).send({ error: 'Tenant not active', hasAccess: false });
      }

      const [user] = (await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.isActive, true),
        ))
        .limit(1)) as Array<{ userId: string; firstName: string | null; lastName: string | null; email: string | null; isTenantAdmin: boolean | null }>;

      if (!user) {
        return reply.code(403).send({ error: 'User not found or inactive', hasAccess: false });
      }

      return {
        success: true,
        hasAccess: true,
        user: {
          id: user.userId,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '',
          email: user.email ?? '',
          isTenantAdmin: user.isTenantAdmin ?? false,
        },
        tenant: { id: tenant.tenantId, name: tenant.companyName },
      };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error validating access:');
      return reply.code(500).send({ error: 'Failed to validate access' });
    }
  });

  // Full permission aggregation with distributed cache (cache-aside)
  fastify.post('/user-permissions', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const kinde_user_id   = (body.kinde_user_id   as string) ?? '';
    const kinde_org_code  = (body.kinde_org_code  as string) ?? '';
    const requesting_app  = (body.requesting_app  as string) ?? '';
    const force_refresh   = body.force_refresh as boolean | undefined;

    try {
      Logger.log('info', 'routes', 'user-permissions', `🔍 Processing user permissions request: ${kinde_user_id} for ${requesting_app}`);

      if (!force_refresh) {
        const cachedAuth = await DistributedSSOCache.getUserAuth(kinde_user_id, kinde_org_code) as any;
        if (cachedAuth) {
          Logger.log('info', 'routes', 'user-permissions', `🚀 CACHE HIT: Returning cached auth data for ${kinde_user_id}`);
          const cachedPermissions = await DistributedSSOCache.getUserPermissions(
            cachedAuth.user?.id ?? '',
            cachedAuth.tenant?.id ?? '',
            requesting_app,
          );
          if (cachedPermissions) {
            Logger.log('info', 'routes', 'user-permissions', `🎯 CACHE HIT: Returning cached permissions for ${requesting_app}`);
            return {
              success: true,
              data: {
                ...cachedAuth,
                permissions: (cachedPermissions as any).permissions || cachedPermissions,
                source: 'cache',
                cachedAt: (cachedAuth as any).cachedAt || new Date().toISOString(),
              },
            };
          }
        }
      }

      Logger.log('info', 'routes', 'user-permissions', `💾 Cache MISS: Fetching fresh data from database`);

      const tenant = await TenantService.getByKindeOrgId(kinde_org_code);
      if (!tenant) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found', { kinde_org_code } as any);
      }

      const userResult = await db
        .select({
          id:        tenantUsers.userId,
          email:     tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName:  tenantUsers.lastName,
          isActive:  tenantUsers.isActive,
        })
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.kindeUserId, kinde_user_id),
          eq(tenantUsers.tenantId, tenant.tenantId as string),
        ))
        .limit(1) as any[];

      if (!userResult.length) {
        return ErrorResponses.notFound(reply, 'User', 'User not found in tenant', {
          kinde_user_id,
          tenant_id: tenant.tenantId,
        } as any);
      }

      const user = userResult[0];
      if (!user.isActive) {
        return reply.code(403).send({ error: 'User account is inactive', user_id: user.id });
      }

      const userRolesResult = await db
        .select({
          roleId:       customRoles.roleId,
          roleName:     customRoles.roleName,
          permissions:  customRoles.permissions,
          restrictions: (customRoles as any).restrictions,
          isActive:     userRoleAssignments.isActive,
          expiresAt:    userRoleAssignments.expiresAt,
        })
        .from(userRoleAssignments)
        .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
        .where(and(
          eq(userRoleAssignments.userId, user.id),
          eq(userRoleAssignments.isActive, true),
        ));

      const now = new Date();
      const activeRoles = userRolesResult.filter(role =>
        !role.expiresAt || new Date(role.expiresAt) > now,
      );

      if (!activeRoles.length) {
        return reply.code(403).send({ error: 'No active roles found for user', user_id: user.id });
      }

      const aggregatedPermissions: Record<string, string[]> = {};
      const aggregatedRestrictions: Record<string, unknown> = {};
      const userRoleNames: string[] = [];

      for (const role of activeRoles) {
        userRoleNames.push((role as any).roleName ?? '');
        const rolePermissions = typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions;
        const roleRestrictions = typeof (role as any).restrictions === 'string'
          ? JSON.parse((role as any).restrictions || '{}')
          : ((role as any).restrictions || {});
        const toolPermissions = (rolePermissions as any)[requesting_app] || {};

        Object.keys(toolPermissions).forEach(resource => {
          if (!aggregatedPermissions[resource]) aggregatedPermissions[resource] = [];
          const resourcePermissions = toolPermissions[resource];
          if (Array.isArray(resourcePermissions)) {
            resourcePermissions.forEach((permission: string) => {
              if (!aggregatedPermissions[resource].includes(permission)) {
                aggregatedPermissions[resource].push(permission);
              }
            });
          }
        });

        Object.keys(roleRestrictions).forEach(key => {
          if (key.startsWith(`${requesting_app}.`)) {
            if (typeof roleRestrictions[key] === 'number') {
              (aggregatedRestrictions as any)[key] = Math.min(
                ((aggregatedRestrictions as any)[key] as number) || Number.MAX_SAFE_INTEGER,
                roleRestrictions[key] as number,
              );
            } else if (!(aggregatedRestrictions as any)[key]) {
              (aggregatedRestrictions as any)[key] = roleRestrictions[key];
            }
          }
        });
      }

      if (Object.keys(aggregatedPermissions).length === 0) {
        return reply.code(403).send({
          error: 'No permissions for requested application',
          requesting_app,
          available_tools: getAvailableTools(activeRoles),
        });
      }

      const responseData = {
        user: { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}`, kinde_user_id },
        tenant: { id: tenant.tenantId, name: tenant.companyName, subdomain: tenant.subdomain },
        roles: userRoleNames,
        permissions: aggregatedPermissions,
        restrictions: aggregatedRestrictions,
        context: { requesting_app, kinde_org_code, timestamp: new Date().toISOString() },
      };

      try {
        await Promise.all([
          DistributedSSOCache.cacheUserAuth(String(kinde_user_id), String(kinde_org_code), responseData),
          DistributedSSOCache.cacheUserRoles(String(user.id), String(tenant.tenantId), activeRoles as any),
          DistributedSSOCache.cacheUserPermissions(String(user.id), String(tenant.tenantId), String(requesting_app), {
            permissions: aggregatedPermissions,
            restrictions: aggregatedRestrictions,
            roles: userRoleNames,
          }),
        ]);
        Logger.log('info', 'routes', 'user-permissions', `✅ Successfully cached auth data for ${kinde_user_id}:${requesting_app}`);
      } catch (cacheError) {
        const cacheErr = cacheError as Error;
        Logger.log('error', 'routes', 'user-permissions', '⚠️ Cache write failed (non-critical)', { error: cacheErr.message, stack: cacheErr.stack });
      }

      return { success: true, data: { ...responseData, source: 'database', cachedAt: new Date().toISOString() } };

    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error fetching user permissions:');
      return reply.code(500).send({ error: 'Failed to fetch user permissions', message: (err as Error).message });
    }
  });

  // List the tool names the user has any permissions for
  fastify.post('/user-tools', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const kinde_user_id  = (body.kinde_user_id  as string) ?? '';
    const kinde_org_code = (body.kinde_org_code as string) ?? '';

    try {
      const tenant = await TenantService.getByKindeOrgId(kinde_org_code);
      if (!tenant) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const userResult = await db
        .select({ id: tenantUsers.userId })
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.kindeUserId, kinde_user_id),
          eq(tenantUsers.tenantId, tenant.tenantId as string),
        ))
        .limit(1) as any[];

      if (!userResult.length) return ErrorResponses.notFound(reply, 'User', 'User not found');

      const userRolesResult = await db
        .select({ permissions: customRoles.permissions })
        .from(userRoleAssignments)
        .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
        .where(and(
          eq(userRoleAssignments.userId, String(userResult[0].id)),
          eq(userRoleAssignments.isActive, true),
        ));

      return {
        success: true,
        data: {
          available_tools: getAvailableTools(userRolesResult),
          tenant_id: tenant.tenantId,
        },
      };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error fetching user tools:');
      return reply.code(500).send({ error: 'Failed to fetch user tools' });
    }
  });
}
