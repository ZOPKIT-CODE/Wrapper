import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// zod/v4 entry: fastify-type-provider-zod@5 validates via the v4 core
// (schema._zod.run) — classic-'zod' (v3) schemas crash it with
// "Cannot read properties of undefined (reading 'run')" on EVERY request.
import { z } from 'zod/v4';
import Logger from '../../../utils/logger.js';
import { authenticateToken, invalidateUserCache } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, onboardingFormData } from '../../../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { TenantService } from '../../../services/tenant-service.js';
import { verifyCognitoToken } from '../../auth/services/cognito-service.js';
import { SubscriptionService } from '../../../features/subscriptions/index.js';
import { shouldLogVerbose } from '../../../utils/verbose-log.js';

/**
 * Status Management Routes
 * Handles onboarding status, completion, and related management endpoints
 */

/**
 * Validate a bearer/cookie token (Cognito-only). The token is verified via
 * verifyCognitoToken and mapped to { idpSub, userId, email, name }
 * shape (sub -> idpSub/userId). An invalid token throws (treated as
 * unauthenticated by callers).
 */
async function validateTokenAnyIdp(token: string): Promise<Record<string, unknown>> {
  const ci = await verifyCognitoToken(token);
  if (!ci?.sub) {
    throw new Error('Invalid Cognito token');
  }
  return { idpSub: ci.sub, userId: ci.sub, email: ci.email, name: ci.name };
}

// Helper function to extract token from request
function extractToken(request: FastifyRequest): string | null {
  // First try to get token from cookie
  const cookieToken = request.cookies?.idp_token;
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
        .returning({ idpSub: tenantUsers.idpSub });

      if (updatedUser?.idpSub) {
        void invalidateUserCache(updatedUser.idpSub);
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
      let idpSub = null;

      try {
        const token = extractToken(request);
        if (token) {
          const idpToken = await validateTokenAnyIdp(token);
          idpSub = idpToken.idpSub || idpToken.userId;
          userId = idpToken.userId;
          email = idpToken.email;
        }
      } catch (authErr: unknown) {
        if (shouldLogVerbose()) Logger.log('info', 'general', 'onboarding-status', 'Token validation failed, using query params', { error: (authErr as Error).message });
        const q = request.query as Record<string, string | undefined>;
        if (q?.idpSub) idpSub = q.idpSub;
        if (q?.email) email = q.email;
      }

      const q2 = request.query as Record<string, string | undefined>;
      if (!idpSub && !userId && q2?.idpSub) idpSub = q2.idpSub;
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

      if (idpSub) {
        userQuery = userQuery.where(eq(tenantUsers.idpSub, idpSub as string)) as any;
        lookupType = 'idpSub';
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

        if (idpSub && email) {
          return {
            success: true,
            data: {
              isOnboarded: false,
              needsOnboarding: true,
              onboardingStep: '1',
              savedFormData: {},
              message: 'User authenticated but needs to complete onboarding',
              idpUser: {
                id: idpSub,
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

      // Invited users join an already-onboarded tenant and must never be sent to the
      // onboarding wizard — regardless of their own onboarding_completed flag. (Not gated
      // on onboardingCompleted; tenant_users has no invited_by column, so detection uses
      // preferences.userType / isInvitedUser and the invitedAt timestamp.)
      const isInvitedUser = (user.preferences as { userType?: string })?.userType === 'INVITED_USER' ||
                            (user.preferences as { isInvitedUser?: boolean })?.isInvitedUser === true ||
                            user.invitedAt != null;

      const isOnboarded = user.onboardingCompleted === true;
      const needsOnboarding = !isOnboarded && !isInvitedUser;

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
            idpSub: user.idpSub
          }
        },
        authStatus: {
          isAuthenticated: true,
          userId: idpSub || userId,
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

  // Get onboarding data — requires a valid Cognito JWT
  fastify.post('/get-data', {
    schema: {
      body: z.object({
        email: z.string().email(),
        idpSub: z.string().optional()
      })
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { email } = body;
      let idpSub: string | undefined;

      // Cognito session rides the httpOnly idp_token cookie (matches the global
      // auth middleware's extractToken); a Bearer header is an optional fallback.
      const authHeader = request.headers.authorization;
      const token = (request as { cookies?: { idp_token?: string } }).cookies?.idp_token
        ?? (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined);
      if (!token) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }
      try {
        const user = await validateTokenAnyIdp(token);
        idpSub = (user.idpSub || user.userId) as string;
      } catch (authErr: unknown) {
        return reply.code(401).send({ success: false, error: 'Invalid authentication token' });
      }
      if (!idpSub) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      // First, try to get data from onboarding_form_data table (for users not yet created)
      let formDataFromTable = null;
      
      if (idpSub) {
        const [onboardingData] = await db
          .select()
          .from(onboardingFormData)
          .where(
            and(
              eq(onboardingFormData.idpSub, idpSub as string),
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
