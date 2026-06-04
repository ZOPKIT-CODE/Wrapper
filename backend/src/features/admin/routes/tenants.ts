import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

type RequestContextLike = Record<string, unknown> & { ip?: string; headers?: Record<string, string | undefined>; connection?: { remoteAddress?: string } };
import { TenantService } from '../../../services/tenant-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, subscriptions, creditPurchases, entities } from '../../../db/schema/index.js';
import { and, eq, sql, desc } from 'drizzle-orm';
import ErrorResponses from '../../../utils/error-responses.js';
import ActivityLogger, { ACTIVITY_TYPES } from '../../../services/activityLogger.js';
import { uploadTenantLogo } from '../../../utils/s3-logo-upload.js';
import Logger from '../../../utils/logger.js';
import {
  getActivityLabel,
  resendUserInvite,
  assignRolesToUser,
  getOrganizationAssignments,
  assignUserToOrganization,
  updateUserOrganizationAssignment,
  removeUserFromOrganization,
  bulkAssignOrganizations,
} from '../services/tenant-management-service.js';

export default async function tenantRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // Get own tenant info (scoped to requester's tenant from JWT)
  fastify.get('/', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = request.userContext?.tenantId;
      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const tenantsList = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          isActive: tenants.isActive,
          createdAt: tenants.createdAt,
          adminEmail: tenants.adminEmail,
          trialStartedAt: subscriptions.trialStartedAt,
          trialEndsAt: subscriptions.trialEndsAt
        })
        .from(tenants)
        .leftJoin(subscriptions, eq(tenants.tenantId, subscriptions.tenantId))
        .where(eq(tenants.tenantId, tenantId))
        .orderBy(tenants.createdAt);

      return { success: true, tenants: tenantsList };
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
      const tenantId = request.userContext.tenantId;
      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      }

      const details = await TenantService.getTenantDetails(tenantId);
      return { success: true, data: details };
    } catch (error) {
      request.log.error(error, 'Error fetching current tenant:');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

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
          trialStartedAt: subscriptions.trialStartedAt,
          trialEndsAt: subscriptions.trialEndsAt
        })
        .from(tenants)
        .leftJoin(subscriptions, eq(tenants.tenantId, subscriptions.tenantId))
        .where(eq(tenants.tenantId, tenantId ?? ''))
        .limit(1);

      if (tenant) {
        if (tenant.createdAt) events.push({ type: 'account_created', label: 'Account created', date: tenant.createdAt.toISOString(), metadata: {} });
        if (tenant.onboardingStartedAt) events.push({ type: 'onboarding_started', label: 'Onboarding started', date: tenant.onboardingStartedAt.toISOString(), metadata: {} });
        if (tenant.onboardedAt) events.push({ type: 'onboarding_completed', label: 'Onboarding completed', date: tenant.onboardedAt.toISOString(), metadata: {} });
        if (tenant.trialStartedAt) events.push({ type: 'trial_started', label: 'Trial started', date: tenant.trialStartedAt.toISOString(), metadata: {} });
        if (tenant.trialEndsAt) events.push({ type: 'trial_ended', label: 'Trial ended', date: tenant.trialEndsAt.toISOString(), metadata: {} });
      }

      // 2. Get subscription (plan start)
      const [subscription] = await db
        .select({ createdAt: subscriptions.createdAt, plan: subscriptions.plan })
        .from(subscriptions)
        .where(and(eq(subscriptions.tenantId, tenantId ?? ''), eq(subscriptions.status, 'active')))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (subscription && subscription.createdAt) {
        const planNameMap: Record<string, string> = {
          'free': 'Free', 'starter': 'Starter', 'professional': 'Professional',
          'premium': 'Premium', 'enterprise': 'Enterprise', 'standard': 'Standard', 'credit_based': 'Free'
        };
        const planKey = subscription.plan as string;
        const planDisplayName = planNameMap[planKey] ?? (planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : 'Unknown');
        events.push({ type: 'plan_started', label: `Started ${planDisplayName} plan`, date: subscription.createdAt.toISOString(), metadata: { plan: subscription.plan, planDisplayName } });
      }

      // 3. Get credit purchases
      const creditPurchasesList = await db
        .select({
          createdAt: creditPurchases.createdAt, paidAt: creditPurchases.paidAt,
          creditAmount: creditPurchases.creditAmount, totalAmount: creditPurchases.totalAmount,
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
          events.push({ type: 'credit_purchase', label: `Credit purchase: ${credits.toLocaleString()} credits`, date: purchaseDate.toISOString(), metadata: { credits, amount, status: purchase.status } });
        }
      }

      // 4. Get user activity logs
      let activityTotal = 0;
      if (shouldIncludeActivity && userId) {
        try {
          const activityResult = await ActivityLogger.getUserActivity(userId, tenantId, {
            limit: parsedLimit, offset: parsedOffset, includeMetadata: true
          });

          activityTotal = activityResult?.pagination?.total ?? 0;

          const MEANINGFUL_ACTION_PREFIXES = ['user.', 'role.', 'invitation.', 'entity.', 'location.', 'billing.', 'payment.', 'data.'];
          const MEANINGFUL_EXACT_ACTIONS = new Set(['tenant.settings_updated', 'credit.purchase_success']);
          const EXCLUDED_ACTIONS = new Set(['auth.login', 'auth.logout', 'tenant.viewed', 'subscription.viewed', 'credit.allocated']);

          const isMeaningful = (action: string): boolean => {
            if (EXCLUDED_ACTIONS.has(action)) return false;
            if (MEANINGFUL_EXACT_ACTIONS.has(action)) return true;
            return MEANINGFUL_ACTION_PREFIXES.some(prefix => action.startsWith(prefix));
          };

          if (activityResult?.activities) {
            for (const activity of activityResult.activities as Array<{ action: string; createdAt?: Date; appName?: string; appCode?: string; userInfo?: Record<string, unknown>; ipAddress?: string | null }>) {
              if (activity.createdAt && isMeaningful(activity.action)) {
                events.push({
                  type: 'activity', label: getActivityLabel(activity.action), date: activity.createdAt.toISOString(),
                  metadata: { action: activity.action, appName: activity.appName ?? 'System', appCode: activity.appCode ?? 'system', userInfo: activity.userInfo ?? {}, ipAddress: activity.ipAddress ?? null }
                });
              }
            }
          }
        } catch (err) {
          request.log.warn(`Failed to fetch activity logs for timeline: ${(err as Error).message}`);
        }
      }

      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      events.push({ type: 'today', label: 'Today', date: new Date().toISOString(), metadata: {} });

      return {
        success: true,
        data: { events, pagination: { offset: parsedOffset, limit: parsedLimit, activityTotal, hasMore: parsedOffset + parsedLimit < activityTotal } }
      };
    } catch (error) {
      request.log.error(error, 'Error fetching timeline:');
      return reply.code(500).send({ error: 'Failed to fetch timeline' });
    }
  });

  // Update tenant settings (full update)
  fastify.put('/current/settings', { preHandler: [authenticateToken, requirePermission(PERMISSIONS.TENANT_SETTINGS_EDIT)], schema: {} }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const body = request.body as Record<string, unknown>;
      const updatedTenant = await TenantService.updateTenant(tenantId, body);

      await ActivityLogger.logActivity(
        request.userContext.internalUserId ?? '', tenantId, null,
        ACTIVITY_TYPES.TENANT_SETTINGS_UPDATED,
        { updatedFields: Object.keys(body), tenantId, userEmail: request.userContext.email },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      // Publish configuration.updated event so downstream apps mirror the change
      try {
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        const results = await snsSqsPublisher.publishConfigurationUpdateToSuite(
          tenantId,
          {
            entityId: 'global',
            configKey: 'tenant.settings',
            configCategory: 'tenant',
            configValue: body,
            changedBy: request.userContext.internalUserId ?? request.userContext.email ?? 'system',
          },
          request.userContext.internalUserId ?? 'system'
        );
        const failed = results.filter((r) => r.success === false);
        if (failed.length > 0) {
          Logger.log('warning', 'general', 'tenant-settings-update', 'Some configuration.updated publishes failed', { tenantId, failed });
        }
      } catch (publishErr) {
        Logger.log('error', 'general', 'tenant-settings-update', 'Failed to publish configuration.updated event', { tenantId, error: (publishErr as Error).message });
      }

      return { success: true, data: updatedTenant, message: 'Tenant settings updated successfully' };
    } catch (error) {
      request.log.error(error, 'Error updating tenant settings:');
      return reply.code(500).send({ error: 'Failed to update tenant settings' });
    }
  });

  // Update tenant account details (partial update - PATCH)
  fastify.patch('/current', { preHandler: [authenticateToken, requirePermission(PERMISSIONS.TENANT_SETTINGS_EDIT)], schema: {} }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const updateData: Record<string, unknown> = {};
      const tenantFields = [
        'legalCompanyName', 'logoUrl', 'billingEmail', 'supportEmail',
        'contactSalutation', 'contactMiddleName', 'contactDepartment',
        'contactJobTitle', 'contactDirectPhone', 'contactMobilePhone',
        'contactPreferredContactMethod', 'contactAuthorityLevel',
        'preferredContactMethod', 'mailingAddressSameAsRegistered',
        'mailingStreet', 'mailingCity', 'mailingState', 'mailingZip',
        'mailingCountry', 'taxRegistrationDetails', 'primaryColor',
        'customDomain', 'brandingConfig',
        'taxRegistered', 'vatGstRegistered', 'billingCountry',
        'defaultLanguage', 'defaultLocale', 'defaultCurrency', 'defaultTimeZone',
      ];

      const bankingFields = [
        'bankName', 'bankBranch', 'accountHolderName', 'accountNumber',
        'accountType', 'bankAccountCurrency', 'swiftBicCode', 'iban',
        'routingNumberUs', 'sortCodeUk', 'ifscCodeIndia', 'bsbNumberAustralia',
        'paymentTerms', 'creditLimit', 'preferredPaymentMethod',
      ];

      const body = request.body as Record<string, unknown>;
      tenantFields.forEach(field => { if (body[field] !== undefined) updateData[field] = body[field]; });

      const bankingData: Record<string, unknown> = {};
      bankingFields.forEach(field => { if (body[field] !== undefined) bankingData[field] = body[field]; });

      updateData.updatedAt = new Date();

      const [updatedTenant] = await Promise.all([
        TenantService.updateTenant(tenantId, updateData),
        Object.keys(bankingData).length > 0 ? TenantService.upsertBankingDetails(tenantId, bankingData) : Promise.resolve(),
      ]);

      await ActivityLogger.logActivity(
        request.userContext.internalUserId ?? '', tenantId, null,
        ACTIVITY_TYPES.TENANT_SETTINGS_UPDATED,
        { updatedFields: Object.keys(updateData), tenantId, userEmail: request.userContext.email },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      // Publish configuration.updated event so downstream apps mirror the change
      try {
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        // Strip the auto-injected updatedAt before publishing so consumers see
        // only the fields the caller actually intended to change.
        const { updatedAt: _omitUpdatedAt, ...changedFields } = updateData;
        const configValue = {
          tenant: changedFields,
          ...(Object.keys(bankingData).length > 0 ? { banking: bankingData } : {}),
        };
        const results = await snsSqsPublisher.publishConfigurationUpdateToSuite(
          tenantId,
          {
            entityId: 'global',
            configKey: 'tenant.account',
            configCategory: 'tenant',
            configValue,
            changedBy: request.userContext.internalUserId ?? request.userContext.email ?? 'system',
          },
          request.userContext.internalUserId ?? 'system'
        );
        const failed = results.filter((r) => r.success === false);
        if (failed.length > 0) {
          Logger.log('warning', 'general', 'tenant-account-update', 'Some configuration.updated publishes failed', { tenantId, failed });
        }
      } catch (publishErr) {
        Logger.log('error', 'general', 'tenant-account-update', 'Failed to publish configuration.updated event', { tenantId, error: (publishErr as Error).message });
      }

      return { success: true, data: updatedTenant, message: 'Account settings updated successfully' };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error updating account settings:');
      return reply.code(500).send({ error: 'Failed to update account settings', message: error.message });
    }
  });

  // Upload tenant logo to S3
  fastify.post('/logo', { preHandler: [authenticateToken] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const tenantId = request.userContext.tenantId;
    if (!tenantId) return reply.code(401).send({ error: 'Tenant not found' });

    try {
      const file = await request.file();
      if (!file) return reply.code(400).send({ success: false, error: 'No file uploaded' });

      const buffer = await file.toBuffer();
      const { url } = await uploadTenantLogo(tenantId, buffer, file.mimetype, file.filename);
      await TenantService.updateTenant(tenantId, { logoUrl: url, updatedAt: new Date() });

      return reply.code(200).send({ success: true, data: { logoUrl: url } });
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error uploading tenant logo:');
      const isClientError = error.message.startsWith('File type') || error.message.startsWith('File size');
      return reply.code(isClientError ? 400 : 500).send({ success: false, error: error.message || 'Failed to upload logo' });
    }
  });

  // Get tenant users
  fastify.get('/current/users', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const query = request.query as Record<string, string>;
      const { entityId } = query;

      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const users = entityId
        ? await TenantService.getTenantUsersByEntity(tenantId, entityId)
        : await TenantService.getTenantUsers(tenantId);

      return { success: true, data: users, filteredByEntity: !!entityId, entityId: entityId || null };
    } catch (error) {
      request.log.error(error, 'Error fetching tenant users:');
      return reply.code(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Invite user to tenant
  fastify.post('/current/users/invite', { preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_EDIT)], schema: {} }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const body = request.body as Record<string, unknown>;
      const { email, roleId, message, organizationId } = body;
      const organizationIdStr = organizationId as string | undefined;

      if (organizationIdStr) {
        const organization = await db
          .select().from(entities)
          .where(and(eq(entities.entityId, organizationIdStr), eq(entities.tenantId, tenantId ?? ''), eq(entities.isActive, true)))
          .limit(1);

        if (organization.length === 0) {
          return reply.code(404).send({ success: false, message: 'Organization not found in this tenant' });
        }
      }

      const invitation = await TenantService.inviteUser({
        tenantId, email: email as string,
        roleId: (roleId as string | null | undefined) ?? undefined,
        invitedBy: request.userContext?.internalUserId ?? '',
        message: message as string | undefined,
        primaryEntityId: organizationIdStr ?? undefined
      });

      await ActivityLogger.logActivity(
        request.userContext.internalUserId ?? '', tenantId, null,
        ACTIVITY_TYPES.TENANT_USER_INVITED,
        { invitedEmail: email, roleId, invitationId: (invitation as { invitationId?: string })?.invitationId, tenantId, userEmail: request.userContext.email },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return { success: true, data: invitation, message: 'User invitation sent successfully' };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error inviting user:');
      if (error.message?.includes('already exists')) return reply.code(409).send({ error: error.message });
      return reply.code(500).send({ error: 'Failed to send invitation' });
    }
  });

  // Accept invitation
  fastify.post('/invite/:token/accept', { schema: {} }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const params = request.params as Record<string, string>;
      const { token } = params;

      const result = await TenantService.acceptInvitation(token, request.userContext.idpSub ?? '', {
        email: request.userContext.email,
        firstName: request.userContext.name?.split(' ')[0],
        lastName: request.userContext.name?.split(' ').slice(1).join(' ') || undefined
      });

      return { success: true, data: result, message: 'Invitation accepted successfully' };
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
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const invitations = await TenantService.getPendingInvitations(tenantId);
      return { success: true, data: invitations };
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

      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      if (!request.userContext.isTenantAdmin) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Only tenant administrators can cancel invitations' });
      }

      const result = await TenantService.cancelInvitation(tenantId, invitationId, request.userContext.internalUserId ?? '');
      return { success: true, message: result.message };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error cancelling invitation:');
      if (error.message?.includes('not found')) return reply.code(404).send({ error: 'Invitation not found', message: error.message });
      if (error.message?.includes('pending')) return reply.code(400).send({ error: 'Invalid invitation status', message: error.message });
      return reply.code(500).send({ error: 'Failed to cancel invitation' });
    }
  });

  // Resend invitation email
  fastify.post('/current/invitations/:id/resend', { schema: {} }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const params = request.params as Record<string, string>;
      const result = await TenantService.resendInvitationEmail(params.id, tenantId);
      return { success: true, data: result, message: 'Invitation email resent successfully' };
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
  fastify.put('/current/users/:userId/role', { preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_ASSIGNMENT_ASSIGN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const tenantId = request.userContext.tenantId;
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const role = body.role as string;

      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');
      if (!role) return reply.code(400).send({ error: 'Role is required' });

      const [roleRecord] = await db
        .select().from(customRoles)
        .where(and(eq(customRoles.roleName, role), eq(customRoles.tenantId, tenantId ?? '')))
        .limit(1);

      if (!roleRecord) return reply.code(404).send({ error: 'Role not found' });

      const result = await TenantService.updateUserRole(userId, roleRecord.roleId, tenantId);

      await ActivityLogger.logActivity(
        request.userContext.internalUserId ?? '', tenantId, null,
        ACTIVITY_TYPES.USER_PROMOTED,
        { targetUserId: userId, newRoleId: roleRecord.roleId, newRoleName: role, tenantId, userEmail: request.userContext.email },
        ActivityLogger.createRequestContext(request as unknown as RequestContextLike)
      );

      return { success: true, message: result.message, data: result.data };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error updating user role:');
      if (error.message?.includes('not found')) return reply.code(404).send({ error: error.message });
      return reply.code(500).send({ error: 'Failed to update user role' });
    }
  });

  // Remove user from tenant
  fastify.delete('/current/users/:userId', { preHandler: [authenticateToken] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const { userId } = params;
    Logger.log('info', 'user', 'delete-tenant-user', 'DELETE /current/users/:userId hit', {
      userId, tenantId: request.userContext?.tenantId,
      isAuthenticated: !!request.userContext?.isAuthenticated, isTenantAdmin: request.userContext?.isTenantAdmin
    });

    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    try {
      const tenantId = request.userContext.tenantId;

      if (!userId) return reply.code(400).send({ success: false, error: 'Bad request', message: 'User ID is required' });
      if (!tenantId) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      if (!request.userContext.isTenantAdmin) {
        Logger.log('warning', 'user', 'delete-tenant-user', 'Delete rejected: user is not tenant admin');
        return reply.code(403).send({ success: false, error: 'Forbidden', message: 'Only tenant administrators can remove users' });
      }

      Logger.log('info', 'user', 'delete-tenant-user', 'Calling TenantService.removeUser', { tenantId, userId });
      const result = await TenantService.removeUser(tenantId, userId, request.userContext.internalUserId ?? '');

      // Notify downstream apps that the user has been removed from this tenant
      try {
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        await snsSqsPublisher.publishUserEventToSuite('user.deleted', tenantId, userId, {
          userId,
          tenantId,
          deletedBy: request.userContext.internalUserId ?? 'system',
          deletedAt: new Date().toISOString(),
        });
        Logger.log('info', 'user', 'delete-tenant-user', 'Published user.deleted event', { userId, tenantId });
      } catch (pubErr) {
        Logger.log('warning', 'user', 'delete-tenant-user', 'Failed to publish user.deleted event (non-fatal)', { userId, tenantId, error: (pubErr as Error).message });
      }

      Logger.log('info', 'user', 'delete-tenant-user', 'User removed successfully', { userId, tenantId });
      return { success: true, message: result?.message ?? 'User removed successfully' };
    } catch (err) {
      const error = err as Error;
      request.log.error(error, 'Error removing user:');
      if (error.message?.includes('last admin')) return reply.code(400).send({ success: false, error: 'Cannot remove last admin', message: error.message });
      if (error.message?.includes('not found') || error.message?.includes('User not found')) return reply.code(404).send({ success: false, error: 'User not found', message: error.message });
      return reply.code(500).send({ success: false, error: 'Failed to remove user', message: error.message || 'Failed to remove user' });
    }
  });

  // Get tenant usage statistics
  fastify.get('/usage', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ANALYTICS_DATA_READ)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { period, startDate, endDate } = query;
      const tenantId = (request as FastifyRequest & { userContext?: { tenantId?: string } }).userContext?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

      const usage = await (TenantService as { getTenantUsage?: (tid: string, opts: Record<string, unknown>) => Promise<Record<string, unknown>> }).getTenantUsage?.(tenantId, { period, startDate, endDate }) ?? { period, startDate, endDate, summary: {} };
      return { success: true, data: usage };
    } catch (err) {
      const error = err as Error;
      fastify.log.error(error, 'Error fetching tenant usage:');
      return reply.code(500).send({ error: 'Failed to fetch usage statistics' });
    }
  });

  // Promote user to admin
  fastify.post('/current/users/:userId/promote', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) return reply.code(403).send({ error: 'Insufficient permissions' });

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const tenantId = request.userContext.tenantId;

      const [updatedUser] = await db
        .update(tenantUsers)
        .set({ isTenantAdmin: true, updatedAt: new Date() } as Record<string, unknown>)
        .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId ?? '')))
        .returning();

      if (!updatedUser) return ErrorResponses.notFound(reply, 'User', 'User not found');
      return { success: true, message: 'User promoted to admin successfully', data: updatedUser };
    } catch (err) {
      request.log.error(err, 'Error promoting user:');
      return reply.code(500).send({ error: 'Failed to promote user' });
    }
  });

  // Deactivate user
  fastify.post('/current/users/:userId/deactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) return reply.code(403).send({ error: 'Insufficient permissions' });

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const tenantId = request.userContext.tenantId;

      if (userId === request.userContext.internalUserId) return reply.code(400).send({ error: 'Cannot deactivate yourself' });

      const [updatedUser] = await db
        .update(tenantUsers)
        .set({ isActive: false, updatedAt: new Date() } as Record<string, unknown>)
        .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId ?? '')))
        .returning();

      if (!updatedUser) return ErrorResponses.notFound(reply, 'User', 'User not found');

      try {
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        await snsSqsPublisher.publishUserEventToSuite('user_deactivated', tenantId ?? '', updatedUser.userId, {
          userId: updatedUser.userId, email: updatedUser.email,
          firstName: updatedUser.firstName, lastName: updatedUser.lastName,
          name: [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' ') || updatedUser.email || '',
          deactivatedAt: new Date().toISOString(), deactivatedBy: request.userContext.internalUserId, reason: 'manual_deactivation'
        });
        Logger.log('info', 'user', 'deactivate-tenant-user', 'Published user_deactivated event');
      } catch (publishErr) {
        Logger.log('warning', 'user', 'deactivate-tenant-user', 'Failed to publish user_deactivated event', { error: (publishErr as Error).message });
      }

      return { success: true, message: 'User deactivated successfully', data: updatedUser };
    } catch (err) {
      request.log.error(err, 'Error deactivating user:');
      return reply.code(500).send({ error: 'Failed to deactivate user' });
    }
  });

  // Reactivate user
  fastify.post('/current/users/:userId/reactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) return reply.code(403).send({ error: 'Insufficient permissions' });

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const tenantId = request.userContext.tenantId;

      const [updatedUser] = await db
        .update(tenantUsers)
        .set({ isActive: true, updatedAt: new Date() } as Record<string, unknown>)
        .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId ?? '')))
        .returning();

      if (!updatedUser) return ErrorResponses.notFound(reply, 'User', 'User not found');
      return { success: true, message: 'User reactivated successfully', data: updatedUser };
    } catch (err) {
      request.log.error(err, 'Error reactivating user:');
      return reply.code(500).send({ error: 'Failed to reactivate user' });
    }
  });

  // Update user details
  fastify.put('/current/users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });

    const params = request.params as Record<string, string>;
    const { userId } = params;
    const isUpdatingSelf = userId === request.userContext?.internalUserId;
    const isAdmin = request.userContext?.isAdmin || request.userContext?.isTenantAdmin;

    if (!isUpdatingSelf && !isAdmin) return reply.code(403).send({ error: 'Insufficient permissions' });

    try {
      const tenantId = request.userContext.tenantId;
      const body = request.body as Record<string, unknown>;
      const { name, email, title, department, isActive, isTenantAdmin } = body;

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (title !== undefined) updateData.title = title;
      if (department !== undefined) updateData.department = department;
      if (isAdmin && !isUpdatingSelf) {
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isTenantAdmin !== undefined) updateData.isTenantAdmin = isTenantAdmin;
      }

      const [updatedUser] = await db
        .update(tenantUsers)
        .set(updateData as Record<string, unknown>)
        .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId ?? '')))
        .returning();

      if (!updatedUser) return ErrorResponses.notFound(reply, 'User', 'User not found');
      return { success: true, message: 'User updated successfully', data: updatedUser };
    } catch (err) {
      request.log.error(err, 'Error updating user:');
      return reply.code(500).send({ error: 'Failed to update user' });
    }
  });

  // Resend invitation to user
  fastify.post('/current/users/:userId/resend-invite', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const tenantId = request.userContext.tenantId ?? '';
      const inviterName = request.userContext.name || request.userContext.email || 'Team Administrator';

      const result = await resendUserInvite(userId, tenantId, request.userContext.internalUserId ?? '', inviterName);

      if (!result.success) {
        if (result.error === 'User not found') return ErrorResponses.notFound(reply, 'User', 'User not found');
        if (result.error === 'User has already completed onboarding') {
          return reply.code(400).send({ error: result.error, message: 'Cannot resend invitation to users who have already joined' });
        }
        return reply.code(500).send({ error: result.error, message: 'Email service error occurred' });
      }

      return { success: true, message: result.message, data: result.data };
    } catch (err) {
      request.log.error(err, 'Error resending invitation:');
      return reply.code(500).send({ error: 'Failed to resend invitation' });
    }
  });

  // Assign roles to user
  fastify.post('/current/users/:userId/assign-roles', { schema: {} }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) return reply.code(403).send({ error: 'Insufficient permissions' });

    try {
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const { roleIds } = body;
      const tenantId = request.userContext.tenantId ?? '';

      Logger.log('info', 'role', 'assign-roles', 'Role assignment request', {
        userId, roleCount: Array.isArray(roleIds) ? roleIds.length : 0,
        tenantId, assignedBy: request.userContext.internalUserId
      });

      if (!Array.isArray(roleIds)) return reply.code(400).send({ error: 'roleIds must be an array' });

      const result = await assignRolesToUser(userId, tenantId, roleIds as string[], request.userContext.internalUserId ?? '');

      if (!result.success) {
        if (result.error === 'User not found') return ErrorResponses.notFound(reply, 'User', 'User not found');
        if (result.error === 'One or more roles not found') {
          return reply.code(400).send({ error: result.error });
        }
        return reply.code(500).send({ success: false, error: result.error, message: result.error ?? 'Unknown error occurred' });
      }

      return { success: true, message: result.message, data: result.data };
    } catch (err) {
      const error = err as Error;
      Logger.log('error', 'role', 'assign-roles', 'Error assigning roles', { error: error.message });
      request.log.error(err, 'Error assigning roles:');
      return reply.code(500).send({
        success: false, error: 'Failed to assign roles',
        message: error.message ?? 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Get all organization assignments for current tenant
  fastify.get('/current/organization-assignments', {
    schema: { description: 'Get all organization assignments for the current tenant', tags: ['Tenant', 'Organization Assignment'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const tenantId = request.userContext.tenantId ?? '';
      Logger.log('info', 'general', 'get-org-assignments', 'Organization assignments requested for tenant', { tenantId });

      const enrichedAssignments = await getOrganizationAssignments(tenantId);

      Logger.log('info', 'general', 'get-org-assignments', 'Returning enriched assignments', { count: enrichedAssignments.length });
      return { success: true, data: enrichedAssignments };
    } catch (err) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-org-assignments', 'Error fetching organization assignments', { error: error.message });
      return reply.code(500).send({ success: false, message: 'Failed to fetch organization assignments', error: error.message });
    }
  });

  // Assign a user to an organization
  fastify.post('/current/users/:userId/assign-organization', {
    schema: { description: 'Assign a user to an organization within the tenant', tags: ['Tenant', 'Organization Assignment'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const tenantId = request.userContext.tenantId ?? '';
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const { organizationId, assignmentType = 'primary', priority = 1, metadata = {} } = body;

      const result = await assignUserToOrganization(
        userId, tenantId, organizationId as string,
        assignmentType as string, priority as number, metadata as Record<string, unknown>,
        request.userContext.internalUserId ?? '',
        request as unknown as RequestContextLike
      );

      const statusCode = result.success ? (result.data ? 200 : 500) : 404;
      if (!result.success) return reply.code(statusCode).send({ success: false, message: result.message });

      return { success: true, message: result.message, data: result.data };
    } catch (err) {
      const error = err as Error;
      Logger.log('error', 'general', 'assign-organization', 'Error assigning user to organization', { error: error.message });
      return reply.code(500).send({ success: false, message: 'Failed to assign user to organization', error: error.message });
    }
  });

  // Update a user's organization assignment
  fastify.put('/current/users/:userId/update-organization', {
    schema: { description: 'Update a user\'s organization assignment within the tenant', tags: ['Tenant', 'Organization Assignment'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const tenantId = request.userContext.tenantId ?? '';
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const { organizationId, changes, assignmentId } = body;

      const result = await updateUserOrganizationAssignment(
        userId, tenantId, organizationId as string,
        changes as Record<string, unknown> | undefined,
        assignmentId as string | undefined,
        request.userContext.internalUserId ?? '',
        request as unknown as RequestContextLike
      );

      if (!result.success) return reply.code(404).send({ success: false, message: result.message });
      return { success: true, message: result.message, data: result.data };
    } catch (err) {
      const error = err as Error;
      Logger.log('error', 'general', 'update-organization', 'Error updating organization assignment', { error: error.message });
      return reply.code(500).send({ success: false, message: 'Failed to update organization assignment', error: error.message });
    }
  });

  // Remove a user from an organization
  fastify.delete('/current/users/:userId/remove-organization', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_DELETE)],
    schema: { description: 'Remove a user from an organization within the tenant', tags: ['Tenant', 'Organization Assignment'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const tenantId = request.userContext.tenantId ?? '';
      const params = request.params as Record<string, string>;
      const { userId } = params;
      const body = request.body as Record<string, unknown>;
      const { organizationId, reason = 'permanent_removal' } = body;

      const result = await removeUserFromOrganization(
        userId, tenantId, organizationId as string, reason as string,
        request.userContext.internalUserId ?? '',
        request as unknown as RequestContextLike
      );

      if (!result.success) return reply.code(404).send({ success: false, message: result.message });
      return { success: true, message: result.message, data: result.data };
    } catch (err) {
      const error = err as Error;
      Logger.log('error', 'general', 'remove-organization', 'Error removing user from organization', { error: error.message });
      return reply.code(500).send({ success: false, message: 'Failed to remove user from organization', error: error.message });
    }
  });

  // Bulk assign multiple users to organizations
  fastify.post('/current/users/bulk-assign-organizations', {
    schema: { description: 'Bulk assign multiple users to organizations within the tenant', tags: ['Tenant', 'Organization Assignment'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const tenantId = request.userContext.tenantId ?? '';
      const body = request.body as Record<string, unknown>;
      const { assignments } = body;
      const assignmentsList = Array.isArray(assignments) ? assignments : [];

      const data = await bulkAssignOrganizations(
        tenantId,
        assignmentsList as Array<{ userId: string; organizationId: string; assignmentType?: string; priority?: number }>,
        request.userContext.internalUserId ?? '',
        request as unknown as RequestContextLike
      );

      return {
        success: true,
        message: `Bulk assignment completed: ${data.successful} successful, ${data.failed} failed`,
        data
      };
    } catch (err) {
      const error = err as Error;
      Logger.log('error', 'general', 'bulk-assign-organizations', 'Error in bulk organization assignment', { error: error.message });
      return reply.code(500).send({ success: false, message: 'Failed to complete bulk organization assignment', error: error.message });
    }
  });

  // Export users as CSV
  fastify.get('/current/users/export', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userContext?.isAuthenticated) return reply.code(401).send({ error: 'Unauthorized' });
    if (!request.userContext?.isAdmin && !request.userContext?.isTenantAdmin) return reply.code(403).send({ error: 'Insufficient permissions' });

    try {
      const tenantId = request.userContext.tenantId;

      const users = await db
        .select({
          name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.email})`,
          email: tenantUsers.email,
          role: sql`CASE WHEN ${tenantUsers.isTenantAdmin} THEN 'Admin' ELSE 'User' END`,
          status: sql`CASE WHEN ${tenantUsers.isActive} THEN 'Active' ELSE 'Inactive' END`,
          onboardingCompleted: tenantUsers.onboardingCompleted,
          createdAt: tenantUsers.createdAt
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId ?? ''));

      const headers = ['Name', 'Email', 'Role', 'Status', 'Onboarding Completed', 'Created At'];
      const csvContent = [
        headers.join(','),
        ...users.map(user => [
          user.name || '', user.email, user.role, user.status,
          user.onboardingCompleted ? 'Yes' : 'No',
          (user.createdAt != null ? user.createdAt : new Date()).toISOString().split('T')[0]
        ].join(','))
      ].join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="users-export.csv"');
      return csvContent;
    } catch (err) {
      request.log.error(err, 'Error exporting users:');
      return reply.code(500).send({ error: 'Failed to export users' });
    }
  });
}
