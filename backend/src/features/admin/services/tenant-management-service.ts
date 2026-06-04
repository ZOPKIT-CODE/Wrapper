import { db } from '../../../db/index.js';
import {
  tenantUsers,
  userRoleAssignments,
  customRoles,
  tenantInvitations,
  entities,
  organizationMemberships,
} from '../../../db/schema/index.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import ActivityLogger, { ACTIVITY_TYPES } from '../../../services/activityLogger.js';
import { OrganizationAssignmentService } from '../../organizations/index.js';
import Logger from '../../../utils/logger.js';
import { TenantService } from '../../../services/tenant-service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RequestContextLike = Record<string, unknown> & {
  ip?: string;
  headers?: Record<string, string | undefined>;
  connection?: { remoteAddress?: string };
};

export interface UserContext {
  isAuthenticated?: boolean;
  tenantId?: string;
  internalUserId?: string;
  idpSub?: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
  isTenantAdmin?: boolean;
}

export interface ResendInviteResult {
  success: boolean;
  message?: string;
  data?: { email: string; invitationId: string; expiresAt: Date };
  error?: string;
}

export interface AssignRolesResult {
  success: boolean;
  message?: string;
  data?: { userId: string; assignedRoles: number };
  error?: string;
  details?: string;
}

export interface OrgAssignmentResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

// ─── Activity label helper ────────────────────────────────────────────────────

export function getActivityLabel(action: string): string {
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
    'data.import': 'Data imported',
  };

  if (actionMap[action]) return actionMap[action];

  return action
    .split('.')
    .map((part: string) =>
      part
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    )
    .join(' - ');
}

// ─── Resend invite ────────────────────────────────────────────────────────────

