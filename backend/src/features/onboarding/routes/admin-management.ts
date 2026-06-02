import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Logger from '../../../utils/logger.js';
import { authenticateToken, invalidateRoleCache, invalidateUserCache } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments } from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import ErrorResponses from '../../../utils/error-responses.js';
import { kindeService } from '../../../features/auth/index.js';
import { TenantService } from '../../../services/tenant-service.js';

/**
 * Admin Management Routes
 * Handles admin/debug endpoints for onboarding
 */

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

export default async function adminManagementRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // Reset onboarding status (for testing/admin purposes)
  fastify.post('/reset', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = request.userContext as { userId: string };
      const currentUserId = userContext.userId;
      const body = request.body as Record<string, unknown>;
      const { targetUserId } = body;
      const userIdToReset = (targetUserId as string) || currentUserId;

      // Check if current user has permission to reset (admin or self)
      const [currentUser] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, currentUserId))
        .limit(1);

      if (!currentUser) {
        return ErrorResponses.notFound(reply, 'User', 'Current user not found');
      }

      // If resetting another user, check admin permission
      if (targetUserId && (targetUserId as string) !== currentUserId && !currentUser.isTenantAdmin) {
        return reply.code(403).send({ error: 'Only tenant admins can reset other users onboarding' });
      }

      // Reset onboarding status
      const [resetUser] = await db
        .update(tenantUsers)
        .set({
          onboardingCompleted: false,
          updatedAt: new Date()
        })
        .where(eq(tenantUsers.userId, userIdToReset))
        .returning({ kindeUserId: tenantUsers.kindeUserId });

      if (resetUser?.kindeUserId) {
        void invalidateUserCache(resetUser.kindeUserId);
      }

      return {
        success: true,
        message: 'Onboarding status reset successfully',
        data: {
          resetUserId: userIdToReset,
          resetBy: currentUserId,
          resetAt: new Date().toISOString()
        }
      };

    } catch (err: unknown) {
      request.log.error(err, 'Error resetting onboarding status:');
      return reply.code(500).send({ error: 'Failed to reset onboarding status' });
    }
  });

  // SIMPLE: Create Organization Endpoint
  fastify.post('/create-organization', {
    schema: {
      body: {
        type: 'object',
        required: ['companyName', 'subdomain', 'adminEmail', 'adminName'],
        properties: {
          companyName: { type: 'string', minLength: 1, maxLength: 100 },
          subdomain: { type: 'string', minLength: 2, maxLength: 20 },
          industry: { type: 'string' },
          adminEmail: { type: 'string', format: 'email' },
          adminName: { type: 'string', minLength: 1, maxLength: 100 },
          selectedPlan: { type: 'string' },
          planName: { type: 'string' },
          planPrice: { type: 'number' },
          maxUsers: { type: 'number' },
          maxProjects: { type: 'number' },
          teamEmails: {
            type: 'array',
            items: { type: 'string', format: 'email' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const requestId = `onboard_${Date.now()}`;

    try {
      Logger.log('info', 'general', 'create-organization', 'Onboarding started', { requestId, timestamp: new Date().toISOString(), environment: process.env.NODE_ENV, ip: request.ip, userAgent: request.headers['user-agent'] });

      const body = request.body as Record<string, unknown>;
      const {
        companyName,
        subdomain,
        industry,
        adminEmail,
        adminName,
        selectedPlan = 'professional',
        planName,
        planPrice,
        maxUsers,
        maxProjects,
        teamEmails = []
      } = body;

      Logger.log('info', 'general', 'create-organization', 'Onboarding request data', { requestId, companyName, subdomain, industry, adminEmail, adminName, selectedPlan, planName, planPrice, maxUsers, maxProjects, teamEmailsCount: (teamEmails as string[]).length });

      // Get current user from token
      Logger.log('info', 'general', 'create-organization', 'Step 1: Extracting authentication token', { requestId });
      const token = extractToken(request);

      if (!token) {
        Logger.log('error', 'general', 'create-organization', 'Authentication failed: No token provided', { requestId, elapsed: Date.now() - startTime });
        return reply.code(401).send({ error: 'Authentication required' });
      }

      Logger.log('info', 'general', 'create-organization', 'Step 2: Validating token with Kinde', { requestId });

      const kindeUser = await kindeService.validateToken(token);
      const kindeUserId = kindeUser.kindeUserId || kindeUser.userId;

      Logger.log('info', 'general', 'create-organization', 'User authenticated successfully', { requestId, kindeUserId, email: adminEmail });

      // Check if organization already exists
      Logger.log('info', 'general', 'create-organization', 'Step 3: Checking if organization already exists', { requestId, adminEmail });

      const existingTenant = await db
        .select({ tenantId: tenants.tenantId })
        .from(tenants)
        .where(eq(tenants.adminEmail, adminEmail as string))
        .limit(1);

      if (existingTenant.length > 0) {
        Logger.log('error', 'general', 'create-organization', 'Organization already exists for email', { requestId, adminEmail, elapsed: Date.now() - startTime });
        return reply.code(409).send({
          error: 'Organization already exists',
          message: 'This email is already associated with an organization.'
        });
      }

      Logger.log('info', 'general', 'create-organization', 'Step 4: Checking subdomain availability', { requestId, subdomain });

      const available = await TenantService.checkSubdomainAvailability(subdomain as string);

      if (!available) {
        Logger.log('error', 'general', 'create-organization', 'Subdomain unavailable', { requestId, subdomain, elapsed: Date.now() - startTime });
        return reply.code(400).send({
          error: 'Subdomain unavailable',
          message: 'This subdomain is already taken.'
        });
      }

      Logger.log('info', 'general', 'create-organization', 'Step 5: Cleaning up user from existing organizations', { requestId, kindeUserId });

      try {
        const userOrgs = await kindeService.getUserOrganizations(kindeUserId as string);
        const orgsList = userOrgs.organizations as Array<{ code: string; name?: string; is_default?: boolean }> | undefined;
        Logger.log('info', 'general', 'create-organization', 'User organizations response', { requestId, organizationsCount: orgsList?.length || 0 });

        if (userOrgs.organizations && userOrgs.organizations.length > 0) {
          Logger.log('info', 'general', 'create-organization', 'Removing user from all organizations', { requestId, count: userOrgs.organizations.length });

          for (const org of userOrgs.organizations as Array<{ code: string; name?: string; is_default?: boolean }>) {
            Logger.log('info', 'general', 'create-organization', 'Removing user from organization', { requestId, orgCode: org.code });
            try {
              await kindeService.removeUserFromOrganization(kindeUserId as string, org.code);
              Logger.log('info', 'general', 'create-organization', 'Successfully removed from organization', { requestId, orgCode: org.code });
            } catch (removeError: unknown) {
              Logger.log('warning', 'general', 'create-organization', 'Failed to remove user from organization', { requestId, orgCode: org.code, error: (removeError as Error).message });
            }
          }
        }

        Logger.log('info', 'general', 'create-organization', 'Organization cleanup completed', { requestId });
      } catch (cleanupError: unknown) {
        Logger.log('warning', 'general', 'create-organization', 'Organization cleanup failed, continuing with onboarding', { requestId, error: (cleanupError as Error).message });
      }

      // Create new organization
      Logger.log('info', 'general', 'create-organization', 'Step 6: Creating new Kinde organization', { requestId, companyName });

      const kindeOrg = await kindeService.createOrganization({
        name: companyName,
        external_id: `tenant_${Date.now()}`,
        feature_flags: {
          theme: {
            button_text_color: '#ffffff'
          }
        }
      });

      const actualOrgCode = (kindeOrg as { organization?: { code?: string } }).organization?.code;
      if (!actualOrgCode) {
        throw new Error('Failed to get organization code from Kinde response');
      }

      Logger.log('info', 'general', 'create-organization', 'Kinde organization created', { requestId, orgCode: actualOrgCode });

      // Create tenant in database
      Logger.log('info', 'general', 'create-organization', 'Step 7: Creating tenant in database', { requestId });
      const [tenant] = await db
        .insert(tenants)
        .values({
          tenantId: actualOrgCode,
          companyName,
          subdomain,
          kindeOrgId: actualOrgCode,
          adminEmail,
          industry: industry || null,
          onboardingCompleted: false,
          settings: {},
        } as any)
        .returning();

      Logger.log('info', 'general', 'create-organization', 'Tenant created in database', { requestId, tenantId: tenant.tenantId });

      // Create admin user
      Logger.log('info', 'general', 'create-organization', 'Step 8: Creating admin user', { requestId });
      const [adminUser] = await db
        .insert(tenantUsers)
        .values({
          userId: kindeUserId,
          tenantId: tenant.tenantId,
          kindeUserId,
          email: adminEmail,
          name: adminName,
          isActive: true,
          isVerified: true,
          isTenantAdmin: true,
          onboardingCompleted: false,
        } as any)
        .returning();

      Logger.log('info', 'general', 'create-organization', 'Admin user created', { requestId, userId: adminUser.userId });

      // Create admin role
      Logger.log('info', 'general', 'create-organization', 'Step 9: Creating admin role', { requestId });
      // FIXED: Import from permission-matrix.js instead of utils folder
      const { createSuperAdminRoleConfig } = await import('../../../data/permission-matrix.js');
      const roleConfig = createSuperAdminRoleConfig('free', tenant.tenantId, adminUser.userId);
      (roleConfig as Record<string, unknown>).organizationId = tenant.tenantId;
      
      const [adminRole] = await db
        .insert(customRoles)
        .values(roleConfig as any)
        .returning();

      // Assign role to admin user
      await db
        .insert(userRoleAssignments)
        .values({
          userId: adminUser.userId,
          roleId: adminRole.roleId,
          assignedBy: adminUser.userId
        });

      if (adminUser.kindeUserId) {
        void invalidateUserCache(adminUser.kindeUserId);
      }
      void invalidateRoleCache(adminUser.userId);

      Logger.log('info', 'general', 'create-organization', 'Admin role created and assigned', { requestId });

      // Assign user to organization
      Logger.log('info', 'general', 'create-organization', 'Step 10: Assigning user to organization', { requestId });
      try {
        await kindeService.addUserToOrganization(kindeUserId as string, actualOrgCode, { exclusive: true });
        Logger.log('info', 'general', 'create-organization', 'User assigned to organization successfully', { requestId });
      } catch (assignError: unknown) {
        Logger.log('warning', 'general', 'create-organization', 'Organization assignment failed', { requestId, error: (assignError as Error).message });
      }

      const totalTime = Date.now() - startTime;
      Logger.log('info', 'general', 'create-organization', 'Onboarding completed', { requestId, totalTime, companyName, orgCode: actualOrgCode, adminName, adminEmail, selectedPlan });

      return {
        success: true,
        data: {
          tenantId: tenant.tenantId,
          subdomain,
          kindeOrgCode: actualOrgCode,
          organization: {
            id: tenant.tenantId,
            name: companyName,
            subdomain
          },
          user: {
            id: adminUser.userId,
            email: adminEmail,
            name: adminName,
            isAdmin: true
          },
          nextStep: 'setup-profile',
          loginUrl: `https://${process.env.KINDE_DOMAIN}`
        }
      };

    } catch (err: unknown) {
      const error = err as Error;
      const totalTime = Date.now() - startTime;
      const body = request.body as Record<string, unknown>;
      Logger.log('error', 'general', 'create-organization', 'Onboarding failed', { requestId, totalTime, adminEmail: body?.adminEmail, companyName: body?.companyName, error: error.message });

      request.log.error(error, 'Error during organization creation:');
      return reply.code(500).send({
        error: 'Failed to create organization',
        message: error.message
      });
    }
  });
}
