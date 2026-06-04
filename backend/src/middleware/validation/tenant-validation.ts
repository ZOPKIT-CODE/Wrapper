/**
 * Tenant Validation Middleware
 * 
 * Ensures that authenticated users have valid tenant associations
 * before accessing tenant-specific resources
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import ErrorResponses from '../../utils/error-responses.js';
import Logger from '../../utils/logger.js';

/**
 * Middleware to require tenantId for protected routes
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 */
export async function requireTenantId(request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> {
  const requestId = Logger.generateRequestId('tenant-validation');

  Logger.log('info', 'validation', 'require-tenant-id', `🏢 [${requestId}] Validating tenant ID for ${request.method} ${request.url}`);

  // Check if user is authenticated first
  if (!request.userContext?.isAuthenticated) {
    Logger.log('info', 'validation', 'require-tenant-id', `❌ [${requestId}] User not authenticated`);
    return ErrorResponses.unauthorized(reply, 'Authentication required');
  }

  // Check if tenantId exists
  if (!request.userContext?.tenantId) {
    Logger.log('info', 'validation', 'require-tenant-id', `❌ [${requestId}] No tenantId found for user`, {
      userId: request.userContext?.userId,
      email: request.userContext?.email,
      idpSub: request.userContext?.idpSub
    });

    return ErrorResponses.unauthorized(reply, 'User is not associated with any organization. Please complete onboarding first.', {
      action: 'redirect_to_onboarding',
      redirectUrl: '/onboarding',
      missingField: 'tenantId'
    });
  }

  Logger.log('info', 'validation', 'require-tenant-id', `✅ [${requestId}] Tenant validation passed for tenant: ${request.userContext.tenantId}`);
}

/**
 * Middleware to require admin permissions for tenant operations
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 */
export async function requireTenantAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> {
  const requestId = Logger.generateRequestId('tenant-admin-validation');

  Logger.log('info', 'validation', 'require-tenant-admin', `👑 [${requestId}] Validating tenant admin permissions for ${request.method} ${request.url}`);

  // First ensure tenant validation passes
  await requireTenantId(request, reply);

  // If reply was already sent (validation failed), return
  if (reply.sent) {
    return;
  }

  // Check if user has admin permissions for the tenant
  if (!request.userContext?.isTenantAdmin) {
    Logger.log('info', 'validation', 'require-tenant-admin', `❌ [${requestId}] User is not a tenant admin`, {
      userId: request.userContext?.userId,
      email: request.userContext?.email,
      tenantId: request.userContext?.tenantId,
      isTenantAdmin: request.userContext?.isTenantAdmin
    });

    return ErrorResponses.forbidden(reply, 'Admin permissions required for this operation', {
      requiredPermission: 'tenant_admin',
      userPermissions: request.userContext?.permissions || []
    });
  }

  Logger.log('info', 'validation', 'require-tenant-admin', `✅ [${requestId}] Tenant admin validation passed for tenant: ${request.userContext.tenantId}`);
}

/**
 * Middleware to validate that the requested resource belongs to the user's tenant
 * @param {string} paramName - Name of the parameter containing the tenantId (default: 'tenantId')
 * @returns {Function} Middleware function
 */
export function requireTenantMatch(paramName = 'tenantId'): (request: FastifyRequest, reply: FastifyReply) => Promise<void | ReturnType<FastifyReply['send']>> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> => {
    const requestId = Logger.generateRequestId('tenant-match-validation');

    Logger.log('info', 'validation', 'require-tenant-match', `🔄 [${requestId}] Validating tenant match for parameter: ${paramName}`);

    // First ensure tenant validation passes
    await requireTenantId(request, reply);

    // If reply was already sent (validation failed), return
    if (reply.sent) {
      return;
    }

    const params = request.params as Record<string, string>;
    const requestedTenantId = params[paramName];
    const userTenantId = request.userContext.tenantId;

    if (!requestedTenantId) {
      Logger.log('info', 'validation', 'require-tenant-match', `❌ [${requestId}] No ${paramName} parameter found in request`);
      return ErrorResponses.badRequest(reply, `Missing ${paramName} parameter`, {
        paramName,
        availableParams: Object.keys(params)
      });
    }

    if (requestedTenantId !== userTenantId) {
      Logger.log('info', 'validation', 'require-tenant-match', `❌ [${requestId}] Tenant mismatch`, {
        requestedTenantId,
        userTenantId,
        paramName
      });

      return ErrorResponses.forbidden(reply, 'Access denied. Resource does not belong to your organization.', {
        requestedTenantId,
        userTenantId
      });
    }

    Logger.log('info', 'validation', 'require-tenant-match', `✅ [${requestId}] Tenant match validation passed: ${requestedTenantId}`);
  };
}

/**
 * Helper function to create a preHandler hook for tenant validation
 * @param {string} validationType - Type of validation ('basic', 'admin', or 'match')
 * @param {string} paramName - Parameter name for match validation
 * @returns {Function} PreHandler function
 */
export function createTenantValidation(validationType = 'basic', paramName = 'tenantId') {
  switch (validationType) {
    case 'admin':
      return requireTenantAdmin;
    case 'match':
      return requireTenantMatch(paramName);
    case 'basic':
    default:
      return requireTenantId;
  }
}

export default {
  requireTenantId,
  requireTenantAdmin,
  requireTenantMatch,
  createTenantValidation
};
