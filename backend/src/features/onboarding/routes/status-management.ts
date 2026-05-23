import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import Logger from '../../../utils/logger.js';
import { authenticateToken, invalidateUserCache } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, onboardingFormData } from '../../../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { TenantService } from '../../../services/tenant-service.js';
import { kindeService } from '../../../features/auth/index.js';
import { SubscriptionService } from '../../../features/subscriptions/index.js';
import { shouldLogVerbose } from '../../../utils/verbose-log.js';

/**
 * Status Management Routes
 * Handles onboarding status, completion, and related management endpoints
 */

// Helper function to extract token from request
function extractToken(request: FastifyRequest): string | null {
  // First try to get token from cookie
  const cookieToken = request.cookies?.kinde_token;
  if (cookieToken) {
    return cookieToken;
  }

  // Fallback to Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

export default async function statusManagementRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // Handle successful payment callback
  fastify.get('/success', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          session_id: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { session_id } = query;

      if (session_id) {
        // Handle successful payment
        await SubscriptionService.handleCheckoutCompleted({ id: session_id });
      }

      // Redirect to team invitation or dashboard
      const redirectUrl = `${process.env.FRONTEND_URL}/onboarding/team`;
      return reply.redirect(redirectUrl);

    } catch (err: unknown) {
      request.log.error(err, 'Error handling success callback:');
      const errorUrl = `${process.env.FRONTEND_URL}/onboarding/error?message=payment_failed`;
      return reply.redirect(errorUrl);
    }
  });

  // Send team invitations
  fastify.post('/invite-team', {
    preHandler: authenticateToken,
    schema: {
      body: {
        type: 'object',
        required: ['invitations'],
        properties: {
          invitations: {
            type: 'array',
            items: {
              type: 'object',
              required: ['email', 'role'],
              properties: {
                email: { type: 'string', format: 'email' },
                role: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { invitations } = body;
      const userContext = request.userContext as { tenantId: string; userId: string };
      const tenantId = userContext.tenantId;
      const invitedBy = userContext.userId;

      const results = [];

      const invList = invitations as Array<{ email: string; role: string; firstName?: string; lastName?: string }>;
      for (const invitation of invList) {
        try {
          // Get role ID by name
          const [role] = await db
            .select()
            .from(customRoles)
            .where(eq(customRoles.roleName, invitation.role))
            .limit(1);

          if (!role) {
            results.push({
              email: invitation.email,
              success: false,
              error: 'Role not found'
            });
            continue;
          }

          // Send invitation
          const invitationResult = await TenantService.inviteUser({
            tenantId,
            email: invitation.email,
            roleId: role.roleId,
            invitedBy
          });

          results.push({
            email: invitation.email,
            success: true,
            invitationId: invitationResult.invitationId
          });

        } catch (invErr: unknown) {
          results.push({
            email: invitation.email,
            success: false,
            error: (invErr as Error).message
          });
        }
      }

      return {
        success: true,
        data: {
          results,
          totalSent: results.filter(r => r.success).length,
          totalFailed: results.filter(r => !r.success).length
        }
      };

    } catch (err: unknown) {
      request.log.error(err, 'Error sending team invitations:');
      return reply.code(500).send({ error: 'Failed to send invitations' });
    }
  });

  // Complete onboarding (mark as finished)
  fastify.post('/complete', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = request.userContext as { userId: string };
      const userId = userContext.userId;

      // Mark onboarding as completed
      const [updatedUser] = await db
        .update(tenantUsers)
        .set({ onboardingCompleted: true })
        .where(eq(tenantUsers.userId, userId))
        .returning({ kindeUserId: tenantUsers.kindeUserId });

      if (updatedUser?.kindeUserId) {
        void invalidateUserCache(updatedUser.kindeUserId);
      }

      return {
        success: true,
        message: 'Onboarding completed successfully'
      };

    } catch (err: unknown) {
      request.log.error(err, 'Error completing onboarding:');
      return reply.code(500).send({ error: 'Failed to complete onboarding' });
    }
  });

  // Get onboarding status (handles both authenticated and unauthenticated users)
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let userId = null;
      let email = null;
      let kindeUserId = null;

      try {
        const token = extractToken(request);
        if (token) {
          const kindeUser = await kindeService.validateToken(token);
          kindeUserId = kindeUser.kindeUserId || kindeUser.userId;
          userId = kindeUser.userId;
          email = kindeUser.email;
        }
      } catch (authErr: unknown) {
        if (shouldLogVerbose()) Logger.log('info', 'general', 'onboarding-status', 'Token validation failed, using query params', { error: (authErr as Error).message });
        const q = request.query as Record<string, string | undefined>;
        if (q?.kindeUserId) kindeUserId = q.kindeUserId;
        if (q?.email) email = q.email;
      }

      const q2 = request.query as Record<string, string | undefined>;
      if (!kindeUserId && !userId && q2?.kindeUserId) kindeUserId = q2.kindeUserId;
      if (!email && q2?.email) email = q2.email;

      if (!userId && !email) {
        return {
          success: true,
          data: {
            isOnboarded: false,
            needsOnboarding: true,
            onboardingStep: null,
            message: 'No user information provided'
          }
        };
      }

      let userQuery = db.select().from(tenantUsers);
      let lookupType = '';

      if (kindeUserId) {
        userQuery = userQuery.where(eq(tenantUsers.kindeUserId, kindeUserId as string)) as any;
        lookupType = 'kindeId';
      } else if (userId) {
        userQuery = userQuery.where(eq(tenantUsers.userId, userId as string)) as any;
        lookupType = 'userId';
      } else if (email) {
        userQuery = userQuery.where(eq(tenantUsers.email, email as string)) as any;
        lookupType = 'email';
      }

      const [user] = await userQuery.limit(1);

      if (!user) {
        if (shouldLogVerbose()) Logger.log('info', 'general', 'onboarding-status', 'No user found', { lookupType });

        if (kindeUserId && email) {
          return {
            success: true,
            data: {
              isOnboarded: false,
              needsOnboarding: true,
              onboardingStep: '1',
              savedFormData: {},
              message: 'User authenticated but needs to complete onboarding',
              kindeUser: {
                id: kindeUserId,
                email: email
              }
            }
          };
        }

        return {
          success: true,
          data: {
            isOnboarded: false,
            needsOnboarding: true,
            onboardingStep: null,
            savedFormData: {},
            message: 'User has not started onboarding yet'
          }
        };
      }

      if (shouldLogVerbose()) {
        Logger.log('info', 'general', 'onboarding-status', 'User found', {
          userId: user.userId,
          onboardingCompleted: user.onboardingCompleted,
          tenantId: user.tenantId
        });
      }

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, user.tenantId))
        .limit(1);

      const onboardingData = (user.preferences as { onboarding?: { formData?: unknown } })?.onboarding || {};
      let formData: Record<string, unknown> = (onboardingData.formData || {}) as Record<string, unknown>;

      // Fallback: if no form data in user preferences, reconstruct from tenant columns.
      if (Object.keys(formData).length === 0 && tenant) {
        const fallback: Record<string, unknown> = {
          businessType: tenant.industry || undefined,
          companySize: tenant.organizationSize || undefined,
          country: tenant.billingCountry || tenant.mailingCountry || undefined,
          timezone: tenant.defaultTimeZone || undefined,
          currency: tenant.defaultCurrency || undefined,
          hasGstin: tenant.gstin ? true : undefined,
          gstin: tenant.gstin || undefined,
        };
        // Strip undefined keys
        for (const key of Object.keys(fallback)) {
          if (fallback[key] === undefined) delete fallback[key];
        }
        if (Object.keys(fallback).length > 0) formData = fallback;
      }

      // Invited users should never be sent to onboarding
      const isInvitedUser = user.onboardingCompleted === true && 
                           ((user.preferences as { userType?: string })?.userType === 'INVITED_USER' || 
                            (user.preferences as { isInvitedUser?: boolean })?.isInvitedUser === true ||
                            (user as { invitedBy?: string | null }).invitedBy !== null ||
                            user.invitedAt !== null);

      const isOnboarded = user.onboardingCompleted === true;
      const needsOnboarding = user.onboardingCompleted !== true;

      const result = {
        success: true,
        data: {
          isOnboarded: isOnboarded,
          needsOnboarding: needsOnboarding,
          onboardingStep: isOnboarded ? 'completed' : '1',
          savedFormData: formData,
          onboardingProgress: onboardingData,
          tenant: tenant ? {
            id: tenant.tenantId,
            name: tenant.companyName,
            subdomain: tenant.subdomain
          } : null,
          user: {
            id: user.userId,
            email: user.email,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
            kindeUserId: user.kindeUserId
          }
        },
        authStatus: {
          isAuthenticated: true,
          userId: kindeUserId || userId,
          internalUserId: user.userId,
          tenantId: user.tenantId,
          email: user.email,
          isTenantAdmin: user.isTenantAdmin || false,
          needsOnboarding: needsOnboarding,
          onboardingCompleted: isOnboarded,
          userType: isInvitedUser ? 'INVITED_USER' : (isOnboarded ? 'EXISTING_USER' : 'REGULAR_USER'),
          isInvitedUser: isInvitedUser
        }
      };

      if (shouldLogVerbose()) {
        Logger.log('info', 'general', 'onboarding-status', 'Onboarding status result', {
          isOnboarded,
          needsOnboarding,
          userType: result.authStatus.userType
        });
      }

      return result;

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'onboarding-status', 'Onboarding status error', { error: error.message });
      request.log.error(error, 'Error getting onboarding status:');
      return reply.code(500).send({ error: 'Failed to get onboarding status' });
    }
  });

  // Get onboarding data — requires a valid Kinde JWT
  fastify.post('/get-data', {
    schema: {
      body: z.object({
        email: z.string().email(),
        kindeUserId: z.string().optional()
      })
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { email } = body;
      let kindeUserId: string | undefined;

      // Require a valid Kinde JWT — extract kindeUserId from the token
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }
      try {
        const token = authHeader.substring(7);
        const user = await kindeService.validateToken(token);
        kindeUserId = (user.kindeUserId || user.userId) as string;
      } catch (authErr: unknown) {
        return reply.code(401).send({ success: false, error: 'Invalid authentication token' });
      }
      if (!kindeUserId) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      // First, try to get data from onboarding_form_data table (for users not yet created)
      let formDataFromTable = null;
      
      if (kindeUserId) {
        const [onboardingData] = await db
          .select()
          .from(onboardingFormData)
          .where(
            and(
              eq(onboardingFormData.kindeUserId, kindeUserId as string),
              eq(onboardingFormData.email, email as string)
            )
          )
          .limit(1);
        
        if (onboardingData) {
          formDataFromTable = onboardingData;
        }
      } else {
        // Try by email only
        const [onboardingData] = await db
          .select()
          .from(onboardingFormData)
          .where(eq(onboardingFormData.email, email as string))
          .orderBy(desc(onboardingFormData.lastSaved))
          .limit(1);
        
        if (onboardingData) {
          formDataFromTable = onboardingData;
        }
      }

      // Also check if user exists in tenantUsers table
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.email, email as string))
        .limit(1);

      // If we have form data from the table, use it (takes precedence)
      if (formDataFromTable) {
        return reply.code(200).send({
          success: true,
          data: {
            isOnboarded: false,
            needsOnboarding: true,
            onboardingStep: formDataFromTable.currentStep,
            savedFormData: formDataFromTable.formData || {},
            onboardingData: {
              currentStep: formDataFromTable.currentStep,
              formData: formDataFromTable.formData,
              stepData: formDataFromTable.stepData,
              flowType: formDataFromTable.flowType,
              lastSaved: formDataFromTable.lastSaved
            },
            source: 'onboarding_form_data_table'
          }
        });
      }

      // Fallback to user preferences if user exists
      if (user) {
        const onboardingData = (user.preferences as { onboarding?: { formData?: unknown } })?.onboarding || {};
        const formData = onboardingData.formData || {};

        return reply.code(200).send({
          success: true,
          data: {
            isOnboarded: user.onboardingCompleted,
            needsOnboarding: !user.onboardingCompleted,
            onboardingStep: null,
            savedFormData: formData,
            onboardingProgress: onboardingData,
            source: 'user_preferences'
          }
        });
      }

      // No data found
      return reply.code(200).send({
        success: true,
        data: {
          isOnboarded: false,
          needsOnboarding: true,
          onboardingStep: null,
          savedFormData: {},
          message: 'No previous onboarding data found'
        }
      });

    } catch (err: unknown) {
      request.log.error(err, 'Error getting onboarding data by email:');
      return reply.code(500).send({ error: 'Failed to get onboarding data' });
    }
  });
}
