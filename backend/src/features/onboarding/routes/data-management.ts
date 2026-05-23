import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken, invalidateUserCache } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, onboardingFormData } from '../../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import ErrorResponses from '../../../utils/error-responses.js';

/**
 * Data Management Routes
 * Handles data retrieval, organization info, and step tracking endpoints
 */

export default async function dataManagementRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // Get user's organization info after onboarding
  fastify.get('/user-organization', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = request.userContext as { userId: string };
      const userId = userContext.userId;

      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, userId))
        .limit(1);

      if (!user) {
        return ErrorResponses.notFound(reply, 'User', 'User not found');
      }

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, user.tenantId))
        .limit(1);

      if (!tenant) {
        return ErrorResponses.notFound(reply, 'Organization', 'Organization not found');
      }

      return {
        success: true,
        data: {
          organization: {
            id: tenant.tenantId,
            name: tenant.companyName,
            domain: (tenant as Record<string, unknown>).domain,
            subdomain: tenant.subdomain,
            createdAt: tenant.createdAt
          },
          user: {
            id: user.userId,
            email: user.email,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '',
            isAdmin: user.isTenantAdmin,
            onboardingCompleted: user.onboardingCompleted
          }
        }
      };

    } catch (err: unknown) {
      request.log.error(err, 'Error getting user organization:');
      return reply.code(500).send({ error: 'Failed to get user organization' });
    }
  });

  // Mark onboarding as complete (with organization ID)
  fastify.post('/mark-complete', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = request.userContext as { userId: string };
      const userId = userContext.userId;
      const body = request.body as Record<string, unknown>;
      const { organizationId } = body;

      // Verify user belongs to this organization
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, userId))
        .limit(1);

      if (!user) {
        return ErrorResponses.notFound(reply, 'User', 'User not found');
      }

      if (user.tenantId !== (organizationId as string)) {
        return reply.code(403).send({ error: 'User does not belong to this organization' });
      }

      // Mark onboarding as completed
      const [updatedUser] = await db
        .update(tenantUsers)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date()
        })
        .where(eq(tenantUsers.userId, userId))
        .returning({ kindeUserId: tenantUsers.kindeUserId });

      if (updatedUser?.kindeUserId) {
        void invalidateUserCache(updatedUser.kindeUserId);
      }

      return {
        success: true,
        message: 'Onboarding marked as completed',
        data: {
          userId,
          organizationId,
          completedAt: new Date().toISOString()
        }
      };

    } catch (err: unknown) {
      request.log.error(err, 'Error marking onboarding complete:');
      return reply.code(500).send({ error: 'Failed to mark onboarding as complete' });
    }
  });

  // Update onboarding step (for step-by-step tracking)
  fastify.post('/update-step', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { step, data, formData, email } = body;
      let kindeUserId: string | null = null;
      let userEmail: string | null = null;

      // Require a valid Kinde JWT — reject unauthenticated requests
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }
      try {
        const { kindeService } = await import('../../auth/index.js');
        const token = authHeader.substring(7);
        const user = await kindeService.validateToken(token);
        kindeUserId = (user.kindeUserId || user.userId) as string;
        // Prefer email from the verified token; fall back to body
        userEmail = ((user.email || email) as unknown) as string | null;
      } catch (authErr: unknown) {
        return reply.code(401).send({ success: false, error: 'Invalid authentication token' });
      }
      if (!kindeUserId) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
      }

      if (!userEmail) {
        userEmail = email as string | null;
      }

      if (!kindeUserId || !userEmail) {
        return reply.code(400).send({
          error: 'Kinde user ID and email are required'
        });
      }

      // Check if onboarding form data already exists
      const [existingFormData] = await db
        .select()
        .from(onboardingFormData)
        .where(
          and(
            eq(onboardingFormData.kindeUserId, kindeUserId),
            eq(onboardingFormData.email, userEmail)
          )
        )
        .limit(1);

      // Prepare step data - FIXED: Only update if step doesn't exist or data is different
      const stepDataUpdate = {
        ...(data as Record<string, unknown>),
        completedAt: new Date().toISOString()
      };

      // Prepare form data - merge with existing if present
      const existingFormDataObj = (existingFormData?.formData as Record<string, unknown>) || {};
      const mergedFormData = formData 
        ? { ...existingFormDataObj, ...(formData as Record<string, unknown>) }
        : existingFormDataObj;

      // FIXED: Prepare step data object - check if step already exists to prevent duplicates
      const existingStepData = (existingFormData?.stepData as Record<string, unknown>) || {};
      
      // Only update step data if it's different or doesn't exist
      const existingStepEntry = existingStepData[step as string];
      const stepNeedsUpdate = !existingStepEntry || 
        JSON.stringify(existingStepEntry) !== JSON.stringify(stepDataUpdate);
      
      const updatedStepData = stepNeedsUpdate
        ? {
            ...existingStepData,
            [step as string]: stepDataUpdate
          }
        : existingStepData; // Keep existing if no changes

      if (existingFormData) {
        // Update existing record
        const [updated] = await db
          .update(onboardingFormData)
          .set({
            currentStep: step as string,
            formData: mergedFormData,
            stepData: updatedStepData,
            lastSaved: new Date(),
            updatedAt: new Date()
          })
          .where(eq(onboardingFormData.id, existingFormData.id))
          .returning();

        return reply.code(200).send({
          success: true,
          message: 'Onboarding step updated successfully',
          data: {
            step,
            kindeUserId,
            email: userEmail,
            formDataId: updated.id,
            updatedAt: updated.updatedAt
          }
        });
      } else {
        // Create new record
        const [created] = await db
          .insert(onboardingFormData)
          .values({
            kindeUserId,
            email: userEmail,
            currentStep: step as string,
            flowType: ((data as Record<string, unknown>)?.flowType as string) || 'newBusiness',
            formData: mergedFormData,
            stepData: updatedStepData,
            lastSaved: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        return reply.code(201).send({
          success: true,
          message: 'Onboarding form data created successfully',
          data: {
            step,
            kindeUserId,
            email: userEmail,
            formDataId: created.id,
            createdAt: created.createdAt
          }
        });
      }

    } catch (err: unknown) {
      request.log.error(err, 'Error updating onboarding step:');
      return reply.code(500).send({ error: 'Failed to update onboarding step' });
    }
  });
}
