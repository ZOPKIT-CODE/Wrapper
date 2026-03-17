import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

type RequestContextLike = Record<string, unknown> & { ip?: string; headers?: Record<string, string | undefined>; connection?: { remoteAddress?: string } };
import { TenantService } from '../../../services/tenant-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, userRoleAssignments, customRoles, tenantInvitations, entities, organizationMemberships, subscriptions, creditPurchases } from '../../../db/schema/index.js';
import { and, eq, sql, inArray, desc } from 'drizzle-orm';
import ErrorResponses from '../../../utils/error-responses.js';
import { randomUUID } from 'crypto';
import ActivityLogger, { ACTIVITY_TYPES, RESOURCE_TYPES } from '../../../services/activityLogger.js';
import { OrganizationAssignmentService } from '../../organizations/index.js';

export default async function tenantRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // List all tenants (Authenticated users only)
  fastify.get('/', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantsList = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          isActive: tenants.isActive,
          createdAt: tenants.createdAt,
          adminEmail: tenants.adminEmail,
          trialStartedAt: tenants.trialStartedAt,
          trialEndsAt: tenants.trialEndsAt
        })
        .from(tenants)
        .orderBy(tenants.createdAt);

      return {
        success: true,
        tenants: tenantsList
      };
    } catch (error) {
      request.log.error(error, 'Error fetching tenants:');
      return reply.code(500).send({ error: 'Failed to fetch tenants' });
    }
  });

  // Get current tenant info
  fastify.get('/current', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      // Use tenantId directly from userContext
      const tenantId = request.userContext.tenantId;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }
      
      const details = await TenantService.getTenantDetails(tenantId);
      
      return {
        success: true,
        data: details
      };
    } catch (error) {
      request.log.error(error, 'Error fetching current tenant:');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Helper function to convert activity action to human-readable label
  const getActivityLabel = (action: string): string => {
    const actionMap: Record<string, string> = {
      'tenant.settings_updated': 'Tenant settings updated',
      'tenant.viewed': 'Tenant viewed',
      'user.invited': 'User invited',
      'user.created': 'User created',
      'user.updated': 'User updated',
      'user.deleted': 'User deleted',
      'user.activated': 'User activated',
      'user.deactivated': 'User deactivated',
      'user.profile_updated': 'User profile updated',
      'auth.login': 'User logged in',
      'auth.logout': 'User logged out',
      'billing.payment_success': 'Payment succeeded',
      'billing.payment_failed': 'Payment failed',
      'billing.subscription_created': 'Subscription created',
      'billing.subscription_updated': 'Subscription updated',
      'billing.subscription_cancelled': 'Subscription cancelled',
      'payment.upgraded': 'Plan upgraded',
      'payment.upgrade_success': 'Upgrade successful',
      'credit.purchase_success': 'Credit purchase successful',
      'credit.allocated': 'Credits allocated',
      'subscription.viewed': 'Subscription viewed',
      'subscription.created': 'Subscription created',
      'subscription.updated': 'Subscription updated',
      'subscription.cancelled': 'Subscription cancelled',
      'entity.created': 'Entity created',
      'entity.updated': 'Entity updated',
      'entity.deleted': 'Entity deleted',
      'role.created': 'Role created',
      'role.updated': 'Role updated',
      'role.assigned': 'Role assigned',
      'role.removed': 'Role removed',
      'invitation.sent': 'Invitation sent',
      'invitation.cancelled': 'Invitation cancelled',
      'location.created': 'Location created',
      'location.updated': 'Location updated',
      'location.deleted': 'Location deleted',
      'data.export': 'Data exported',
      'data.import': 'Data imported'
    };

    if (actionMap[action]) {
      return actionMap[action];
    }

    // Generic fallback: convert snake_case to Title Case
    return action
      .split('.')
      .map((part: string) => part.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
      .join(' - ');
  };

  // Get user journey timeline
  fastify.get('/current/timeline', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const userId = request.userContext.internalUserId;
      const query = request.query as Record<string, string>;
      const { limit = '20', offset = '0', includeActivity = 'true' } = query;
      const shouldIncludeActivity = includeActivity === 'true';
      const parsedLimit = parseInt(limit) || 20;
      const parsedOffset = parseInt(offset) || 0;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      const events = [];

      // 1. Get tenant lifecycle dates
      const [tenant] = await db
        .select({
          createdAt: tenants.createdAt,
          onboardingStartedAt: tenants.onboardingStartedAt,
          onboardedAt: tenants.onboardedAt,
          trialStartedAt: tenants.trialStartedAt,
          trialEndsAt: tenants.trialEndsAt
        })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId ?? ''))
        .limit(1);

      if (tenant) {
        // Account created
        if (tenant.createdAt) {
          events.push({
            type: 'account_created',
            label: 'Account created',
            date: tenant.createdAt.toISOString(),
            metadata: {}
          });
        }

        // Onboarding started
        if (tenant.onboardingStartedAt) {
          events.push({
            type: 'onboarding_started',
            label: 'Onboarding started',
            date: tenant.onboardingStartedAt.toISOString(),
            metadata: {}
          });
        }

        // Onboarding completed
        if (tenant.onboardedAt) {
          events.push({
            type: 'onboarding_completed',
            label: 'Onboarding completed',
            date: tenant.onboardedAt.toISOString(),
            metadata: {}
          });
        }

        // Trial started
        if (tenant.trialStartedAt) {
          events.push({
            type: 'trial_started',
            label: 'Trial started',
            date: tenant.trialStartedAt.toISOString(),
            metadata: {}
          });
        }

        // Trial ended
        if (tenant.trialEndsAt) {
          events.push({
            type: 'trial_ended',
            label: 'Trial ended',
            date: tenant.trialEndsAt.toISOString(),
            metadata: {}
          });
        }
      }

      // 2. Get subscription (plan start)
      const [subscription] = await db
        .select({
          createdAt: subscriptions.createdAt,
          plan: subscriptions.plan
        })
        .from(subscriptions)
        .where(and(
          eq(subscriptions.tenantId, tenantId ?? ''),
          eq(subscriptions.status, 'active')
        ))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (subscription && subscription.createdAt) {
        const planNameMap: Record<string, string> = {
          'free': 'Free',
          'starter': 'Starter',
          'professional': 'Professional',
          'premium': 'Premium',
          'enterprise': 'Enterprise',
          'standard': 'Standard',
          'credit_based': 'Free'
        };
        const planKey = subscription.plan as string;
        const planDisplayName = planNameMap[planKey] ?? (planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : 'Unknown');

        events.push({
          type: 'plan_started',
          label: `Started ${planDisplayName} plan`,
          date: subscription.createdAt.toISOString(),
          metadata: {
            plan: subscription.plan,
            planDisplayName
          }
        });
      }

      // 3. Get credit purchases
      const creditPurchasesList = await db
        .select({
          createdAt: creditPurchases.createdAt,
          paidAt: creditPurchases.paidAt,
          creditAmount: creditPurchases.creditAmount,
          totalAmount: creditPurchases.totalAmount,
          status: creditPurchases.status
        })
        .from(creditPurchases)
        .where(eq(creditPurchases.tenantId, tenantId ?? ''))
        .orderBy(desc(creditPurchases.paidAt), desc(creditPurchases.createdAt))
        .limit(50);

      for (const purchase of creditPurchasesList) {
        const purchaseDate = purchase.paidAt ?? purchase.createdAt;
        if (purchaseDate && purchase.status === 'completed') {
          const credits = parseFloat(String(purchase.creditAmount ?? 0));
          const amount = parseFloat(String(purchase.totalAmount ?? 0));

          events.push({
            type: 'credit_purchase',
            label: `Credit purchase: ${credits.toLocaleString()} credits`,
            date: purchaseDate.toISOString(),
            metadata: {
              credits,
              amount,
              status: purchase.status
            }
          });
        }
      }

      // 4. Get user activity logs (if userId is available and includeActivity is true)
      let activityTotal = 0;
      if (shouldIncludeActivity && userId) {
        try {
          const activityResult = await ActivityLogger.getUserActivity(userId, tenantId, {
            limit: parsedLimit,
            offset: parsedOffset,
            includeMetadata: true
          });

          activityTotal = activityResult?.pagination?.total ?? 0;

          if (activityResult && activityResult.activities) {
            for (const activity of activityResult.activities as Array<{ action: string; createdAt?: Date; appName?: string; appCode?: string; userInfo?: Record<string, unknown>; ipAddress?: string | null }>) {
              if (activity.createdAt) {
                events.push({
                  type: 'activity',
                  label: getActivityLabel(activity.action),
                  date: activity.createdAt.toISOString(),
                  metadata: {
                    action: activity.action,
                    appName: activity.appName ?? 'System',
                    appCode: activity.appCode ?? 'system',
                    userInfo: activity.userInfo ?? {},
                    ipAddress: activity.ipAddress ?? null
                  }
                });
              }
            }
          }
        } catch (err) {
          const activityError = err as Error;
          request.log.warn(`Failed to fetch activity logs for timeline: ${activityError.message}`);
        }
      }

      // Sort events by date ascending (oldest first)
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Add "Today" marker at the end
      events.push({
        type: 'today',
        label: 'Today',
        date: new Date().toISOString(),
        metadata: {}
      });

      const hasMore = parsedOffset + parsedLimit < activityTotal;

      return {
        success: true,
        data: {
          events,
          pagination: {
            offset: parsedOffset,
            limit: parsedLimit,
            activityTotal,
            hasMore
          }
        }
      };
    } catch (error) {
      request.log.error(error, 'Error fetching timeline:');
      return reply.code(500).send({ error: 'Failed to fetch timeline' });
    }
  });

  // Update tenant settings (full update)
  fastify.put('/current/settings', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      const body = request.body as Record<string, unknown>;
      const updatedTenant = await TenantService.updateTenant(
        tenantId,
        body
      );

      // Log tenant settings update activity
      await ActivityLogger.logActivity(
        request.userContext.internalUserId ?? '',
        tenantId,
        null,
        ACTIVITY_TYPES.TENANT_SETTINGS_UPDATED,
        {
          updatedFields: Object.keys(body),
          tenantId: tenantId,
          userEmail: request.userContext.email
        },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return {
        success: true,
        data: updatedTenant,
        message: 'Tenant settings updated successfully'
      };
    } catch (error) {
      request.log.error(error, 'Error updating tenant settings:');
      return reply.code(500).send({ error: 'Failed to update tenant settings' });
    }
  });

  // Update tenant account details (partial update - PATCH)
  fastify.patch('/current', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      // Prepare update data - only include fields that are provided.
      // allowedFields must stay in sync with frontend AccountSettings so all settings work for every tenant.
      const updateData: Record<string, unknown> = {};
      const allowedFields = [
        'legalCompanyName', 'logoUrl', 'billingEmail', 'supportEmail',
        'contactSalutation', 'contactMiddleName', 'contactDepartment',
        'contactJobTitle', 'contactDirectPhone', 'contactMobilePhone',
        'contactPreferredContactMethod', 'contactAuthorityLevel',
        'preferredContactMethod', 'mailingAddressSameAsRegistered',
        'mailingStreet', 'mailingCity', 'mailingState', 'mailingZip',
        'mailingCountry', 'taxRegistrationDetails', 'primaryColor',
        'customDomain', 'brandingConfig',
        // Banking fields
        'bankName', 'bankBranch', 'accountHolderName', 'accountNumber',
        'accountType', 'bankAccountCurrency', 'swiftBicCode', 'iban',
        'routingNumberUs', 'sortCodeUk', 'ifscCodeIndia', 'bsbNumberAustralia',
        'paymentTerms', 'creditLimit', 'preferredPaymentMethod',
        // Tax & Compliance fields
        'taxResidenceCountry', 'taxRegistered', 'vatGstRegistered', 'billingCountry',
        'taxExemptStatus', 'taxExemptionCertificateNumber',
        'taxExemptionExpiryDate', 'withholdingTaxApplicable', 'withholdingTaxRate',
        'taxTreatyCountry', 'w9StatusUs', 'w8FormTypeUs', 'reverseChargeMechanism',
        'vatGstRateApplicable', 'regulatoryComplianceStatus', 'industrySpecificLicenses',
        'dataProtectionRegistration', 'professionalIndemnityInsurance',
        'insurancePolicyNumber', 'insuranceExpiryDate',
        // Localization fields
        'defaultLanguage', 'defaultLocale', 'defaultCurrency', 'defaultTimeZone',
        'fiscalYearStartMonth', 'fiscalYearEndMonth', 'fiscalYearStartDay', 'fiscalYearEndDay'
      ];

      // Only include fields that are present in request body
      const body = request.body as Record<string, unknown>;
      allowedFields.forEach(field => {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      });

      // Add updatedAt timestamp
      updateData.updatedAt = new Date();

      const updatedTenant = await TenantService.updateTenant(
        tenantId,
        updateData
      );

      // Log tenant account update activity
      await ActivityLogger.logActivity(
        request.userContext.internalUserId ?? '',
        tenantId,
        null,
        ACTIVITY_TYPES.TENANT_SETTINGS_UPDATED,
        {
          updatedFields: Object.keys(updateData),
          tenantId: tenantId,
          userEmail: request.userContext.email
        },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return {
        success: true,
        data: updatedTenant,
        message: 'Account settings updated successfully'
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error updating account settings:');
      return reply.code(500).send({ 
        error: 'Failed to update account settings',
        message: error.message 
      });
    }
  });

  // Get tenant users
  fastify.get('/current/users', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      // Use tenantId directly from userContext since auth middleware already resolved it
      const tenantId = request.userContext.tenantId;
      const query = request.query as Record<string, string>;
      const { entityId } = query;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      // If entityId is provided, filter users by entity
      const users = entityId
        ? await TenantService.getTenantUsersByEntity(tenantId, entityId)
        : await TenantService.getTenantUsers(tenantId);

      return {
        success: true,
        data: users,
        filteredByEntity: !!entityId,
        entityId: entityId || null
      };
    } catch (error) {
      request.log.error(error, 'Error fetching tenant users:');
      return reply.code(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Invite user to tenant
  fastify.post('/current/users/invite', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      const body = request.body as Record<string, unknown>;
      const { email, roleId, message, organizationId } = body;
      const organizationIdStr = organizationId as string | undefined;

      // Validate organization if provided
      if (organizationIdStr) {
        const organization = await db
          .select()
          .from(entities)
          .where(and(
            eq(entities.entityId, organizationIdStr),
            eq(entities.tenantId, tenantId ?? ''),
            eq(entities.isActive, true)
          ))
          .limit(1);

        if (organization.length === 0) {
          return reply.code(404).send({
            success: false,
            message: 'Organization not found in this tenant'
          });
        }
      }

      const invitation = await TenantService.inviteUser({
        tenantId: tenantId,
        email: email as string,
        roleId: (roleId as string | null | undefined) ?? undefined,
        invitedBy: request.userContext?.internalUserId ?? '',
        message: message as string | undefined,
        primaryEntityId: organizationIdStr ?? undefined
      });

      // Log user invitation activity
      await ActivityLogger.logActivity(
        request.userContext.internalUserId ?? '',
        tenantId,
        null,
        ACTIVITY_TYPES.TENANT_USER_INVITED,
        {
          invitedEmail: email,
          roleId: roleId,
          invitationId: (invitation as { invitationId?: string })?.invitationId,
          tenantId: tenantId,
          userEmail: request.userContext.email
        },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return {
        success: true,
        data: invitation,
        message: 'User invitation sent successfully'
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error inviting user:');
      if (error.message?.includes('already exists')) {
        return reply.code(409).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to send invitation' });
    }
  });

  // Accept invitation
  fastify.post('/invite/:token/accept', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const params = request.params as Record<string, string>;
      const { token } = params;
      
      const result = await TenantService.acceptInvitation(
        token,
        request.userContext.kindeUserId ?? '',
        {
          email: request.userContext.email,
          name: request.userContext.name,
          avatar: (request.userContext as { avatar?: string }).avatar
        }
      );
      
      return {
        success: true,
        data: result,
        message: 'Invitation accepted successfully'
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error accepting invitation:');
      if (error.message?.includes('Invalid') || error.message?.includes('expired')) {
        return reply.code(400).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to accept invitation' });
    }
  });

  // Get pending invitations
  fastify.get('/current/invitations', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      const invitations = await TenantService.getPendingInvitations(tenantId);
      
      return {
        success: true,
        data: invitations
      };
    } catch (error) {
      request.log.error(error, 'Error fetching invitations:');
      return reply.code(500).send({ error: 'Failed to fetch invitations' });
    }
  });

  // Cancel invitation
  fastify.delete('/current/invitations/:invitationId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const params = request.params as Record<string, string>;
      const { invitationId } = params;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      // Check if user has permission to cancel invitations
      if (!request.userContext.isTenantAdmin) {
        return reply.code(403).send({ 
          error: 'Forbidden',
          message: 'Only tenant administrators can cancel invitations'
        });
      }

      const result = await TenantService.cancelInvitation(
        tenantId,
        invitationId,
        request.userContext.internalUserId ?? ''
      );
      
      return {
        success: true,
        message: result.message
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error cancelling invitation:');
      
      if (error.message?.includes('not found')) {
        return reply.code(404).send({ 
          error: 'Invitation not found',
          message: error.message
        });
      }
      
      if (error.message?.includes('pending')) {
        return reply.code(400).send({ 
          error: 'Invalid invitation status',
          message: error.message
        });
      }
      
      return reply.code(500).send({ error: 'Failed to cancel invitation' });
    }
  });

  // Resend invitation email
  fastify.post('/current/invitations/:id/resend', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      const params = request.params as Record<string, string>;
      const result = await TenantService.resendInvitationEmail(params.id, tenantId);
      
      return {
        success: true,
        data: result,
        message: 'Invitation email resent successfully'
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error resending invitation:');
      if (error.message?.includes('not found') || error.message?.includes('expired')) {
        return reply.code(400).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to resend invitation' });
    }
  });

  // Update user role/permissions
  fastify.put('/current/users/:userId/role', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const role = body.role as string;
      
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      if (!role) {
        return reply.code(400).send({ error: 'Role is required' });
      }

      // Get role ID from role name
      const [roleRecord] = await db
        .select()
        .from(customRoles)
        .where(and(
          eq(customRoles.roleName, role),
          eq(customRoles.tenantId, tenantId ?? '')
        ))
        .limit(1);

      if (!roleRecord) {
        return reply.code(404).send({ error: 'Role not found' });
      }

      const result = await TenantService.updateUserRole(userId, roleRecord.roleId, tenantId);

      // Log user role update activity
      await ActivityLogger.logActivity(
        request.userContext.internalUserId ?? '',
        tenantId,
        null,
        ACTIVITY_TYPES.USER_PROMOTED,
        {
          targetUserId: userId,
          newRoleId: roleRecord.roleId,
          newRoleName: role,
          tenantId: tenantId,
          userEmail: request.userContext.email
        },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return {
        success: true,
        message: result.message,
        data: result.data
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error updating user role:');
      if (error.message?.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to update user role' });
    }
  });

  // Remove user from tenant
  fastify.delete('/current/users/:userId', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const { userId } = params;
    console.log('🗑️ DELETE /current/users/:userId hit', {
      userId,
      tenantId: request.userContext?.tenantId,
      isAuthenticated: !!request.userContext?.isAuthenticated,
      isTenantAdmin: request.userContext?.isTenantAdmin,
      internalUserId: request.userContext?.internalUserId
    });

    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    try {
      const tenantId = request.userContext.tenantId;

      if (!userId) {
        return reply.code(400).send({
          success: false,
          error: 'Bad request',
          message: 'User ID is required'
        });
      }

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      // Check if user has permission to remove users (tenant admin)
      if (!request.userContext.isTenantAdmin) {
        console.log('🗑️ Delete rejected: user is not tenant admin');
        return reply.code(403).send({
          success: false,
          error: 'Forbidden',
          message: 'Only tenant administrators can remove users'
        });
      }

      console.log('🗑️ Calling TenantService.removeUser', { tenantId, userId });
      const result = await TenantService.removeUser(
        tenantId,
        userId,
        request.userContext.internalUserId ?? ''
      );

      console.log('🗑️ User removed successfully', { userId, tenantId });
      return {
        success: true,
        message: result?.message ?? 'User removed successfully'
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error removing user:');

      if (error.message?.includes('last admin')) {
        return reply.code(400).send({
          success: false,
          error: 'Cannot remove last admin',
          message: error.message
        });
      }

      if (error.message?.includes('not found') || error.message?.includes('User not found')) {
        return reply.code(404).send({
          success: false,
          error: 'User not found',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to remove user',
        message: error.message || 'Failed to remove user'
      });
    }
  });

  // Get tenant usage statistics (placeholder - implement getTenantUsage in TenantService if needed)
  fastify.get('/usage', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ANALYTICS_DATA_READ)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { period, startDate, endDate } = query;
      const tenantId = (request as FastifyRequest & { userContext?: { tenantId?: string } }).userContext?.tenantId;
      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const usage = await (TenantService as { getTenantUsage?: (tid: string, opts: Record<string, unknown>) => Promise<Record<string, unknown>> }).getTenantUsage?.(tenantId, {
        period,
        startDate,
        endDate
      }) ?? { period, startDate, endDate, summary: {} };
      
      return {
        success: true,
        data: usage
      };
    } catch (err) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching tenant usage:');
      return reply.code(500).send({ error: 'Failed to fetch usage statistics' });
    }
  });

  // Promote user to admin
  fastify.post('/current/users/:userId/promote', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Only admins can promote users
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const tenantId = request.userContext.tenantId;

      // Update user to admin
      const [updatedUser] = await db
        .update(tenantUsers)
        .set({ 
          isTenantAdmin: true,
          updatedAt: new Date()
        } as Record<string, unknown>)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .returning();

      if (!updatedUser) {
        return ErrorResponses.notFound(reply, 'User', 'User not found');
      }

      return {
        success: true,
        message: 'User promoted to admin successfully',
        data: updatedUser
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error promoting user:');
      return reply.code(500).send({ error: 'Failed to promote user' });
    }
  });

  // Deactivate user
  fastify.post('/current/users/:userId/deactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Only admins can deactivate users
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const tenantId = request.userContext.tenantId;

      // Prevent self-deactivation
      if (userId === request.userContext.internalUserId) {
        return reply.code(400).send({ error: 'Cannot deactivate yourself' });
      }

      // Update user to inactive
      const [updatedUser] = await db
        .update(tenantUsers)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        } as Record<string, unknown>)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .returning();

      if (!updatedUser) {
        return ErrorResponses.notFound(reply, 'User', 'User not found');
      }

      // Publish user deactivation event to AWS MQ
      try {
        const { amazonMQPublisher } = await import('../../messaging/utils/amazon-mq-publisher.js');
        await amazonMQPublisher.publishUserEventToSuite('user_deactivated', tenantId ?? '', updatedUser.userId, {
          userId: updatedUser.userId,
          email: updatedUser.email,
          firstName: updatedUser.name?.split(' ')[0],
          lastName: updatedUser.name?.split(' ').slice(1).join(' ') || '',
          name: updatedUser.name,
          deactivatedAt: new Date().toISOString(),
          deactivatedBy: request.userContext.internalUserId,
          reason: 'manual_deactivation'
        });
        console.log('📡 Published user_deactivated event to Redis streams');
      } catch (publishErr) {
        const publishError = publishErr as Error;
        console.warn('⚠️ Failed to publish user_deactivated event:', publishError.message);
        // Don't fail the request if event publishing fails
      }

      return {
        success: true,
        message: 'User deactivated successfully',
        data: updatedUser
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error deactivating user:');
      return reply.code(500).send({ error: 'Failed to deactivate user' });
    }
  });

  // Reactivate user
  fastify.post('/current/users/:userId/reactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Only admins can reactivate users
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const tenantId = request.userContext.tenantId;

      // Update user to active
      const [updatedUser] = await db
        .update(tenantUsers)
        .set({ 
          isActive: true,
          updatedAt: new Date()
        } as Record<string, unknown>)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .returning();

      if (!updatedUser) {
        return ErrorResponses.notFound(reply, 'User', 'User not found');
      }

      return {
        success: true,
        message: 'User reactivated successfully',
        data: updatedUser
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error reactivating user:');
      return reply.code(500).send({ error: 'Failed to reactivate user' });
    }
  });

  // Update user details
  fastify.put('/current/users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Only admins can update other users, users can update themselves
    const params = request.params as Record<string, string>;
    const { userId } = params;
    const isUpdatingSelf = userId === request.userContext?.internalUserId;
    const isAdmin = request.userContext?.isAdmin || request.userContext?.isTenantAdmin;

    if (!isUpdatingSelf && !isAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const body = request.body as Record<string, unknown>;
      const { name, email, title, department, isActive, isTenantAdmin } = body;

      // Build update object - only include provided fields
      const updateData: Record<string, unknown> = {
        updatedAt: new Date()
      };

      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (title !== undefined) updateData.title = title;
      if (department !== undefined) updateData.department = department;
      
      // Only admins can change these fields
      if (isAdmin && !isUpdatingSelf) {
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isTenantAdmin !== undefined) updateData.isTenantAdmin = isTenantAdmin;
      }

      // Update user
      const [updatedUser] = await db
        .update(tenantUsers)
        .set(updateData as Record<string, unknown>)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .returning();

      if (!updatedUser) {
        return ErrorResponses.notFound(reply, 'User', 'User not found');
      }

      return {
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error updating user:');
      return reply.code(500).send({ error: 'Failed to update user' });
    }
  });

  // Note: User deletion is now handled by the unified TenantService.deleteUser() method above

  // Resend invitation
  fastify.post('/current/users/:userId/resend-invite', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const tenantId = request.userContext.tenantId;

      // Get user details
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .limit(1);

      if (!user) {
        return ErrorResponses.notFound(reply, 'User', 'User not found');
      }

      // Check if user has already completed onboarding
      if (user.onboardingCompleted) {
        return reply.code(400).send({ 
          error: 'User has already completed onboarding',
          message: 'Cannot resend invitation to users who have already joined'
        });
      }

      // Import EmailService
      const { default: EmailService } = await import('../../../utils/email.js');
      
      // Get tenant details for email
      const tenantDetails = await TenantService.getTenantDetails(tenantId ?? '');
      
      // Check for existing pending invitation
      const [existingInvitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.tenantId, tenantId ?? ''),
          eq(tenantInvitations.email, user.email),
          eq(tenantInvitations.status, 'pending')
        ))
        .limit(1);

      let invitationToken: string | undefined;
      let invitationId: string | undefined;

      if (existingInvitation) {
        // Use existing invitation
        invitationToken = existingInvitation.invitationToken;
        invitationId = existingInvitation.invitationId;
        
        // Update expiry to 7 days from now
        await db
          .update(tenantInvitations)
          .set({ 
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          } as Record<string, unknown>)
          .where(eq(tenantInvitations.invitationId, invitationId));
          
        console.log(`🔄 Resending existing invitation ${invitationId} to ${user.email}`);
      } else {
        // Create new invitation
        invitationToken = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const [newInvitation] = await db
          .insert(tenantInvitations)
          .values({
            tenantId: tenantId ?? '',
            email: user.email,
            invitedBy: request.userContext?.internalUserId ?? '',
            invitationToken: invitationToken ?? '',
            expiresAt,
            status: 'pending'
          } as any)
          .returning();
          
        invitationId = newInvitation.invitationId;
        console.log(`📧 Created new invitation ${invitationId} for ${user.email}`);
      }

      // Get inviter's name
      const inviterName = request.userContext.name || request.userContext.email || 'Team Administrator';
      
      // Send invitation email
      try {
        const invitePayload = {
          email: user.email,
          tenantName: tenantDetails.companyName,
          roleName: 'Team Member',
          invitationToken: (invitationToken ?? '') as string,
          invitedByName: inviterName,
          message: `You're invited to join ${tenantDetails.companyName} on Wrapper. Please accept this invitation to get started.`
        };
        const emailResult = await EmailService.sendUserInvitation(invitePayload as { email: string; tenantName: string; roleName: string; invitationToken: string; invitedByName: string; message?: string });

        if (emailResult.success) {
          console.log(`✅ Invitation email sent successfully to ${user.email}`);
          
          return {
            success: true,
            message: `Invitation resent to ${user.email}`,
            data: { 
              email: user.email,
              invitationId,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          };
        } else {
          console.error(`❌ Failed to send invitation email to ${user.email}:`, emailResult.error);
          return reply.code(500).send({ 
            error: 'Failed to send invitation email',
            message: 'Email service error occurred'
          });
        }
      } catch (emailErr) {
        console.error(`❌ Error sending invitation email to ${user.email}:`, emailErr);
        return reply.code(500).send({ 
          error: 'Failed to send invitation email',
          message: 'Email service error occurred'
        });
      }
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error resending invitation:');
      return reply.code(500).send({ error: 'Failed to resend invitation' });
    }
  });

  // Assign roles to user
  fastify.post('/current/users/:userId/assign-roles', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Only admins can assign roles
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const { roleIds } = body;
      const tenantId = request.userContext.tenantId;

      console.log(`🔄 Role assignment request:`, {
        userId,
        roleIds,
        tenantId,
        assignedBy: request.userContext.internalUserId
      });

      if (!Array.isArray(roleIds)) {
        return reply.code(400).send({ error: 'roleIds must be an array' });
      }

      // Verify user exists in this tenant
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .limit(1);

      if (!user) {
        return ErrorResponses.notFound(reply, 'User', 'User not found');
      }

      // Verify all roles exist and belong to this tenant
      if (Array.isArray(roleIds) && roleIds.length > 0) {
        const roles = await db
          .select()
          .from(customRoles)
          .where(and(
            eq(customRoles.tenantId, tenantId ?? ''),
            inArray(customRoles.roleId, roleIds as string[])
          ));

        if (roles.length !== roleIds.length) {
          const foundRoleIds = roles.map(r => r.roleId);
          const missingRoleIds = roleIds.filter(id => !foundRoleIds.includes(id));
          console.log(`❌ Missing roles: ${missingRoleIds.join(', ')}`);
          return reply.code(400).send({ 
            error: 'One or more roles not found',
            missingRoles: missingRoleIds
          });
        }
      }

      // Get existing assignments before removal for event publishing
      const existingAssignments = await db
        .select({
          id: userRoleAssignments.id,
          roleId: userRoleAssignments.roleId
        })
        .from(userRoleAssignments)
        .where(eq(userRoleAssignments.userId, userId));

      // Use transaction for atomic operation
      const newAssignments = await db.transaction(async (tx) => {
        console.log(`🔄 Removing existing role assignments for user ${userId}`);
        // Remove existing role assignments for this user
        await tx
          .delete(userRoleAssignments)
          .where(eq(userRoleAssignments.userId, userId));

        // Add new role assignments
        let insertedAssignments: Array<{ id?: string; roleId: string; assignedAt?: Date; assignedBy?: string | null }> = [];
        if (Array.isArray(roleIds) && roleIds.length > 0) {
          console.log(`➕ Adding ${roleIds.length} new role assignments for user ${userId}`);
          const assignments = (roleIds as string[]).map(roleId => ({
            userId,
            roleId,
            assignedBy: request.userContext?.internalUserId ?? '',
            assignedAt: new Date(),
            isActive: true
          }));

          console.log(`📝 Assignment data:`, assignments);
          const inserted = await tx
            .insert(userRoleAssignments)
            .values(assignments as any)
            .returning();
          insertedAssignments = inserted as Array<{ id?: string; roleId: string; assignedAt?: Date; assignedBy?: string | null }>;
          console.log(`✅ Successfully inserted role assignments`);
        }
        return insertedAssignments;
      });

      // Publish role unassignment events for removed roles
      const removedRoleIds = existingAssignments
        .map(a => a.roleId)
        .filter(roleId => !roleIds.includes(roleId));
      
      if (removedRoleIds.length > 0) {
        try {
          // Redis removed - using AWS MQ publisher
          for (const assignment of existingAssignments.filter(a => removedRoleIds.includes(a.roleId))) {
            try {
              const { amazonMQPublisher } = await import('../../messaging/utils/amazon-mq-publisher.js');
              await amazonMQPublisher.publishRoleEventToSuite('role_unassigned', tenantId ?? '', String(assignment.roleId), {
                assignmentId: (assignment as { id?: string }).id,
                userId: userId,
                roleId: assignment.roleId,
                unassignedAt: new Date().toISOString(),
                unassignedBy: request.userContext?.internalUserId ?? '',
                reason: 'Roles updated'
              });
            } catch (streamErr) {
              const streamError = streamErr as Error;
              console.warn('⚠️ Failed to publish role unassignment event:', streamError.message);
            }
          }
          console.log(`📡 Published ${removedRoleIds.length} role unassignment events`);
        } catch (publishErr) {
          const publishError = publishErr as Error;
          console.warn('⚠️ Failed to publish some role unassignment events:', publishError.message);
        }
      }

      // Publish role assignment events for new roles
      const newRoleIds = roleIds.filter(roleId => 
        !existingAssignments.some(a => a.roleId === roleId)
      );
      
      if (newRoleIds.length > 0 && newAssignments.length > 0) {
        try {
          // Redis removed - using AWS MQ publisher
          for (const assignment of newAssignments.filter((a: { roleId: string }) => newRoleIds.includes(a.roleId))) {
            try {
              const { amazonMQPublisher } = await import('../../messaging/utils/amazon-mq-publisher.js');
              await amazonMQPublisher.publishRoleEventToSuite('role_assigned', tenantId ?? '', String(assignment.roleId), {
                assignmentId: assignment.id,
                userId: userId,
                roleId: assignment.roleId,
                assignedAt: assignment.assignedAt ? (typeof assignment.assignedAt === 'string' ? assignment.assignedAt : (assignment.assignedAt as Date).toISOString()) : new Date().toISOString(),
                assignedBy: (assignment.assignedBy ?? request.userContext?.internalUserId) ?? ''
              });
              console.log(`📡 Published role assignment event for role ${assignment.roleId}`);
            } catch (streamErr) {
              const streamError = streamErr as Error;
              console.warn('⚠️ Failed to publish role assignment event:', streamError.message);
            }
          }
          console.log(`📡 Published ${newRoleIds.length} role assignment events`);
        } catch (publishErr) {
          const publishError = publishErr as Error;
          console.warn('⚠️ Failed to publish some role assignment events:', publishError.message);
        }
      }

      return {
        success: true,
        message: `Roles updated successfully for user`,
        data: { userId, assignedRoles: Array.isArray(roleIds) ? roleIds.length : 0 }
      };
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error assigning roles:', error);
      request.log.error(error, 'Error assigning roles:');
      return reply.code(500).send({ 
        success: false,
        error: 'Failed to assign roles',
        message: error.message ?? 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Organization Assignment Routes

  /**
   * GET /current/organization-assignments
   * Get all organization assignments for the current tenant
   */
  fastify.get('/current/organization-assignments', {
    schema: {
      description: 'Get all organization assignments for the current tenant',
      tags: ['Tenant', 'Organization Assignment']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      console.log('🔍 Organization assignments requested for tenant:', tenantId);

      // Get all organization memberships for this tenant
      const memberships = await db
        .select({
          membershipId: organizationMemberships.membershipId,
          userId: organizationMemberships.userId,
          userName: tenantUsers.name,
          userEmail: tenantUsers.email,
          entityId: organizationMemberships.entityId,
          entityType: entities.entityType,
          membershipType: organizationMemberships.membershipType,
          membershipStatus: organizationMemberships.membershipStatus,
          accessLevel: organizationMemberships.accessLevel,
          isPrimary: organizationMemberships.isPrimary,
          assignedAt: organizationMemberships.createdAt,
          entityName: entities.entityName,
          entityCode: entities.entityCode
        })
        .from(organizationMemberships)
        .innerJoin(tenantUsers, eq(organizationMemberships.userId, tenantUsers.userId))
        .innerJoin(entities, eq(organizationMemberships.entityId, entities.entityId))
        .where(and(
          eq(organizationMemberships.tenantId, tenantId ?? ''),
          eq(organizationMemberships.membershipStatus, 'active'),
          eq(tenantUsers.isActive, true),
          eq(entities.isActive, true)
        ));

      // Transform to the expected format
      const enrichedAssignments = memberships.map(membership => ({
        assignmentId: membership.membershipId,
        userId: membership.userId,
        userName: membership.userName,
        userEmail: membership.userEmail,
        organizationId: membership.entityId, // Keep for backward compatibility
        entityId: membership.entityId,
        entityType: membership.entityType, // Include entity type (organization or location)
        organizationName: membership.entityName, // Keep for backward compatibility
        entityName: membership.entityName,
        organizationCode: membership.entityCode, // Keep for backward compatibility
        entityCode: membership.entityCode,
        assignmentType: membership.membershipType,
        accessLevel: membership.accessLevel,
        isPrimary: membership.isPrimary,
        isActive: membership.membershipStatus === 'active',
        assignedAt: membership.assignedAt?.toISOString(),
        priority: membership.isPrimary ? 1 : 2 // Primary gets higher priority
      }));

      console.log('🔍 Returning enriched assignments:', enrichedAssignments.length);
      return {
        success: true,
        data: enrichedAssignments
      };
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error fetching organization assignments:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to fetch organization assignments',
        error: error.message
      });
    }
  });

  /**
   * POST /current/users/:userId/assign-organization
   * Assign a user to an organization
   */
  fastify.post('/current/users/:userId/assign-organization', {
    schema: {
      description: 'Assign a user to an organization within the tenant',
      tags: ['Tenant', 'Organization Assignment']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const {
        organizationId,
        assignmentType = 'primary',
        priority = 1,
        metadata = {}
      } = body;

      // Validate that user exists and belongs to this tenant
      const user = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .limit(1);

      if (user.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'User not found in this tenant'
        });
      }

      // Validate that organization exists and belongs to this tenant
      const organization = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.entityId, organizationId as string),
          eq(entities.tenantId, tenantId ?? ''),
          eq(entities.isActive, true)
        ))
        .limit(1);

      if (organization.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'Organization not found in this tenant'
        });
      }

      // Check if user is already assigned to this organization
      const existingMembership = await db
        .select()
        .from(organizationMemberships)
        .where(and(
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.tenantId, tenantId ?? ''),
          eq(organizationMemberships.entityId, organizationId as string),
          eq(organizationMemberships.membershipStatus, 'active')
        ))
        .limit(1);

      if (existingMembership.length > 0) {
        return reply.code(200).send({
          success: true,
          message: 'User is already assigned to this organization',
          data: {
            membershipId: existingMembership[0].membershipId,
            userId,
            organizationId,
            organizationName: organization[0].entityName,
            membershipType: existingMembership[0].membershipType,
            accessLevel: existingMembership[0].accessLevel,
            assignedAt: existingMembership[0].createdAt?.toISOString()
          }
        });
      }

      // Create new organization membership
      const membershipId = randomUUID();
      const newMembership = await db
        .insert(organizationMemberships)
        .values({
          membershipId,
          userId,
          tenantId: tenantId ?? '',
          entityId: organizationId as string,
          entityType: 'organization',
          membershipType: assignmentType || 'direct',
          membershipStatus: 'active',
          accessLevel: 'standard',
          isPrimary: !(user[0] as { primaryOrganizationId?: string | null }).primaryOrganizationId, // Set as primary if user has no primary org
          createdBy: request.userContext?.internalUserId ?? '',
          createdAt: new Date(),
          updatedAt: new Date()
        } as any)
        .returning();

      // If this is the user's first organization assignment, update their primary organization
      if (!(user[0] as { primaryOrganizationId?: string | null }).primaryOrganizationId) {
        await db
          .update(tenantUsers)
          .set({
            primaryOrganizationId: organizationId as string,
            updatedAt: new Date()
          })
          .where(and(
            eq(tenantUsers.userId, userId),
            eq(tenantUsers.tenantId, tenantId ?? '')
          ));
      }

      if (newMembership.length === 0) {
        return reply.code(500).send({
          success: false,
          message: 'Failed to create organization membership'
        });
      }

      // Publish organization assignment created event
      const assignmentData = {
        assignmentId: membershipId,
        tenantId,
        userId,
        organizationId,
        organizationCode: organization[0].entityCode,
        assignmentType,
        isActive: true,
        assignedAt: new Date().toISOString(),
        priority,
        assignedBy: request.userContext.internalUserId,
        metadata
      };

      try {
        await OrganizationAssignmentService.publishOrgAssignmentCreated(assignmentData);
      } catch (publishErr) {
        console.error('❌ Failed to publish assignment event:', publishErr);
        // Don't fail the assignment if event publishing fails
      }

      // Log activity
      await ActivityLogger.logActivity(
        request.userContext?.internalUserId ?? '',
        tenantId ?? '',
        organizationId as string,
        ACTIVITY_TYPES.USER_ORGANIZATION_ASSIGNED,
        {
          userId,
          userEmail: (user[0] as { email: string }).email,
          organizationId,
          organizationName: (organization[0] as { entityName: string }).entityName,
          assignmentType,
          assignedBy: request.userContext?.internalUserId ?? '',
          tenantId: tenantId ?? ''
        },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return {
        success: true,
        message: 'User successfully assigned to organization',
        data: {
          membershipId: newMembership[0].membershipId,
          userId,
          organizationId,
          organizationName: organization[0].entityName,
          membershipType: newMembership[0].membershipType,
          accessLevel: newMembership[0].accessLevel,
          isPrimary: newMembership[0].isPrimary,
          assignedAt: newMembership[0].createdAt?.toISOString()
        }
      };
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error assigning user to organization:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to assign user to organization',
        error: error.message
      });
    }
  });

  /**
   * PUT /current/users/:userId/update-organization
   * Update a user's organization assignment
   */
  fastify.put('/current/users/:userId/update-organization', {
    schema: {
      description: 'Update a user\'s organization assignment within the tenant',
      tags: ['Tenant', 'Organization Assignment']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const { organizationId, changes, assignmentId } = body;

      // Validate user and organization belong to tenant
      const user = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .limit(1);

      if (user.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'User not found in this tenant'
        });
      }

      const organization = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.entityId, organizationId as string),
          eq(entities.tenantId, tenantId ?? '')
        ))
        .limit(1);

      if (organization.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'Organization not found in this tenant'
        });
      }

      // Update the user record
      const updateData: Record<string, unknown> = {
        updatedAt: new Date()
      };

      const changesObj = changes as Record<string, unknown> | undefined;
      // Handle different types of changes
      if (changesObj?.isActive !== undefined) {
        updateData.isActive = changesObj.isActive;
      }

      // If organization is changing, update it
      if (changesObj?.organizationId != null) {
        updateData.primaryOrganizationId = changesObj.organizationId as string | null;
      }

      const updatedUser = await db
        .update(tenantUsers)
        .set(updateData)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .returning();

      if (updatedUser.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      // Publish organization assignment updated event
      const assignmentData = {
        assignmentId: assignmentId || `${userId}_${organizationId}_${Date.now()}`,
        tenantId,
        userId,
        organizationId,
        changes,
        updatedBy: request.userContext.internalUserId
      };

      try {
        await OrganizationAssignmentService.publishOrgAssignmentUpdated(assignmentData);
        console.log(`📡 Published organization assignment updated event for user ${userId}`);
      } catch (publishErr) {
        const publishError = publishErr as Error;
        console.warn('⚠️ Failed to publish assignment update event:', publishError.message);
      }

      // Log activity
      await ActivityLogger.logActivity(
        request.userContext?.internalUserId ?? '',
        tenantId ?? '',
        organizationId as string,
        ACTIVITY_TYPES.USER_ORGANIZATION_UPDATED,
        {
          userId,
          userEmail: (user[0] as { email: string }).email,
          organizationId,
          changes: changesObj,
          updatedBy: request.userContext?.internalUserId ?? '',
          tenantId: tenantId ?? ''
        },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return {
        success: true,
        message: 'Organization assignment updated successfully',
        data: {
          userId,
          organizationId,
          changes: changesObj,
          updatedAt: (updateData.updatedAt as Date).toISOString()
        }
      };
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error updating organization assignment:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to update organization assignment',
        error: error.message
      });
    }
  });

  /**
   * DELETE /current/users/:userId/remove-organization
   * Remove a user from an organization
   */
  fastify.delete('/current/users/:userId/remove-organization', {
    schema: {
      description: 'Remove a user from an organization within the tenant',
      tags: ['Tenant', 'Organization Assignment']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const { organizationId, reason = 'permanent_removal' } = body;

      // Validate that user exists and belongs to this tenant
      const user = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId ?? '')
        ))
        .limit(1);

      if (user.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'User not found in this tenant'
        });
      }

      // Find the organization membership to remove
      const membership = await db
        .select()
        .from(organizationMemberships)
        .where(and(
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.tenantId, tenantId ?? ''),
          eq(organizationMemberships.entityId, organizationId as string),
          eq(organizationMemberships.membershipStatus, 'active')
        ))
        .limit(1);

      if (membership.length === 0) {
        return reply.code(404).send({
          success: false,
          message: 'User organization membership not found'
        });
      }

      // Deactivate the membership
      const updatedMembership = await db
        .update(organizationMemberships)
        .set({
          membershipStatus: 'inactive',
          updatedBy: request.userContext?.internalUserId ?? '',
          updatedAt: new Date()
        })
        .where(eq(organizationMemberships.membershipId, membership[0].membershipId))
        .returning();

      if (updatedMembership.length === 0) {
        return reply.code(500).send({
          success: false,
          message: 'Failed to remove organization membership'
        });
      }

      // If this was the primary organization, update user's primary organization
      if (membership[0].isPrimary) {
        // Find another active membership to set as primary
        const otherMemberships = await db
          .select()
          .from(organizationMemberships)
          .where(and(
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.tenantId, tenantId ?? ''),
            eq(organizationMemberships.membershipStatus, 'active')
          ));

        if (otherMemberships.length > 0) {
          // Set the first remaining membership as primary
          await db
            .update(organizationMemberships)
            .set({
              isPrimary: true,
              updatedBy: request.userContext.internalUserId,
              updatedAt: new Date()
            })
            .where(eq(organizationMemberships.membershipId, otherMemberships[0].membershipId));

          // Update user's primary organization
          await db
            .update(tenantUsers)
            .set({
              primaryOrganizationId: otherMemberships[0].entityId,
              updatedAt: new Date()
            })
            .where(and(
              eq(tenantUsers.userId, userId),
              eq(tenantUsers.tenantId, tenantId ?? '')
            ));
        } else {
          // No more memberships, clear primary organization
          await db
            .update(tenantUsers)
            .set({
              primaryOrganizationId: null,
              updatedAt: new Date()
            })
            .where(and(
              eq(tenantUsers.userId, userId),
              eq(tenantUsers.tenantId, tenantId ?? '')
            ));
        }
      }

      // Publish organization assignment deleted event
      // Use the actual membershipId from the deleted membership record
      const assignmentData = {
        assignmentId: membership[0].membershipId, // Use actual membershipId instead of generating new one
        tenantId,
        userId,
        organizationId,
        deletedBy: request.userContext.internalUserId,
        reason
      };

      try {
        await OrganizationAssignmentService.publishOrgAssignmentDeleted(assignmentData);
        console.log(`📡 Published organization assignment deleted event for user ${userId}`);
      } catch (publishErr) {
        const publishError = publishErr as Error;
        console.warn('⚠️ Failed to publish assignment deletion event:', publishError.message);
      }

      // Log activity
      await ActivityLogger.logActivity(
        request.userContext?.internalUserId ?? '',
        tenantId ?? '',
        organizationId as string,
        ACTIVITY_TYPES.USER_ORGANIZATION_REMOVED,
        {
          userId,
          userEmail: (user[0] as { email: string }).email,
          organizationId,
          reason,
          removedBy: request.userContext?.internalUserId ?? '',
          tenantId: tenantId ?? ''
        },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return {
        success: true,
        message: 'User successfully removed from organization',
        data: {
          userId,
          organizationId,
          removedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error removing user from organization:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to remove user from organization',
        error: error.message
      });
    }
  });

  /**
   * POST /current/users/bulk-assign-organizations
   * Bulk assign multiple users to organizations
   */
  fastify.post('/current/users/bulk-assign-organizations', {
    schema: {
      description: 'Bulk assign multiple users to organizations within the tenant',
      tags: ['Tenant', 'Organization Assignment']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const body = request.body as Record<string, unknown>;
      const { assignments } = body;

      const results: Array<{ success: boolean; userId?: string; assignmentId?: string; error?: string }> = [];
      const events: Array<Record<string, unknown>> = [];
      const assignmentsList = Array.isArray(assignments) ? assignments : [];

      for (const assignment of assignmentsList as Array<{ userId: string; organizationId: string; assignmentType?: string; priority?: number }>) {
        try {
          // Update user organization assignment
          await db
            .update(tenantUsers)
            .set({
              primaryOrganizationId: assignment.organizationId,
              updatedAt: new Date()
            } as Record<string, unknown>)
            .where(and(
              eq(tenantUsers.userId, assignment.userId),
              eq(tenantUsers.tenantId, tenantId ?? '')
            ));

          // Prepare event data
          const eventData = {
            assignmentId: `${assignment.userId}_${assignment.organizationId}_${Date.now()}`,
            tenantId: tenantId ?? '',
            userId: assignment.userId,
            organizationId: assignment.organizationId,
            assignmentType: assignment.assignmentType || 'primary',
            isActive: true,
            assignedAt: new Date().toISOString(),
            priority: assignment.priority || 1,
            assignedBy: request.userContext?.internalUserId ?? ''
          };

          events.push(eventData);
          results.push({ success: true, userId: assignment.userId, assignmentId: eventData.assignmentId });

        } catch (err) {
          const error = err as Error;
          console.error(`❌ Failed to assign user ${assignment.userId}:`, error);
          results.push({ success: false, userId: assignment.userId, error: error.message });
        }
      }

      // Publish events in bulk
      try {
        const publishResults = await OrganizationAssignmentService.publishBulkAssignments(events, 'created');
        console.log(`📡 Published ${events.length} organization assignment events`);
      } catch (publishErr) {
        const publishError = publishErr as Error;
        console.warn('⚠️ Failed to publish some assignment events:', publishError.message);
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      // Log bulk activity
      await ActivityLogger.logActivity(
        request.userContext?.internalUserId ?? '',
        tenantId ?? '',
        null,
        ACTIVITY_TYPES.BULK_USER_ORGANIZATION_ASSIGNED,
        {
          totalAssignments: assignmentsList.length,
          successful: successCount,
          failed: failureCount,
          assignments: results,
          tenantId: tenantId ?? ''
        },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return {
        success: true,
        message: `Bulk assignment completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          total: assignmentsList.length,
          successful: successCount,
          failed: failureCount,
          results
        }
      };
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error in bulk organization assignment:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to complete bulk organization assignment',
        error: error.message
      });
    }
  });

  // Export users
  fastify.get('/current/users/export', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Only admins can export users
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const tenantId = request.userContext.tenantId;

      const users = await db
        .select({
          name: tenantUsers.name,
          email: tenantUsers.email,
          role: sql`CASE WHEN ${tenantUsers.isTenantAdmin} THEN 'Admin' ELSE 'User' END`,
          status: sql`CASE WHEN ${tenantUsers.isActive} THEN 'Active' ELSE 'Inactive' END`,
          onboardingCompleted: tenantUsers.onboardingCompleted,
          createdAt: tenantUsers.createdAt
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId ?? ''));

      // Generate CSV content
      const headers = ['Name', 'Email', 'Role', 'Status', 'Onboarding Completed', 'Created At'];
      const csvContent = [
        headers.join(','),
        ...users.map(user => [
          user.name || '',
          user.email,
          user.role,
          user.status,
          user.onboardingCompleted ? 'Yes' : 'No',
          (user.createdAt != null ? user.createdAt : new Date()).toISOString().split('T')[0]
        ].join(','))
      ].join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="users-export.csv"');
      
      return csvContent;
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error exporting users:');
      return reply.code(500).send({ error: 'Failed to export users' });
    }
  });
} 