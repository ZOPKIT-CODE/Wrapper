/**
 * Invited User Restriction Middleware
 * 
 * Blocks invited users from performing any write operations (POST, PUT, DELETE, PATCH)
 * Only tenant admins can perform write operations.
 * 
 * Invited users can only:
 * - Read data (GET requests)
 * - Access applications assigned to them
 * 
 * All write operations require tenant admin privileges.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { tenantUsers } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import Logger from '../../utils/logger.js';

type Preferences = Record<string, unknown>;

/**
 * Check if user is an invited user
 */
async function isInvitedUser(userId: string, tenantId: string): Promise<boolean> {
  try {
    const [user] = await db
      .select()
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.userId, userId),
        eq(tenantUsers.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      return false;
    }

    const prefs = (user.preferences ?? {}) as Preferences;
    const userRow = user as { invitedBy?: string | null };
    // Check if user is invited
    const isInvited = prefs.userType === 'INVITED_USER' ||
                      prefs.isInvitedUser === true ||
                      userRow.invitedBy != null ||
                      user.invitedAt !== null;

    return isInvited && !user.isTenantAdmin;
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'restrictions', 'is-invited-user', 'Error checking if user is invited', { error: error.message, stack: error.stack });
    return false;
  }
}

/**
 * Middleware to restrict invited users from write operations
 * Only allows GET requests for invited users
 */
export async function restrictInvitedUsers(request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> {
  // Skip for public routes
  if (!request.userContext?.isAuthenticated) {
    return; // Let other middleware handle authentication
  }

  // Skip for GET requests (read-only operations)
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return;
  }

  // Allow tenant admins to perform all operations
  if (request.userContext?.isTenantAdmin === true) {
    return;
  }

  // Check if user is an invited user
  const userId = request.userContext?.internalUserId || request.userContext?.userId;
  const tenantId = request.userContext?.tenantId;

  if (!userId || !tenantId) {
    // Expected for onboarding and auth-status; avoid noisy logs
    const url = request?.url || '';
    if (!/\/api\/onboarding\//.test(url) && !/\/api\/admin\/auth-status/.test(url)) {
      Logger.log('info', 'restrictions', 'restrict-invited-users', '⚠️ [InvitedUserRestriction] Missing user context', { userId, tenantId });
    }
    return; // Let other middleware handle missing context
  }

  const userIsInvited = await isInvitedUser(userId, tenantId);

  if (userIsInvited) {
    Logger.log('info', 'restrictions', 'restrict-invited-users', '🚫 [InvitedUserRestriction] Blocked write operation from invited user', {
      method: request.method,
      url: request.url,
      userId,
      tenantId,
      email: request.userContext?.email
    });

    return reply.code(403).send({
      success: false,
      error: 'Forbidden',
      message: 'Invited users can only view data. Admin privileges required to perform this operation.',
      requiredPermission: 'tenant_admin'
    });
  }

  // User is not invited or is admin - allow operation
  Logger.log('info', 'restrictions', 'restrict-invited-users', '✅ [InvitedUserRestriction] Allowing operation', {
    method: request.method,
    url: request.url,
    userId,
    isTenantAdmin: request.userContext?.isTenantAdmin,
    isInvited: false
  });
}

/**
 * Middleware factory to require tenant admin for specific routes
 */
export function requireTenantAdminForWrites(): (request: FastifyRequest, reply: FastifyReply) => Promise<void | ReturnType<FastifyReply['send']>> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> => {
    // Skip for GET requests
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      return;
    }

    // Check if user is tenant admin
    if (!request.userContext?.isTenantAdmin) {
      Logger.log('info', 'restrictions', 'require-tenant-admin-for-writes', '🚫 [RequireTenantAdmin] Blocked write operation - user is not tenant admin', {
        method: request.method,
        url: request.url,
        userId: request.userContext?.internalUserId || request.userContext?.userId,
        email: request.userContext?.email,
        isTenantAdmin: request.userContext?.isTenantAdmin
      });

      return reply.code(403).send({
        success: false,
        error: 'Forbidden',
        message: 'Tenant admin privileges required to perform this operation.',
        requiredPermission: 'tenant_admin'
      });
    }

    Logger.log('info', 'restrictions', 'require-tenant-admin-for-writes', '✅ [RequireTenantAdmin] Tenant admin verified for write operation', {
      method: request.method,
      url: request.url,
      userId: request.userContext?.internalUserId || request.userContext?.userId
    });
  };
}