export async function resendUserInvite(
  userId: string,
  tenantId: string,
  invitedByUserId: string,
  inviterName: string
): Promise<ResendInviteResult> {
  // Get user details
  const [user] = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
    .limit(1);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (user.onboardingCompleted) {
    return {
      success: false,
      error: 'User has already completed onboarding',
    };
  }

  const { default: EmailService } = await import('../../../utils/email.js');
  const tenantDetails = await TenantService.getTenantDetails(tenantId);

  // Check for existing pending invitation
  const [existingInvitation] = await db
    .select()
    .from(tenantInvitations)
    .where(
      and(
        eq(tenantInvitations.tenantId, tenantId),
        eq(tenantInvitations.email, user.email),
        eq(tenantInvitations.status, 'pending')
      )
    )
    .limit(1);

  let invitationToken: string;
  let invitationId: string;

  if (existingInvitation) {
    invitationToken = existingInvitation.invitationToken;
    invitationId = existingInvitation.invitationId;

    await db
      .update(tenantInvitations)
      .set({
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } as Record<string, unknown>)
      .where(eq(tenantInvitations.invitationId, invitationId));

    Logger.log('info', 'email', 'resend-invitation', 'Resending existing invitation', {
      invitationId,
      email: user.email,
    });
  } else {
    invitationToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [newInvitation] = await db
      .insert(tenantInvitations)
      .values({
        tenantId,
        email: user.email,
        invitedBy: invitedByUserId,
        invitationToken,
        expiresAt,
        status: 'pending',
      } as any)
      .returning();

    invitationId = newInvitation.invitationId;
    Logger.log('info', 'email', 'resend-invitation', 'Created new invitation', {
      invitationId,
      email: user.email,
    });
  }

  const invitePayload = {
    email: user.email,
    tenantName: tenantDetails.companyName,
    roleName: 'Team Member',
    invitationToken,
    invitedByName: inviterName,
    message: `You're invited to join ${tenantDetails.companyName} on Wrapper. Please accept this invitation to get started.`,
  };

  const emailResult = await EmailService.sendUserInvitation(
    invitePayload as {
      email: string;
      tenantName: string;
      roleName: string;
      invitationToken: string;
      invitedByName: string;
      message?: string;
    }
  );

  if (emailResult.success) {
    Logger.log('info', 'email', 'resend-invitation', 'Invitation email sent successfully', {
      email: user.email,
    });
    return {
      success: true,
      message: `Invitation resent to ${user.email}`,
      data: {
        email: user.email,
        invitationId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    };
  }

  Logger.log('error', 'email', 'resend-invitation', 'Failed to send invitation email', {
    email: user.email,
    error: emailResult.error,
  });
  return { success: false, error: 'Email service error occurred' };
}

// ─── Assign roles ─────────────────────────────────────────────────────────────

export async function assignRolesToUser(
  userId: string,
  tenantId: string,
  roleIds: string[],
  assignedByUserId: string
): Promise<AssignRolesResult> {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validRoleIds = (roleIds as string[]).filter(
    (id): id is string => typeof id === 'string' && UUID_REGEX.test(id.trim())
  );

  // Verify user exists in this tenant
  const [user] = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
    .limit(1);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Verify all roles exist and belong to this tenant
  if (validRoleIds.length > 0) {
    const roles = await db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.tenantId, tenantId), inArray(customRoles.roleId, validRoleIds)));

    if (roles.length !== validRoleIds.length) {
      const foundRoleIds = roles.map((r) => r.roleId);
      const missingRoleIds = validRoleIds.filter((id) => !foundRoleIds.includes(id));
      Logger.log('warning', 'role', 'assign-roles', 'Missing roles', { missingRoleIds });
      return {
        success: false,
        error: 'One or more roles not found',
      };
    }
  }

  // Get existing assignments before removal for event publishing
  const existingAssignments = await db
    .select({ id: userRoleAssignments.id, roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments)
    .where(eq(userRoleAssignments.userId, userId));

  // Use transaction for atomic operation
  const newAssignments = await db.transaction(async (tx) => {
    Logger.log('info', 'role', 'assign-roles', 'Removing existing role assignments', { userId });
    await tx.delete(userRoleAssignments).where(eq(userRoleAssignments.userId, userId));

    let insertedAssignments: Array<{
      id?: string;
      roleId: string;
      assignedAt?: Date;
      assignedBy?: string | null;
    }> = [];

    if (validRoleIds.length > 0) {
      Logger.log('info', 'role', 'assign-roles', 'Adding new role assignments', {
        count: validRoleIds.length,
        userId,
      });
      const assignments = validRoleIds.map((roleId) => ({
        userId,
        roleId,
        assignedBy: assignedByUserId,
        assignedAt: new Date(),
        isActive: true,
      }));

      Logger.log('info', 'role', 'assign-roles', 'Assignment data prepared', {
        count: assignments.length,
      });
      const inserted = await tx
        .insert(userRoleAssignments)
        .values(assignments as any)
        .returning();
      insertedAssignments = inserted as Array<{
        id?: string;
        roleId: string;
        assignedAt?: Date;
        assignedBy?: string | null;
      }>;
      Logger.log('info', 'role', 'assign-roles', 'Successfully inserted role assignments');
    }
    return insertedAssignments;
  });

  // Publish role unassignment events for removed roles
  const removedRoleIds = existingAssignments
    .map((a) => a.roleId)
    .filter((roleId) => !validRoleIds.includes(roleId));

  if (removedRoleIds.length > 0) {
    try {
      for (const assignment of existingAssignments.filter((a) =>
        removedRoleIds.includes(a.roleId)
      )) {
        try {
          const { snsSqsPublisher } = await import(
            '../../messaging/utils/sns-sqs-publisher.js'
          );
          await snsSqsPublisher.publishRoleEventToSuite(
            'role_unassigned',
            tenantId,
            String(assignment.roleId),
            {
              assignmentId: (assignment as { id?: string }).id,
              userId,
              roleId: assignment.roleId,
              unassignedAt: new Date().toISOString(),
              unassignedBy: assignedByUserId,
              reason: 'Roles updated',
            }
          );
        } catch (streamErr) {
          const streamError = streamErr as Error;
          Logger.log(
            'warning',
            'role',
            'assign-roles',
            'Failed to publish role unassignment event',
            { error: streamError.message }
          );
        }
      }
      Logger.log('info', 'role', 'assign-roles', 'Published role unassignment events', {
        count: removedRoleIds.length,
      });
    } catch (publishErr) {
      const publishError = publishErr as Error;
      Logger.log(
        'warning',
        'role',
        'assign-roles',
        'Failed to publish some role unassignment events',
        { error: publishError.message }
      );
    }
  }

  // Publish role assignment events for new roles
  const newRoleIds = validRoleIds.filter(
    (roleId) => !existingAssignments.some((a) => a.roleId === roleId)
  );

  if (newRoleIds.length > 0 && newAssignments.length > 0) {
    try {
      for (const assignment of newAssignments.filter(
        (a: { roleId: string }) => newRoleIds.includes(a.roleId)
      )) {
        try {
          const { snsSqsPublisher } = await import(
            '../../messaging/utils/sns-sqs-publisher.js'
          );
          await snsSqsPublisher.publishRoleEventToSuite(
            'role_assigned',
            tenantId,
            String(assignment.roleId),
            {
              assignmentId: assignment.id,
              userId,
              roleId: assignment.roleId,
              assignedAt:
                assignment.assignedAt
                  ? typeof assignment.assignedAt === 'string'
                    ? assignment.assignedAt
                    : (assignment.assignedAt as Date).toISOString()
                  : new Date().toISOString(),
              assignedBy: assignment.assignedBy ?? assignedByUserId,
              expiresAt: (assignment as { expiresAt?: Date | string }).expiresAt,
              entityId: (assignment as { organizationId?: string }).organizationId,
            }
          );
          Logger.log('info', 'role', 'assign-roles', 'Published role assignment event', {
            roleId: assignment.roleId,
          });
        } catch (streamErr) {
          const streamError = streamErr as Error;
          Logger.log(
            'warning',
            'role',
            'assign-roles',
            'Failed to publish role assignment event',
            { error: streamError.message }
          );
        }
      }
      Logger.log('info', 'role', 'assign-roles', 'Published role assignment events', {
        count: newRoleIds.length,
      });
    } catch (publishErr) {
      const publishError = publishErr as Error;
      Logger.log(
        'warning',
        'role',
        'assign-roles',
        'Failed to publish some role assignment events',
        { error: publishError.message }
      );
    }
  }

  return {
    success: true,
    message: 'Roles updated successfully for user',
    data: { userId, assignedRoles: validRoleIds.length },
  };
}

