import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
          onboardingStep: null,
          updatedAt: new Date()
        })
        .where(eq(tenantUsers.userId, userIdToReset))
        .returning({ kindeUserId: tenantUsers.kindeUserId });

      if (resetUser?.kindeUserId) {
        invalidateUserCache(resetUser.kindeUserId);
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
  fastify.post('/organizations', {
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
      console.log('\n🚀 =================== ONBOARDING STARTED ===================');
      console.log(`📋 Request ID: ${requestId}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 User IP: ${request.ip}`);
      console.log(`🖥️ User Agent: ${request.headers['user-agent']}`);

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

      console.log('📦 Onboarding Request Data:', {
        requestId,
        companyName,
        subdomain,
        industry,
        adminEmail,
        adminName,
        selectedPlan,
        planName,
        planPrice,
        maxUsers,
        maxProjects,
        teamEmailsCount: (teamEmails as string[]).length,
        teamEmails: (teamEmails as string[]).slice(0, 3) // Log first 3 emails only for privacy
      });

      // Get current user from token
      console.log(`🔐 [${requestId}] Step 1: Extracting authentication token...`);
      const token = extractToken(request);

      if (!token) {
        console.error(`❌ [${requestId}] Authentication failed: No token provided`);
        console.log(`⏱️ [${requestId}] Onboarding failed after ${Date.now() - startTime}ms`);
        return reply.code(401).send({ error: 'Authentication required' });
      }

      console.log(`✅ [${requestId}] Token extracted successfully`);
      console.log(`🔍 [${requestId}] Step 2: Validating token with Kinde...`);

      const kindeUser = await kindeService.validateToken(token);
      const kindeUserId = kindeUser.kindeUserId || kindeUser.userId;

      console.log(`✅ [${requestId}] User authenticated successfully:`, {
        kindeUserId,
        email: adminEmail,
        tokenValid: true,
        kindeResponse: {
          id: kindeUser.id,
          email: kindeUser.email,
          given_name: kindeUser.given_name,
          family_name: kindeUser.family_name
        }
      });

      // Check if organization already exists
      console.log(`🔍 [${requestId}] Step 3: Checking if organization already exists...`);
      console.log(`📧 [${requestId}] Checking email: ${adminEmail}`);

      const existingTenant = await db
        .select({ tenantId: tenants.tenantId })
        .from(tenants)
        .where(eq(tenants.adminEmail, adminEmail as string))
        .limit(1);

      if (existingTenant.length > 0) {
        console.error(`❌ [${requestId}] Organization already exists for email: ${adminEmail}`);
        console.log(`⏱️ [${requestId}] Onboarding failed after ${Date.now() - startTime}ms`);
        return reply.code(409).send({
          error: 'Organization already exists',
          message: 'This email is already associated with an organization.'
        });
      }

      console.log(`✅ [${requestId}] Email available for new organization`);

      // Check subdomain availability
      console.log(`🔍 [${requestId}] Step 4: Checking subdomain availability...`);
      console.log(`🏷️ [${requestId}] Checking subdomain: ${subdomain}`);

      const available = await TenantService.checkSubdomainAvailability(subdomain as string);

      if (!available) {
        console.error(`❌ [${requestId}] Subdomain unavailable: ${subdomain}`);
        console.log(`⏱️ [${requestId}] Onboarding failed after ${Date.now() - startTime}ms`);
        return reply.code(400).send({
          error: 'Subdomain unavailable',
          message: 'This subdomain is already taken.'
        });
      }

      console.log(`✅ [${requestId}] Subdomain available: ${subdomain}`);

      // 🎯 CRITICAL: Remove user from ALL current organizations first
      console.log(`🧹 [${requestId}] Step 5: Cleaning up user from existing organizations...`);
      console.log(`👤 [${requestId}] User ID: ${kindeUserId}`);

      try {
        const userOrgs = await kindeService.getUserOrganizations(kindeUserId as string);
        const orgsList = userOrgs.organizations as Array<{ code: string; name?: string; is_default?: boolean }> | undefined;
        console.log(`🔍 [${requestId}] User organizations response:`, {
          organizationsCount: orgsList?.length || 0,
          organizations: orgsList?.map((org) => ({
            code: org.code,
            name: org.name,
            is_default: org.is_default
          }))
        });

        if (userOrgs.organizations && userOrgs.organizations.length > 0) {
          console.log(`📋 [${requestId}] User is in ${userOrgs.organizations.length} organizations, removing all...`);

          for (const org of userOrgs.organizations as Array<{ code: string; name?: string; is_default?: boolean }>) {
            console.log(`🗑️ [${requestId}] Removing user from organization: ${org.code}`);
            try {
              await kindeService.removeUserFromOrganization(kindeUserId as string, org.code);
              console.log(`✅ [${requestId}] Successfully removed from: ${org.code}`);
            } catch (removeError: unknown) {
              console.warn(`⚠️ [${requestId}] Failed to remove from ${org.code}:`, (removeError as Error).message);
            }
          }
        }

        console.log(`✅ [${requestId}] Organization cleanup completed`);
      } catch (cleanupError: unknown) {
        console.warn(`⚠️ [${requestId}] Organization cleanup failed:`, (cleanupError as Error).message);
        console.log(`🔄 [${requestId}] Continuing with onboarding despite cleanup failure`);
      }

      // Create new organization
      console.log(`🏗️ [${requestId}] Step 6: Creating new Kinde organization...`);
      console.log(`🏢 [${requestId}] Organization name: ${companyName}`);

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

      console.log(`✅ [${requestId}] Kinde organization created: ${actualOrgCode}`);

      // Create tenant in database
      console.log(`💾 [${requestId}] Step 7: Creating tenant in database...`);
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
          onboardingStep: '1',
          trialStartedAt: new Date(),
          trialStatus: 'active',
          subscriptionStatus: 'trial',
          featuresEnabled: { crm: true, users: true, roles: true, dashboard: true },
          initialSetupData: { selectedPlan, planName, planPrice, maxUsers, maxProjects, teamInviteCount: (teamEmails as string[]).length }
        } as any)
        .returning();

      console.log(`✅ [${requestId}] Tenant created in database: ${tenant.tenantId}`);

      // Create admin user
      console.log(`👤 [${requestId}] Step 8: Creating admin user...`);
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
          onboardingStep: '1'
        } as any)
        .returning();

      console.log(`✅ [${requestId}] Admin user created: ${adminUser.userId}`);

      // Create admin role
      console.log(`🔐 [${requestId}] Step 9: Creating admin role...`);
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
        invalidateUserCache(adminUser.kindeUserId);
      }
      invalidateRoleCache(adminUser.userId);

      console.log(`✅ [${requestId}] Admin role created and assigned`);

      // Assign user to organization
      console.log(`🔗 [${requestId}] Step 10: Assigning user to organization...`);
      try {
        await kindeService.addUserToOrganization(kindeUserId as string, actualOrgCode, { exclusive: true });
        console.log(`✅ [${requestId}] User assigned to organization successfully`);
      } catch (assignError: unknown) {
        console.warn(`⚠️ [${requestId}] Organization assignment failed:`, (assignError as Error).message);
      }

      const totalTime = Date.now() - startTime;
      console.log(`\n🎉 =================== ONBOARDING COMPLETED ===================`);
      console.log(`📋 Request ID: ${requestId}`);
      console.log(`⏱️ Total Time: ${totalTime}ms`);
      console.log(`🏢 Organization: ${companyName} (${actualOrgCode})`);
      console.log(`👤 Admin User: ${adminName} (${adminEmail})`);
      console.log(`📊 Plan: ${selectedPlan}`);
      console.log(`==========================================================\n`);

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
      console.error(`\n❌ =================== ONBOARDING FAILED ===================`);
      console.error(`📋 Request ID: ${requestId}`);
      console.error(`⏱️ Failed after ${totalTime}ms`);
      console.error(`📧 Admin Email: ${body?.adminEmail}`);
      console.error(`🏢 Company: ${body?.companyName}`);
      console.error(`🔍 Error: ${error.message}`);
      console.error(`==========================================================\n`);

      request.log.error(error, 'Error during organization creation:');
      return reply.code(500).send({
        error: 'Failed to create organization',
        message: error.message
      });
    }
  });
}
