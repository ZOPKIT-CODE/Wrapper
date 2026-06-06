import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import {
  ServiceError,
  getInvitationDetails,
  getInvitationByToken,
  getAdminInvitations,
  resendInvitationEmail,
  cancelInvitation,
  createInvitation,
  createMultiEntityInvitation,
  getInvitationDetailsByToken,
  acceptInvitationByToken
} from '../services/invitation-service.js';
import Logger from '../../../utils/logger.js';

// Translates a ServiceError into an HTTP response; re-throws unknown errors.
function handleServiceError(err: unknown, reply: FastifyReply, fallbackStatus: number, fallbackMessage: string) {
  if (err instanceof ServiceError) {
    return reply.code(err.statusCode).send(err.body);
  }
  const error = err as Error;
  Logger.log('error', 'email', 'invitation-route', fallbackMessage, { error: error.message });
  return reply.code(fallbackStatus).send({
    error: fallbackMessage,
    message: error.message,
    stack: error.stack
  });
}

export default async function invitationRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // Get invitation details for acceptance page - PUBLIC ENDPOINT
  fastify.get('/details', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { org, email } = query;

      if (!org || !email) {
        return reply.code(400).send({
          error: 'Missing required parameters',
          message: 'org and email parameters are required'
        });
      }

      Logger.log('info', 'general', 'get-invitation-details', 'Raw query params', { query: request.query });
      return await getInvitationDetails(org, email);
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Failed to get invitation details');
    }
  });

  // Accept invitation (public endpoint — returns invitation info for the accept page)
  fastify.post('/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { token } = body;

      if (!token) {
        return reply.code(400).send({
          error: 'Missing required field',
          message: 'token is required'
        });
      }

      return await getInvitationByToken(token as string);
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Internal server error');
    }
  });

  // Admin endpoint to get all invitations for an organization
  fastify.get('/admin/:orgCode', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      return await getAdminInvitations(params.orgCode, request);
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Failed to get invitations');
    }
  });

  // Admin endpoint to resend invitation email
  fastify.post('/admin/:orgCode/:invitationId/resend', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { orgCode, invitationId } = params;

      try {
        return await resendInvitationEmail(orgCode, invitationId, request);
      } catch (err) {
        if (err instanceof ServiceError) {
          // Resend-specific: include invitationUrl in email-send failures when available
          return reply.code(err.statusCode).send(err.body);
        }
        throw err;
      }
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Failed to resend invitation');
    }
  });

  // Admin endpoint to cancel invitation
  fastify.delete('/admin/:orgCode/:invitationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      return await cancelInvitation(params.orgCode, params.invitationId);
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Failed to cancel invitation');
    }
  });

  // Create invitation for current tenant (authenticated endpoint)
  fastify.post('/create', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { email, roleName = 'Member' } = body;

      if (!email) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'email is required'
        });
      }

      if (!request.userContext?.isAuthenticated) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const tenantId = request.userContext.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: 'Tenant context required',
          message: 'User must be associated with a tenant'
        });
      }

      return await createInvitation({
        email: email as string,
        roleName: roleName as string,
        tenantId,
        inviterContext: {
          internalUserId: (request.userContext as { internalUserId?: string }).internalUserId,
          userId: (request.userContext as { userId?: string }).userId,
          idpSub: request.userContext.idpSub,
          name: request.userContext.name
        },
        message: (body.message as string) || undefined,
        request
      });
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Failed to create invitation');
    }
  });

  // Create multi-entity invitation (authenticated endpoint)
  fastify.post('/create-multi-entity', {
    // Authentication handled globally, no need for route-level auth
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'create-multi-entity-invitation', 'Multi-entity invitation route called');
      const body = request.body as Record<string, unknown>;
      const { email, entities: rawEntities, primaryEntityId, message } = body;
      const targetEntities = Array.isArray(rawEntities)
        ? rawEntities
        : rawEntities
          ? [rawEntities]
          : [];

      Logger.log('info', 'general', 'create-multi-entity-invitation', 'Request body destructured', {
        email: email as string,
        entitiesType: Array.isArray(rawEntities) ? 'array' : typeof rawEntities,
        primaryEntityId: primaryEntityId as string
      });

      if (!email) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'email is required'
        });
      }

      if (!targetEntities || targetEntities.length === 0) {
        Logger.log('warning', 'validation', 'create-multi-entity-invitation', 'Entities validation failed', {
          isArray: Array.isArray(targetEntities),
          length: targetEntities?.length
        });
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'entities array is required and cannot be empty'
        });
      }

      if (!request.userContext?.isAuthenticated) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const tenantId = request.userContext.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: 'Tenant context required',
          message: 'User must be associated with a tenant'
        });
      }

      return await createMultiEntityInvitation({
        email: email as string,
        targetEntities: targetEntities as Array<{ entityId: string; roleId: string; membershipType?: string }>,
        primaryEntityId: primaryEntityId as string | undefined,
        message: message as string | undefined,
        tenantId,
        inviterInternalUserId: request.userContext.internalUserId as string,
        inviterName: request.userContext.name,
        request
      });
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Failed to create multi-entity invitation');
    }
  });

  // Get invitation details by token - PUBLIC ENDPOINT
  fastify.get('/details-by-token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { token } = query;

      if (!token) {
        return reply.code(400).send({
          error: 'Missing required parameters',
          message: 'token parameter is required'
        });
      }

      return await getInvitationDetailsByToken(token);
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Failed to get invitation details');
    }
  });

  // Accept invitation by token - AUTHENTICATED ENDPOINT
  fastify.post('/accept-by-token', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { token } = body;

      // Use server-validated identity — never trust user-supplied idpSub
      const idpSub = request.userContext.idpSub;
      const authenticatedEmail = request.userContext.email;

      if (!token) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'token is required'
        });
      }

      if (!idpSub || !authenticatedEmail) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const result = await acceptInvitationByToken({
        token: token as string,
        idpSub,
        authenticatedEmail
      });

      // Handle already-accepted path (returns 200 directly)
      if ((result as { alreadyAccepted?: boolean }).alreadyAccepted) {
        const { alreadyAccepted: _, ...responseBody } = result as { alreadyAccepted: boolean; success: boolean; message: string; userId: string; email: string };
        return reply.code(200).send(responseBody);
      }

      return result;
    } catch (err) {
      return handleServiceError(err, reply, 500, 'Failed to accept invitation');
    }
  });
}