// ─── Get organization assignments ─────────────────────────────────────────────

export async function getOrganizationAssignments(tenantId: string) {
  const memberships = await db
    .select({
      membershipId: organizationMemberships.membershipId,
      userId: organizationMemberships.userId,
      userName: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.email})`,
      userEmail: tenantUsers.email,
      entityId: organizationMemberships.entityId,
      entityType: entities.entityType,
      membershipType: organizationMemberships.membershipType,
      membershipStatus: organizationMemberships.membershipStatus,
      accessLevel: organizationMemberships.accessLevel,
      isPrimary: organizationMemberships.isPrimary,
      assignedAt: organizationMemberships.createdAt,
      entityName: entities.entityName,
    })
    .from(organizationMemberships)
    .innerJoin(tenantUsers, eq(organizationMemberships.userId, tenantUsers.userId))
    .innerJoin(entities, eq(organizationMemberships.entityId, entities.entityId))
    .where(
      and(
        eq(organizationMemberships.tenantId, tenantId),
        eq(organizationMemberships.membershipStatus, 'active'),
        eq(tenantUsers.isActive, true),
        eq(entities.isActive, true)
      )
    );

  return memberships.map((membership) => ({
    assignmentId: membership.membershipId,
    userId: membership.userId,
    userName: membership.userName,
    userEmail: membership.userEmail,
    organizationId: membership.entityId,
    entityId: membership.entityId,
    entityType: membership.entityType,
    organizationName: membership.entityName,
    entityName: membership.entityName,
    organizationCode: membership.entityId,
    entityCode: membership.entityId,
    assignmentType: membership.membershipType,
    accessLevel: membership.accessLevel,
    isPrimary: membership.isPrimary,
    isActive: membership.membershipStatus === 'active',
    assignedAt: membership.assignedAt?.toISOString(),
    priority: membership.isPrimary ? 1 : 2,
  }));
}

// ─── Assign user to organization ──────────────────────────────────────────────

export async function assignUserToOrganization(
  userId: string,
  tenantId: string,
  organizationId: string,
  assignmentType: string,
  priority: number,
  metadata: Record<string, unknown>,
  assignedByUserId: string,
  requestContext: RequestContextLike
): Promise<OrgAssignmentResult> {
  // Validate user belongs to tenant
  const user = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
    .limit(1);

  if (user.length === 0) {
    return { success: false, message: 'User not found in this tenant' };
  }

  // Validate organization belongs to tenant
  const organization = await db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.entityId, organizationId),
        eq(entities.tenantId, tenantId),
        eq(entities.isActive, true)
      )
    )
    .limit(1);

  if (organization.length === 0) {
    return { success: false, message: 'Organization not found in this tenant' };
  }

  // Check if already assigned
  const existingMembership = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.tenantId, tenantId),
        eq(organizationMemberships.entityId, organizationId),
        eq(organizationMemberships.membershipStatus, 'active')
      )
    )
    .limit(1);

  if (existingMembership.length > 0) {
    return {
      success: true,
      message: 'User is already assigned to this organization',
      data: {
        membershipId: existingMembership[0].membershipId,
        userId,
        organizationId,
        organizationName: organization[0].entityName,
        membershipType: existingMembership[0].membershipType,
        accessLevel: existingMembership[0].accessLevel,
        assignedAt: existingMembership[0].createdAt?.toISOString(),
      },
    };
  }

  const membershipId = randomUUID();
  const hasPrimaryOrg = !!(user[0] as { primaryOrganizationId?: string | null })
    .primaryOrganizationId;

  const assignmentData = {
    assignmentId: membershipId,
    tenantId,
    userId,
    organizationId,
    organizationCode: organization[0].entityId,
    assignmentType,
    isActive: true,
    assignedAt: new Date().toISOString(),
    priority,
    assignedBy: assignedByUserId,
    metadata,
  };

  // Atomic: the membership insert (+ primary-org update) and the
  // organization.assignment.created event commit in ONE tx (tx-bound publish skips
  // synchronous SNS; the poller delivers post-commit; a failure rolls the write back).
  const newMembership = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(organizationMemberships)
      .values({
        membershipId,
        userId,
        tenantId,
        entityId: organizationId,
        entityType: 'organization',
        membershipType: assignmentType || 'direct',
        membershipStatus: 'active',
        accessLevel: 'standard',
        isPrimary: !hasPrimaryOrg,
        createdBy: assignedByUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    if (inserted.length === 0) return inserted; // skip publish; soft-fail below

    if (!hasPrimaryOrg) {
      await tx
        .update(tenantUsers)
        .set({ primaryOrganizationId: organizationId, updatedAt: new Date() })
        .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)));
    }

    await OrganizationAssignmentService.publishOrgAssignmentCreated(assignmentData, {}, tx);
    return inserted;
  });

  if (newMembership.length === 0) {
    return { success: false, message: 'Failed to create organization membership' };
  }

  await ActivityLogger.logActivity(
    assignedByUserId,
    tenantId,
    organizationId,
    ACTIVITY_TYPES.USER_ORGANIZATION_ASSIGNED,
    {
      userId,
      userEmail: (user[0] as { email: string }).email,
      organizationId,
      organizationName: (organization[0] as { entityName: string }).entityName,
      assignmentType,
      assignedBy: assignedByUserId,
      tenantId,
    },
    ActivityLogger.createRequestContext(requestContext)
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
      assignedAt: newMembership[0].createdAt?.toISOString(),
    },
  };
}

// ─── Update organization assignment ──────────────────────────────────────────

export async function updateUserOrganizationAssignment(
  userId: string,
  tenantId: string,
  organizationId: string,
  changes: Record<string, unknown> | undefined,
  assignmentId: string | undefined,
  updatedByUserId: string,
  requestContext: RequestContextLike
): Promise<OrgAssignmentResult> {
  const user = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
    .limit(1);

  if (user.length === 0) {
    return { success: false, message: 'User not found in this tenant' };
  }

  const organization = await db
    .select()
    .from(entities)
    .where(and(eq(entities.entityId, organizationId), eq(entities.tenantId, tenantId)))
    .limit(1);

  if (organization.length === 0) {
    return { success: false, message: 'Organization not found in this tenant' };
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (changes?.isActive !== undefined) updateData.isActive = changes.isActive;
  if (changes?.organizationId != null)
    updateData.primaryOrganizationId = changes.organizationId as string | null;

  const eventData = {
    assignmentId: assignmentId || `${userId}_${organizationId}_${Date.now()}`,
    tenantId,
    userId,
    organizationId,
    changes,
    updatedBy: updatedByUserId,
  };

  // Atomic: the user update and the organization.assignment.updated event commit
  // in ONE tx (tx-bound publish; a publish/outbox failure rolls the write back).
  const updatedUser = await db.transaction(async (tx) => {
    const rows = await tx
      .update(tenantUsers)
      .set(updateData)
      .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
      .returning();

    if (rows.length === 0) return rows; // skip publish; soft-fail below

    await OrganizationAssignmentService.publishOrgAssignmentUpdated(eventData, {}, tx);
    Logger.log('info', 'general', 'update-organization', 'Queued organization assignment updated event (tx)', { userId });
    return rows;
  });

  if (updatedUser.length === 0) {
    return { success: false, message: 'User not found' };
  }

  await ActivityLogger.logActivity(
    updatedByUserId,
    tenantId,
    organizationId,
    ACTIVITY_TYPES.USER_ORGANIZATION_UPDATED,
    {
      userId,
      userEmail: (user[0] as { email: string }).email,
      organizationId,
      changes,
      updatedBy: updatedByUserId,
      tenantId,
    },
    ActivityLogger.createRequestContext(requestContext)
  );

  return {
    success: true,
    message: 'Organization assignment updated successfully',
    data: {
      userId,
      organizationId,
      changes,
      updatedAt: (updateData.updatedAt as Date).toISOString(),
    },
  };
}

// ─── Remove user from organization ───────────────────────────────────────────

export async function removeUserFromOrganization(
  userId: string,
  tenantId: string,
  organizationId: string,
  reason: string,
  removedByUserId: string,
  requestContext: RequestContextLike
): Promise<OrgAssignmentResult> {
  const user = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
    .limit(1);

  if (user.length === 0) {
    return { success: false, message: 'User not found in this tenant' };
  }

  const membership = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.tenantId, tenantId),
        eq(organizationMemberships.entityId, organizationId),
        eq(organizationMemberships.membershipStatus, 'active')
      )
    )
    .limit(1);

  if (membership.length === 0) {
    return { success: false, message: 'User organization membership not found' };
  }

  const assignmentData = {
    assignmentId: membership[0].membershipId,
    tenantId,
    userId,
    organizationId,
    deletedBy: removedByUserId,
    reason,
  };

  // Atomic: the membership deactivation (+ primary-org promotion/clear) and the
  // organization.assignment.deleted event commit in ONE tx (tx-bound publish;
  // a publish/outbox failure rolls back all of it).
  const updatedMembership = await db.transaction(async (tx) => {
    const rows = await tx
      .update(organizationMemberships)
      .set({
        membershipStatus: 'inactive',
        updatedBy: removedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(organizationMemberships.membershipId, membership[0].membershipId))
      .returning();

    if (rows.length === 0) return rows; // skip publish; soft-fail below

    // If this was the primary organization, promote another or clear it
    if (membership[0].isPrimary) {
      const otherMemberships = await tx
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.tenantId, tenantId),
            eq(organizationMemberships.membershipStatus, 'active')
          )
        );

      if (otherMemberships.length > 0) {
        await tx
          .update(organizationMemberships)
          .set({ isPrimary: true, updatedBy: removedByUserId, updatedAt: new Date() })
          .where(
            eq(organizationMemberships.membershipId, otherMemberships[0].membershipId)
          );

        await tx
          .update(tenantUsers)
          .set({ primaryOrganizationId: otherMemberships[0].entityId, updatedAt: new Date() })
          .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)));
      } else {
        await tx
          .update(tenantUsers)
          .set({ primaryOrganizationId: null, updatedAt: new Date() })
          .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)));
      }
    }

    await OrganizationAssignmentService.publishOrgAssignmentDeleted(assignmentData, tx);
    Logger.log('info', 'general', 'remove-organization', 'Queued organization assignment deleted event (tx)', { userId });
    return rows;
  });

  if (updatedMembership.length === 0) {
    return { success: false, message: 'Failed to remove organization membership' };
  }

  await ActivityLogger.logActivity(
    removedByUserId,
    tenantId,
    organizationId,
    ACTIVITY_TYPES.USER_ORGANIZATION_REMOVED,
    {
      userId,
      userEmail: (user[0] as { email: string }).email,
      organizationId,
      reason,
      removedBy: removedByUserId,
      tenantId,
    },
    ActivityLogger.createRequestContext(requestContext)
  );

  return {
    success: true,
    message: 'User successfully removed from organization',
    data: { userId, organizationId, removedAt: new Date().toISOString() },
  };
}

// ─── Bulk assign organizations ────────────────────────────────────────────────

export async function bulkAssignOrganizations(
  tenantId: string,
  assignments: Array<{
    userId: string;
    organizationId: string;
    assignmentType?: string;
    priority?: number;
  }>,
  assignedByUserId: string,
  requestContext: RequestContextLike
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{ success: boolean; userId?: string; assignmentId?: string; error?: string }>;
}> {
  const results: Array<{
    success: boolean;
    userId?: string;
    assignmentId?: string;
    error?: string;
  }> = [];

  for (const assignment of assignments) {
    try {
      await db
        .update(tenantUsers)
        .set({ primaryOrganizationId: assignment.organizationId, updatedAt: new Date() } as Record<
          string,
          unknown
        >)
        .where(
          and(
            eq(tenantUsers.userId, assignment.userId),
            eq(tenantUsers.tenantId, tenantId)
          )
        );

      const assignmentId = `${assignment.userId}_${assignment.organizationId}_${Date.now()}`;
      results.push({ success: true, userId: assignment.userId, assignmentId });
    } catch (err) {
      const error = err as Error;
      Logger.log(
        'error',
        'general',
        'bulk-assign-organizations',
        'Failed to assign user',
        { userId: assignment.userId, error: error.message }
      );
      results.push({ success: false, userId: assignment.userId, error: error.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  Logger.log('info', 'general', 'bulk-assign-organizations', 'Published organization assignment events', {
    count: successCount,
  });

  await ActivityLogger.logActivity(
    assignedByUserId,
    tenantId,
    null,
    ACTIVITY_TYPES.BULK_USER_ORGANIZATION_ASSIGNED,
    {
      totalAssignments: assignments.length,
      successful: successCount,
      failed: failureCount,
      assignments: results,
      tenantId,
    },
    ActivityLogger.createRequestContext(requestContext)
  );

  return { total: assignments.length, successful: successCount, failed: failureCount, results };
}
