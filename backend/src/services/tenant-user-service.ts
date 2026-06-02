/**
 * Tenant User Service — User listing, entity filtering, deletion, role updates,
 * invitation management (invite, accept, resend, cancel).
 *
 * Extracted from tenant-service.ts (god-object split).
 * The TenantService facade in tenant-service.ts re-exports all these methods
 * for backward compatibility.
 */

import { eq, and, desc, count, ne, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  tenantInvitations,
  tenantUsers,
  customRoles,
  userRoleAssignments,
  organizationMemberships,
  entities,
  auditLogs,
} from '../db/schema/index.js';
import { v4 as uuidv4 } from 'uuid';
import { adminCreateUser } from '../features/auth/services/cognito-admin-service.js';
import { getEmailProvider } from '../features/notifications/adapters/brevo-adapter.js';
import { snsSqsPublisher } from '../features/messaging/utils/sns-sqs-publisher.js';
import { TenantCoreService } from './tenant-core-service.js';
import Logger from '../utils/logger.js';

export class TenantUserService {
  // ---------------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------------

  // Invite user to tenant
  static async inviteUser(data: {
    tenantId: string;
    email: string;
    roleId?: string | null;
    invitedBy: string;
    entities?: Array<{ entityId?: string; roleId?: string | null; entityType?: string | null; membershipType?: string }>;
    primaryEntityId?: string | null;
    message?: string;
  }): Promise<typeof tenantInvitations.$inferSelect> {
    const invitationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.tenantId, data.tenantId),
          eq(tenantUsers.email, data.email)
        ))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error('User is already a member of this organization');
      }

      // Normalize multi-entity payload if present
      let invitationScope = 'tenant';
      let targetEntities: Array<{ entityId?: string; roleId?: string | null; entityType?: string | null; membershipType?: string }> = [];
      let primaryEntityId: string | null = null;

      if (Array.isArray(data.entities) && data.entities.length > 0) {
        invitationScope = 'multi-entity';
        targetEntities = data.entities
          .filter((entity: { entityId?: string }) => entity?.entityId)
          .map((entity: { entityId?: string; roleId?: string | null; entityType?: string | null; membershipType?: string }) => ({
            entityId: entity.entityId,
            roleId: entity.roleId || null,
            entityType: entity.entityType || null,
            membershipType: entity.membershipType || 'direct'
          }));

        primaryEntityId = data.primaryEntityId || targetEntities[0]?.entityId || null;
      } else if (data.primaryEntityId) {
        invitationScope = 'organization';
        primaryEntityId = data.primaryEntityId;
      } else if (data.roleId) {
        invitationScope = 'tenant';
      }

      // Generate invitation URL with proper environment detection
      let baseUrl = process.env.INVITATION_BASE_URL || process.env.FRONTEND_URL;

      // In development, default to localhost:3001 if no URL is set
      if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        if (process.env.NODE_ENV === 'production') {
          // In production, use zopkit.com as fallback if no env var is set
          baseUrl = process.env.BASE_URL || 'https://zopkit.com';
        } else {
          // In development, use localhost
          baseUrl = 'http://localhost:3001';
        }
      }

      const invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;

      // Ensure we always have a valid URL
      if (!invitationUrl || !invitationUrl.startsWith('http')) {
        throw new Error(`Invalid invitation URL generated: ${invitationUrl}`);
      }

      Logger.log('info', 'email', 'invite-user', 'Generated invitation URL', { invitationUrl, baseUrl });

      // Create invitation
      Logger.log('info', 'email', 'invite-user', 'Saving invitation to database', { email: data.email, invitationScope, hasUrl: !!invitationUrl });

      const invitationValues = {
        tenantId: data.tenantId,
        email: data.email,
        roleId: data.roleId ?? null,
        invitedBy: data.invitedBy,
        invitationToken,
        invitationUrl,
        expiresAt,
        invitationScope,
        primaryEntityId,
        targetEntities: JSON.parse(JSON.stringify(targetEntities)),
      };
      const [invitation] = await db.insert(tenantInvitations).values(invitationValues).returning();

      Logger.log('info', 'email', 'invite-user', 'Invitation saved to database', { invitationId: invitation.invitationId, email: invitation.email, hasStoredUrl: !!invitation.invitationUrl });

      // Get tenant and role details for email
      const tenant = await TenantCoreService.getTenantDetails(data.tenantId);
      const [role] = data.roleId
        ? await db.select().from(customRoles).where(eq(customRoles.roleId, data.roleId)).limit(1)
        : [undefined];

      // Get inviter's name
      const [inviter] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, data.invitedBy))
        .limit(1);

      // Send invitation email
      Logger.log('info', 'email', 'invite-user', 'Preparing to send invitation email', { email: data.email });
      try {
        const roleName = role?.roleName || 'Member';

        // Get organization and location names for the email
        let organizations = [];
        let locations = [];

        if (Array.isArray(targetEntities) && targetEntities.length > 0) {
          for (const entity of targetEntities) {
            if (entity.entityId) {
              const [entityRecord] = await db
                .select({
                  entityId: entities.entityId,
                  entityName: entities.entityName,
                  entityType: entities.entityType
                })
                .from(entities)
                .where(eq(entities.entityId, entity.entityId))
                .limit(1);

              if (entityRecord) {
                if (entityRecord.entityType === 'organization') {
                  organizations.push(entityRecord.entityName);
                } else if (entityRecord.entityType === 'location') {
                  locations.push(entityRecord.entityName);
                }
              }
            }
          }
        } else if (primaryEntityId) {
          // For single-entity invitations, get the entity name
          const [entityRecord] = await db
            .select({
              entityName: entities.entityName,
              entityType: entities.entityType
            })
            .from(entities)
            .where(eq(entities.entityId, primaryEntityId))
            .limit(1);

          if (entityRecord) {
            if (entityRecord.entityType === 'organization') {
              organizations.push(entityRecord.entityName);
            } else if (entityRecord.entityType === 'location') {
              locations.push(entityRecord.entityName);
            }
          }
        }

        Logger.log('info', 'email', 'invite-user', 'Sending invitation email', { email: data.email, tenantName: (tenant as { companyName: string }).companyName, roleName, organizations: organizations.length, locations: locations.length });

        const emailResult = await getEmailProvider().sendUserInvitation({
          email: data.email,
          tenantName: (tenant as { companyName: string }).companyName,
          roleName,
          invitationToken,
          invitedByName: inviter ? ([inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviter.email) : 'Team Administrator',
          message: data.message,
          invitedDate: invitation.createdAt ?? undefined,
          expiryDate: invitation.expiresAt ? (typeof invitation.expiresAt === 'string' ? invitation.expiresAt : invitation.expiresAt.toISOString()) : undefined,
          organizations: organizations.length > 0 ? organizations : undefined,
          locations: locations.length > 0 ? locations : undefined,
        });

        Logger.log('info', 'email', 'invite-user', 'Invitation email sent successfully', { email: data.email });
      } catch (err: unknown) {
        const emailError = err as Error & { response?: { data?: unknown } };
        Logger.log('error', 'email', 'invite-user', 'Failed to send invitation email', { email: data.email, error: emailError.message });

        // Don't fail the entire invitation process if email fails
        // The invitation is still created and can be resent later
        Logger.log('warning', 'email', 'invite-user', 'Invitation created but email failed');
      }

      return invitation;
    } catch (error) {
      Logger.log('error', 'email', 'invite-user', 'Failed to invite user', { error: (error as Error).message });
      throw error;
    }
  }

  // Accept invitation
  static async acceptInvitation(
    invitationToken: string,
    kindeUserId: string,
    userData: { email: string; firstName?: string; lastName?: string }
  ): Promise<typeof tenantUsers.$inferSelect> {
    try {
      return await db.transaction(async (tx) => {
        // Get invitation
        const [invitation] = await tx
          .select()
          .from(tenantInvitations)
          .where(and(
            eq(tenantInvitations.invitationToken, invitationToken),
            eq(tenantInvitations.status, 'pending')
          ))
          .limit(1);

        if (!invitation) {
          throw new Error('Invalid or expired invitation');
        }

        if (invitation.expiresAt < new Date()) {
          throw new Error('Invitation has expired');
        }

        // Create user
        const [user] = await tx.insert(tenantUsers).values({
          tenantId: invitation.tenantId,
          idpSub: kindeUserId,
          email: userData.email,
          firstName: userData.firstName ?? null,
          lastName: userData.lastName ?? null,
          isVerified: true,
        }).returning();

        // Collect role assignments so we can publish role_assigned to other apps after commit
        const roleAssignmentsToPublish = [];

        // Assign role if available
        if (invitation.roleId) {
          const [mainAssignment] = await tx.insert(userRoleAssignments).values({
            userId: user.userId,
            roleId: invitation.roleId,
            assignedBy: invitation.invitedBy,
          }).returning();
          if (mainAssignment) {
            roleAssignmentsToPublish.push(mainAssignment);
          }
        }

        // Handle multi-entity or scoped invitations
        const targetEntitiesList = Array.isArray(invitation.targetEntities) ? invitation.targetEntities : [];
        if (targetEntitiesList.length > 0) {
          for (const entity of targetEntitiesList as Array<{ entityId?: string; roleId?: string | null; entityType?: string | null; membershipType?: string }>) {
            if (!entity.entityId) continue;

            await tx.insert(organizationMemberships).values({
              userId: user.userId,
              tenantId: invitation.tenantId,
              entityId: entity.entityId,
              entityType: entity.entityType || 'organization',
              roleId: entity.roleId || invitation.roleId,
              membershipType: entity.membershipType || 'direct',
              membershipStatus: 'active',
              isPrimary: invitation.primaryEntityId === entity.entityId,
              canAccessSubEntities: true,
              invitedBy: invitation.invitedBy,
              invitedAt: invitation.createdAt,
              joinedAt: new Date(),
              createdBy: invitation.invitedBy,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Assign scoped role if provided
            if (entity.roleId) {
              const [scopedAssignment] = await tx.insert(userRoleAssignments).values({
                userId: user.userId,
                roleId: entity.roleId,
                assignedBy: invitation.invitedBy,
                organizationId: entity.entityType === 'organization' ? entity.entityId : null,
                locationId: entity.entityType === 'location' ? entity.entityId : null,
                scope: entity.entityType === 'location' ? 'location' : 'organization'
              }).returning();
              if (scopedAssignment) {
                roleAssignmentsToPublish.push(scopedAssignment);
              }
            }
          }
        } else if (invitation.primaryEntityId) {
          // Legacy single-entity invitation - create membership and scoped role
          await tx.insert(organizationMemberships).values({
            userId: user.userId,
            tenantId: invitation.tenantId,
            entityId: invitation.primaryEntityId,
            entityType: 'organization',
            roleId: invitation.roleId,
            membershipType: 'direct',
            membershipStatus: 'active',
            isPrimary: true,
            canAccessSubEntities: true,
            invitedBy: invitation.invitedBy,
            invitedAt: invitation.createdAt,
            joinedAt: new Date(),
            createdBy: invitation.invitedBy,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Update user's primary organization if specified
        if (invitation.primaryEntityId) {
          await tx
            .update(tenantUsers)
            .set({
              primaryOrganizationId: invitation.primaryEntityId,
              updatedAt: new Date()
            })
            .where(eq(tenantUsers.userId, user.userId));

          // Publish organization assignment created event (async, don't wait)
          setImmediate(async () => {
            try {
              const { OrganizationAssignmentService } = await import('../features/organizations/services/organization-assignment-service.js');

              // Get organization details for event
              const primaryId = invitation.primaryEntityId;
              const [organization] = primaryId
                ? await db
                    .select({
                      entityId: entities.entityId,
                      entityName: entities.entityName,
                    })
                    .from(entities)
                    .where(and(
                      eq(entities.entityId, primaryId),
                      eq(entities.tenantId, invitation.tenantId)
                    ))
                    .limit(1)
                : [];

              if (organization) {
                const assignmentData = {
                  assignmentId: `${user.userId}_${invitation.primaryEntityId}_${Date.now()}`,
                  tenantId: invitation.tenantId,
                  userId: user.userId,
                  organizationId: invitation.primaryEntityId,
                  organizationCode: organization.entityId,
                  assignmentType: 'primary',
                  isActive: true,
                  assignedAt: new Date().toISOString(),
                  priority: 1,
                  assignedBy: invitation.invitedBy,
                  metadata: {
                    source: 'invitation_acceptance',
                    invitationId: invitation.invitationId
                  }
                };

                await OrganizationAssignmentService.publishOrgAssignmentCreated(assignmentData);
                Logger.log('info', 'user', 'accept-invitation', 'Published organization assignment created event', { email: user.email });
              }
            } catch (err: unknown) {
              const publishError = err as Error;
              Logger.log('error', 'user', 'accept-invitation', 'Failed to publish org assignment event', { error: publishError.message });
            }
          });
        }

        // Update invitation status
        await tx
          .update(tenantInvitations)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
          })
          .where(eq(tenantInvitations.invitationId, invitation.invitationId));

        // Ensure the invited user has a Cognito account so they can sign in (best effort).
        // Org membership itself is owned by the Wrapper DB (written above), so there is no
        // org-sync step — only the Cognito user-lifecycle create that used to ride along
        // with the Kinde org assignment.
        setImmediate(async () => {
          try {
            await adminCreateUser({
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
            });
            Logger.log('info', 'cognito', 'accept-invitation', 'Ensured Cognito account for invited user', { email: userData.email });
          } catch (err: unknown) {
            const e = err as Error;
            Logger.log('warning', 'cognito', 'accept-invitation', 'Failed to ensure Cognito account for invited user', { error: e.message });
          }
        });

        // Publish user creation event to Amazon MQ for suite sync
        try {
          const firstName = user.firstName || '';
          const lastName = user.lastName || '';

          await snsSqsPublisher.publishUserEventToSuite('user_created', invitation.tenantId, user.userId, {
            userId: user.userId,
            email: user.email,
            kindeUserId: user.idpSub,
            firstName: firstName,
            lastName: lastName,
            name: [firstName, lastName].filter(Boolean).join(' ') || user.email,
            isActive: user.isActive !== undefined ? user.isActive : true,
            createdAt: user.createdAt ? (typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString()) : new Date().toISOString()
          });
          Logger.log('info', 'user', 'accept-invitation', 'Published user_created event to Amazon MQ');
        } catch (err: unknown) {
          const streamError = err as Error;
          Logger.log('error', 'user', 'accept-invitation', 'Failed to publish user_created event', { error: streamError.message });
        }

        // Publish role_assigned for each role so other apps get the role (after transaction commits)
        if (roleAssignmentsToPublish.length > 0) {
          const tenantId = invitation.tenantId;
          const userId = user.userId;
          const assignedBy = invitation.invitedBy;
          const assignments = roleAssignmentsToPublish;
          setImmediate(async () => {
            try {
              for (const a of assignments) {
                await snsSqsPublisher.publishRoleEventToSuite('role_assigned', tenantId, a.roleId, {
                  assignmentId: a.id,
                  userId,
                  roleId: a.roleId,
                  assignedAt: a.assignedAt ? (typeof a.assignedAt === 'string' ? a.assignedAt : a.assignedAt.toISOString()) : new Date().toISOString(),
                  assignedBy,
                  expiresAt: (a as { expiresAt?: Date | string }).expiresAt,
                  entityId: (a as { organizationId?: string }).organizationId
                });
              }
              Logger.log('info', 'user', 'accept-invitation', 'Published role_assigned events', { count: assignments.length });
            } catch (err: unknown) {
              const publishError = err as Error;
              Logger.log('error', 'user', 'accept-invitation', 'Failed to publish role_assigned events', { error: publishError.message });
            }
          });
        }

        return user;
      });
    } catch (error) {
      Logger.log('error', 'user', 'accept-invitation', 'Failed to accept invitation', { error: (error as Error).message });
      throw error;
    }
  }

  // Get pending invitations
  static async getPendingInvitations(tenantId: string) {
    return await db
      .select({
        invitation: tenantInvitations,
        role: customRoles,
      })
      .from(tenantInvitations)
      .leftJoin(customRoles, eq(tenantInvitations.roleId, customRoles.roleId))
      .where(and(
        eq(tenantInvitations.tenantId, tenantId),
        eq(tenantInvitations.status, 'pending')
      ))
      .orderBy(desc(tenantInvitations.createdAt));
  }

  // Resend invitation email
  static async resendInvitationEmail(invitationId: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get invitation details
      const [invitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.invitationId, invitationId),
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.status, 'pending')
        ))
        .limit(1);

      if (!invitation) {
        throw new Error('Invitation not found or not pending');
      }

      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        throw new Error('Invitation has expired');
      }

      // Get tenant and role details
      const tenant = await TenantCoreService.getTenantDetails(tenantId);
      const [role] = invitation.roleId
        ? await db.select().from(customRoles).where(eq(customRoles.roleId, invitation.roleId)).limit(1)
        : [undefined];

      // Get inviter's name
      const [inviter] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, invitation.invitedBy))
        .limit(1);

      // Send invitation email (tenant_invitations has no message column; use empty string)
      const roleRow = role as { roleName?: string } | undefined;
      await getEmailProvider().sendUserInvitation({
        email: invitation.email,
        tenantName: (tenant as { companyName: string }).companyName,
        roleName: roleRow?.roleName ?? 'Member',
        invitationToken: invitation.invitationToken,
        invitedByName: inviter ? ([inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviter.email) : 'Team Administrator',
        message: '',
        invitedDate: invitation.createdAt ?? undefined,
        expiryDate: invitation.expiresAt ?? undefined,
      });

      // Update invitation with new expiry (extend by 7 days)
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(tenantInvitations)
        .set({
          expiresAt: newExpiresAt,
          updatedAt: new Date()
        })
        .where(eq(tenantInvitations.invitationId, invitationId));

      Logger.log('info', 'email', 'resend-invitation', 'Invitation email resent successfully', { email: invitation.email });
      return { success: true, message: 'Invitation email resent successfully' };

    } catch (error) {
      Logger.log('error', 'email', 'resend-invitation', 'Failed to resend invitation email', { error: (error as Error).message });
      throw error;
    }
  }

  // Cancel invitation
  static async cancelInvitation(tenantId: string, invitationId: string, cancelledBy?: string): Promise<{ success: boolean; message: string }> {
    try {
      Logger.log('info', 'email', 'cancel-invitation', 'Cancelling invitation', { tenantId, invitationId, cancelledBy });

      // Check if invitation exists and belongs to tenant
      const [invitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.invitationId, invitationId),
          eq(tenantInvitations.tenantId, tenantId)
        ))
        .limit(1);

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Can only cancel pending invitations');
      }

      // Cancel the invitation
      await db
        .update(tenantInvitations)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: cancelledBy
        })
        .where(eq(tenantInvitations.invitationId, invitationId));

      Logger.log('info', 'email', 'cancel-invitation', 'Invitation cancelled successfully', { invitationId, tenantId });
      return { success: true, message: 'Invitation cancelled successfully' };
    } catch (error) {
      Logger.log('error', 'email', 'cancel-invitation', 'Error cancelling invitation', { error: (error as Error).message });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // User listing
  // ---------------------------------------------------------------------------

  // Get tenant users with consolidated invitation data
  static async getTenantUsers(tenantId: string): Promise<Array<Record<string, unknown>>> {
    try {
      Logger.log('info', 'user', 'get-tenant-users', 'Getting users for tenant', { tenantId });

      // Get active users
      const activeUsers = await db
        .select({
          userId: tenantUsers.userId,
          tenantId: tenantUsers.tenantId,
          kindeUserId: tenantUsers.idpSub,
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          isActive: tenantUsers.isActive,
          isVerified: tenantUsers.isVerified,
          isTenantAdmin: tenantUsers.isTenantAdmin,
          invitedAt: tenantUsers.invitedAt,
          lastActiveAt: tenantUsers.lastActiveAt,
          preferences: tenantUsers.preferences,
          onboardingCompleted: tenantUsers.onboardingCompleted,
          createdAt: tenantUsers.createdAt,
          updatedAt: tenantUsers.updatedAt
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId))
        .orderBy(desc(tenantUsers.createdAt));

      // Get pending invitations
      const pendingInvitations = await db
        .select({
          invitationId: tenantInvitations.invitationId,
          tenantId: tenantInvitations.tenantId,
          email: tenantInvitations.email,
          roleId: tenantInvitations.roleId,
          invitedBy: tenantInvitations.invitedBy,
          invitationToken: tenantInvitations.invitationToken,
          invitationUrl: tenantInvitations.invitationUrl,
          status: tenantInvitations.status,
          expiresAt: tenantInvitations.expiresAt,
          acceptedAt: tenantInvitations.acceptedAt,
          cancelledAt: tenantInvitations.cancelledAt,
          cancelledBy: tenantInvitations.cancelledBy,
          createdAt: tenantInvitations.createdAt,
          updatedAt: tenantInvitations.updatedAt
        })
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.status, 'pending')
        ))
        .orderBy(desc(tenantInvitations.createdAt));

      // Get user role assignments
      const userIds = activeUsers.map(u => u.userId).filter(Boolean) as string[];
      const userRoleData: Array<{ userId: string | null; roleId: string; assignedAt: Date | null }> = userIds.length > 0 ? await db
        .select({
          userId: userRoleAssignments.userId,
          roleId: userRoleAssignments.roleId,
          assignedAt: userRoleAssignments.assignedAt
        })
        .from(userRoleAssignments)
        .where(and(
          inArray(userRoleAssignments.userId, userIds),
          eq(userRoleAssignments.isActive, true)
        )) : [];

      // Get roles for users and invitations
      const pendingInvitationsList = pendingInvitations as Array<{ roleId?: string | null }>;
      const roleIds = [
        ...(userRoleData || []).filter(ur => ur && ur.roleId).map(ur => ur.roleId),
        ...pendingInvitationsList.filter(i => i && i.roleId).map(i => i.roleId)
      ].filter(Boolean) as string[];

      const roles = roleIds.length > 0 ? await db
        .select({
          roleId: customRoles.roleId,
          roleName: customRoles.roleName,
          description: customRoles.description,
          color: customRoles.color
        })
        .from(customRoles)
        .where(inArray(customRoles.roleId, roleIds)) : [];

      const roleMap = new Map((roles || []).filter(r => r && r.roleId).map(r => [r.roleId, r]));
      const userRoleMap = new Map((userRoleData || []).filter(ur => ur && ur.userId && ur.roleId).map(ur => [ur.userId, ur.roleId]));

      // Get accepted invitations for active users (to show invitationUrl if available)
      const acceptedInvitations = await db
        .select({
          invitationId: tenantInvitations.invitationId,
          email: tenantInvitations.email,
          invitationUrl: tenantInvitations.invitationUrl,
          status: tenantInvitations.status,
          acceptedAt: tenantInvitations.acceptedAt
        })
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.status, 'accepted')
        ));

      // Create a map of email to accepted invitation for quick lookup
      const acceptedInvitationMap = new Map(
        acceptedInvitations
          .filter(inv => inv && inv.email)
          .map(inv => [inv.email.toLowerCase(), inv])
      );

      // Format active users
      const formattedUsers = activeUsers.map(user => {
        if (!user || !user.userId || !user.email) {
          return null;
        }

        const userRoleId = userRoleMap.get(user.userId);
        const role = userRoleId ? roleMap.get(userRoleId) : null;

        // Check if user has an accepted invitation
        const acceptedInvitation = acceptedInvitationMap.get(user.email.toLowerCase());
        const hasAcceptedInvitation = !!acceptedInvitation;

        return {
          id: user.userId,
          userId: user.userId,
          email: user.email,
          firstName: user.firstName || user.email.split('@')[0],
          lastName: user.lastName || '',
          role: role?.roleName || 'No role assigned',
          roleId: role?.roleId || null,
          isActive: user.isActive !== false, // Default to true if undefined
          invitationStatus: hasAcceptedInvitation ? 'accepted' : 'active',
          invitedAt: user.invitedAt || user.createdAt,
          expiresAt: null,
          lastActiveAt: user.lastActiveAt,
          invitationId: acceptedInvitation?.invitationId || null,
          invitationUrl: acceptedInvitation?.invitationUrl || null, // Include invitationUrl if available
          invitationAcceptedAt: acceptedInvitation?.acceptedAt || null,
          status: 'active',
          userType: 'active',
          originalData: {
            user: {
              userId: user.userId,
              tenantId: user.tenantId,
              kindeUserId: user.kindeUserId,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              isActive: user.isActive,
              isVerified: user.isVerified,
              isTenantAdmin: user.isTenantAdmin,
              invitedAt: user.invitedAt,
              lastActiveAt: user.lastActiveAt,
              preferences: user.preferences,
              onboardingCompleted: user.onboardingCompleted,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              invitationUrl: acceptedInvitation?.invitationUrl || null, // Include in originalData too
              invitationAcceptedAt: acceptedInvitation?.acceptedAt || null
            },
            role: role
          }
        };
      }).filter(user => user !== null);

      // Format pending invitations
      const formattedInvitations = pendingInvitations.map(invitation => {
        if (!invitation || !invitation.invitationId || !invitation.email) {
          return null;
        }

        const role = invitation.roleId ? roleMap.get(invitation.roleId) : null;
        return {
          id: `inv_${invitation.invitationId}`,
          email: invitation.email,
          firstName: invitation.email.split('@')[0],
          lastName: '',
          role: role?.roleName || 'No role assigned',
          roleId: invitation.roleId || role?.roleId || null,
          isActive: false,
          invitationStatus: 'pending',
          invitedAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
          lastActiveAt: null,
          invitationId: invitation.invitationId,
          status: 'pending',
          userType: 'invited',
          originalData: {
            user: {
              invitationId: invitation.invitationId,
              tenantId: invitation.tenantId,
              email: invitation.email,
              roleId: invitation.roleId,
              invitedBy: invitation.invitedBy,
              invitationToken: invitation.invitationToken,
              invitationUrl: invitation.invitationUrl,
              status: invitation.status,
              expiresAt: invitation.expiresAt,
              acceptedAt: invitation.acceptedAt,
              cancelledAt: invitation.cancelledAt,
              cancelledBy: invitation.cancelledBy,
              createdAt: invitation.createdAt,
              updatedAt: invitation.updatedAt
            },
            role: role
          }
        };
      }).filter(invitation => invitation !== null);

      // Combine and return
      const allUsers: Array<Record<string, unknown>> = [...formattedUsers, ...formattedInvitations];

      Logger.log('info', 'user', 'get-tenant-users', 'Found users and pending invitations', { activeUsers: formattedUsers.length, pendingInvitations: formattedInvitations.length });

      return allUsers;
    } catch (error) {
      Logger.log('error', 'user', 'get-tenant-users', 'Error getting tenant users', { error: (error as Error).message });
      throw error;
    }
  }

  // Get users filtered by entity (organization/location/department)
  static async getTenantUsersByEntity(tenantId: string, entityId: string | undefined): Promise<Array<Record<string, unknown>>> {
    try {
      Logger.log('info', 'user', 'get-users-by-entity', 'Getting users for tenant and entity', { tenantId, entityId });

      // If no entityId provided, return all users
      if (!entityId) {
        Logger.log('info', 'user', 'get-users-by-entity', 'No entityId provided, returning all tenant users');
        return await this.getTenantUsers(tenantId);
      }

      // Get all child entities for hierarchical filtering
      const childEntities = await this.getEntityChildren(entityId);
      const allRelevantEntities = new Set([entityId, ...childEntities]);

      Logger.log('info', 'user', 'get-users-by-entity', 'Entity hierarchy', { entityId, childEntities: Array.from(childEntities), totalRelevantEntities: allRelevantEntities.size });

      // Try to get users through organization memberships
      let entityUserIds = new Set();

      try {
        const memberships = await db
          .select({
            userId: organizationMemberships.userId,
            entityId: organizationMemberships.entityId,
            membershipStatus: organizationMemberships.membershipStatus,
            canAccessSubEntities: organizationMemberships.canAccessSubEntities
          })
          .from(organizationMemberships)
          .where(and(
            eq(organizationMemberships.tenantId, tenantId),
            eq(organizationMemberships.membershipStatus, 'active'),
            inArray(organizationMemberships.entityId, Array.from(allRelevantEntities))
          ));

        Logger.log('info', 'user', 'get-users-by-entity', 'Found organization memberships for entity hierarchy', { count: memberships.length });

        // Collect user IDs from memberships
        memberships.forEach(membership => {
          entityUserIds.add(membership.userId);
        });

      } catch (err: unknown) {
        const membershipError = err as Error;
        Logger.log('warning', 'user', 'get-users-by-entity', 'Could not query organization memberships, falling back', { error: membershipError.message });
      }

      // If no users found through memberships, try alternative approaches
      if (entityUserIds.size === 0) {
        Logger.log('info', 'user', 'get-users-by-entity', 'No users found through organization memberships, trying alternative methods');

        // Method 1: Check if users have this entity as their primary organization
        try {
          const primaryOrgUsers = await db
            .select({ userId: tenantUsers.userId })
            .from(tenantUsers)
            .where(and(
              eq(tenantUsers.tenantId, tenantId),
              eq(tenantUsers.primaryOrganizationId, entityId)
            ));

          primaryOrgUsers.forEach(user => entityUserIds.add(user.userId));
          Logger.log('info', 'user', 'get-users-by-entity', 'Found users with this entity as primary organization', { count: primaryOrgUsers.length });
        } catch (err: unknown) {
          const primaryError = err as Error;
          Logger.log('warning', 'user', 'get-users-by-entity', 'Could not check primary organizations', { error: primaryError.message });
        }

        // Method 2: Check tenant invitations that target this entity
        try {
          const invitationUsers = await db
            .select({ invitedBy: tenantInvitations.invitedBy })
            .from(tenantInvitations)
            .where(and(
              eq(tenantInvitations.tenantId, tenantId),
              sql`(${tenantInvitations.targetEntities}::jsonb) ? (${entityId})`
            ));

          // Add the users who were invited to this entity
          for (const invitation of invitationUsers) {
            if (invitation.invitedBy) {
              // Also add the invited users by finding them through the invitation
              const invitedUsers = await db
                .select({ userId: tenantUsers.userId })
                .from(tenantUsers)
                .where(and(
                  eq(tenantUsers.tenantId, tenantId),
                  eq(tenantUsers.email, invitation.invitedBy) // This might not be correct, but it's a fallback
                ));

              invitedUsers.forEach(user => entityUserIds.add(user.userId));
            }
          }
        } catch (err: unknown) {
          const invitationError = err as Error;
          Logger.log('warning', 'user', 'get-users-by-entity', 'Could not check tenant invitations', { error: invitationError.message });
        }
      }

      // If we still have no users, return all users as fallback
      if (entityUserIds.size === 0) {
        Logger.log('warning', 'user', 'get-users-by-entity', 'No users found for entity, returning all tenant users as fallback');
        return await this.getTenantUsers(tenantId);
      }

      Logger.log('info', 'user', 'get-users-by-entity', 'Found users associated with entity', { count: entityUserIds.size, entityId });

      // Ensure we have valid user IDs before querying
      const validUserIds: string[] = Array.from(entityUserIds).filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (validUserIds.length === 0) {
        Logger.log('warning', 'user', 'get-users-by-entity', 'No valid user IDs found for entity, returning all tenant users as fallback');
        return await this.getTenantUsers(tenantId);
      }

      Logger.log('info', 'user', 'get-users-by-entity', 'Querying valid user IDs', { count: validUserIds.length });

      // Get the actual user data for these users
      let users: Array<Record<string, unknown>> = [];
      try {
        const usersResult = await db
          .select({
            userId: tenantUsers.userId,
            tenantId: tenantUsers.tenantId,
            kindeUserId: tenantUsers.idpSub,
            email: tenantUsers.email,
            firstName: tenantUsers.firstName,
            lastName: tenantUsers.lastName,
            isActive: tenantUsers.isActive,
            isVerified: tenantUsers.isVerified,
            isTenantAdmin: tenantUsers.isTenantAdmin,
            invitedAt: tenantUsers.invitedAt,
            lastActiveAt: tenantUsers.lastActiveAt,
            preferences: tenantUsers.preferences,
            onboardingCompleted: tenantUsers.onboardingCompleted,
            createdAt: tenantUsers.createdAt,
            updatedAt: tenantUsers.updatedAt,
            primaryOrganizationId: tenantUsers.primaryOrganizationId
          })
          .from(tenantUsers)
          .where(and(
            eq(tenantUsers.tenantId, tenantId),
            inArray(tenantUsers.userId, validUserIds)
          ))
          .orderBy(desc(tenantUsers.createdAt));

        users = usersResult as unknown as Array<Record<string, unknown>>;
        Logger.log('info', 'user', 'get-users-by-entity', 'Successfully retrieved users from database', { count: users.length });
      } catch (userQueryError) {
        Logger.log('error', 'user', 'get-users-by-entity', 'Error querying users from database, falling back', { error: (userQueryError as Error).message });
        return await this.getTenantUsers(tenantId);
      }

      // Get roles for these users (only if we have users)
      let userRoles: Array<{ userId: string | null; roleId: string; roleName: string | null; roleDescription: string | null; roleColor: string | null; rolePermissions: unknown }> = [];
      if (users.length > 0) {
        const userIdsForRoles = users.map(u => u.userId).filter((id): id is string => id != null && typeof id === 'string');
        if (userIdsForRoles.length > 0) {
          try {
            userRoles = await db
              .select({
                userId: userRoleAssignments.userId,
                roleId: userRoleAssignments.roleId,
                roleName: customRoles.roleName,
                roleDescription: customRoles.description,
                roleColor: customRoles.color,
                rolePermissions: customRoles.permissions
              })
              .from(userRoleAssignments)
              .leftJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
              .where(inArray(userRoleAssignments.userId, userIdsForRoles));

            Logger.log('info', 'user', 'get-users-by-entity', 'Successfully retrieved role assignments from database', { count: userRoles.length });
          } catch (roleQueryError) {
            Logger.log('error', 'user', 'get-users-by-entity', 'Error querying user roles from database', { error: (roleQueryError as Error).message });
            userRoles = [];
          }
        }
      }

      // Get pending invitations for this entity
      let pendingInvitations: Array<typeof tenantInvitations.$inferSelect> = [];
      try {
        pendingInvitations = await db
          .select()
          .from(tenantInvitations)
          .where(and(
            eq(tenantInvitations.tenantId, tenantId),
            eq(tenantInvitations.status, 'pending'),
            sql`(${tenantInvitations.targetEntities}::jsonb) ? (${entityId})`
          ));

        Logger.log('info', 'user', 'get-users-by-entity', 'Successfully retrieved pending invitations from database', { count: pendingInvitations.length });
      } catch (invitationQueryError) {
        Logger.log('error', 'user', 'get-users-by-entity', 'Error querying pending invitations from database', { error: (invitationQueryError as Error).message });
        pendingInvitations = [];
      }

      // Create role map
      const roleMap = new Map();
      try {
        (userRoles || []).forEach(ur => {
          if (ur && ur.roleId) {
            roleMap.set(ur.roleId, {
              roleId: ur.roleId,
              roleName: ur.roleName || 'Unknown Role',
              description: ur.roleDescription || '',
              color: ur.roleColor || '#6b7280',
              icon: 'User',
              permissions: (ur.rolePermissions as Record<string, unknown>) || {}
            });
          }
        });
        Logger.log('info', 'user', 'get-users-by-entity', 'Successfully created role map', { count: roleMap.size });
      } catch (roleMapError) {
        Logger.log('error', 'user', 'get-users-by-entity', 'Error creating role map', { error: (roleMapError as Error).message });
      }

      // Create user-role map
      const userRoleIdMap = new Map();
      try {
        (userRoles || []).forEach(ur => {
          if (ur && ur.userId && ur.roleId) {
            userRoleIdMap.set(ur.userId, ur.roleId);
          }
        });
        Logger.log('info', 'user', 'get-users-by-entity', 'Successfully created user-role map', { count: userRoleIdMap.size });
      } catch (userRoleMapError) {
        Logger.log('error', 'user', 'get-users-by-entity', 'Error creating user-role map', { error: (userRoleMapError as Error).message });
      }

      // Format users
      const formattedUsers = users.map(user => {
        if (!user || !user.userId || !user.email) {
          return null;
        }

        const userRoleId = userRoleIdMap.get(user.userId);
        const role = userRoleId ? roleMap.get(userRoleId) : null;

        const u = user as { userId?: string; email?: string; firstName?: string | null; lastName?: string | null; isActive?: boolean; invitedAt?: Date | null; lastActiveAt?: Date | null };
        return {
          id: u.userId,
          email: u.email ?? '',
          firstName: u.firstName || (typeof u.email === 'string' ? u.email.split('@')[0] : ''),
          lastName: u.lastName || '',
          role: role?.roleName || '',
          isActive: u.isActive !== false, // Default to true if undefined
          invitationStatus: 'active',
          invitedAt: u.invitedAt,
          expiresAt: null,
          lastActiveAt: u.lastActiveAt,
          invitationId: null,
          status: 'active',
          userType: 'active',
          originalData: {
            user: user,
            role: role
          }
        };
      }).filter(u => u != null) as Array<Record<string, unknown>>;

      // Format pending invitations
      let formattedInvitations: Array<Record<string, unknown>> = [];
      try {
        formattedInvitations = pendingInvitations.map(invitation => {
          if (!invitation || !invitation.invitationId || !invitation.email) {
            return null;
          }

          const role = invitation.roleId ? roleMap.get(invitation.roleId) : null;
          return {
            id: `inv_${invitation.invitationId}`,
            email: invitation.email,
            firstName: invitation.email.split('@')[0],
            lastName: '',
            role: role?.roleName || 'Member',
            isActive: false,
            invitationStatus: 'pending',
            invitedAt: invitation.createdAt,
            expiresAt: invitation.expiresAt,
            lastActiveAt: null,
            invitationId: invitation.invitationId,
            status: 'pending',
            userType: 'invited',
            originalData: {
              invitation: invitation,
              role: role
            }
          };
        }).filter(invitation => invitation !== null);

        Logger.log('info', 'user', 'get-tenant-users-by-entity', 'Successfully formatted invitations', { count: formattedInvitations.length });
      } catch (invitationFormatError) {
        Logger.log('error', 'user', 'get-tenant-users-by-entity', 'Error formatting invitations', { error: (invitationFormatError as Error).message });
        formattedInvitations = [];
      }

      // Combine and return
      let allUsers: Array<Record<string, unknown>> = [];
      try {
        allUsers = [...formattedUsers, ...formattedInvitations] as Array<Record<string, unknown>>;
        Logger.log('info', 'user', 'get-tenant-users-by-entity', 'Combined users and invitations', { activeUsers: formattedUsers.length, pendingInvitations: formattedInvitations.length, entityId, total: allUsers.length });
      } catch (combineError) {
        Logger.log('error', 'user', 'get-tenant-users-by-entity', 'Error combining formatted users and invitations', { error: (combineError as Error).message });
        // Return just the formatted users if combining fails
        allUsers = formattedUsers as Array<Record<string, unknown>>;
      }

      return allUsers;
    } catch (error) {
      Logger.log('error', 'user', 'get-tenant-users-by-entity', 'Error getting tenant users by entity', { error: (error as Error).message });
      throw error;
    }
  }

  // Helper method to get child entities
  static async getEntityChildren(entityId: string): Promise<Set<string>> {
    try {
      const children = new Set<string>();

      // Get direct children
      const directChildren = await db
        .select({ entityId: entities.entityId })
        .from(entities)
        .where(eq(entities.parentEntityId, entityId));

      // Add direct children
      directChildren.forEach(child => child.entityId && children.add(child.entityId));

      // Recursively get children of children (simplified - only one level deep for now)
      for (const child of directChildren) {
        if (!child.entityId) continue;
        const grandChildren = await db
          .select({ entityId: entities.entityId })
          .from(entities)
          .where(eq(entities.parentEntityId, child.entityId));

        grandChildren.forEach(gc => gc.entityId && children.add(gc.entityId));
      }

      return children;
    } catch (error) {
      Logger.log('error', 'user', 'get-entity-children', 'Error getting entity children', { error: (error as Error).message });
      return new Set();
    }
  }

  // ---------------------------------------------------------------------------
  // User removal
  // ---------------------------------------------------------------------------

  // Unified user operations
  static async deleteUser(userId: string, tenantId: string): Promise<unknown> {
    // Check if this is an invited user (starts with 'inv_')
    if (userId.startsWith('inv_')) {
      const invitationId = userId.replace('inv_', '');
      return await this.cancelInvitation(tenantId, invitationId);
    } else {
      return await this.removeActiveUser(userId, tenantId);
    }
  }

  // Remove user from tenant (including invitation cancellation)
  static async removeUser(tenantId: string, userId: string, removedBy: string): Promise<{ success: boolean; message: string }> {
    try {
      Logger.log('info', 'user', 'remove-user', 'Removing user from tenant', { tenantId, userId, removedBy });

      // Check if this is an invitation ID (prefixed with 'inv_')
      if (typeof userId === 'string' && userId.startsWith('inv_')) {
        // This is an invitation ID, check if we should cancel or handle accepted invitation
        const invitationId = userId.substring(4); // Remove 'inv_' prefix
        Logger.log('info', 'user', 'remove-user', 'Detected invitation ID', { invitationId });

        // Check invitation status
        const [invitation] = await db
          .select()
          .from(tenantInvitations)
          .where(and(
            eq(tenantInvitations.invitationId, invitationId),
            eq(tenantInvitations.tenantId, tenantId)
          ))
          .limit(1);

        if (invitation) {
          if (invitation.status === 'pending') {
            // Cancel pending invitation
            Logger.log('info', 'user', 'remove-user', 'Cancelling pending invitation');
            return await this.cancelInvitation(tenantId, invitationId as string, removedBy);
          } else if (invitation.status === 'accepted') {
            // Invitation was already accepted - remove the user instead
            Logger.log('info', 'user', 'remove-user', 'Invitation already accepted, removing user instead');

            // Find the user that was created from this invitation
            // We can match by email since invitations are unique per email
            const [user] = await db
              .select()
              .from(tenantUsers)
              .where(and(
                eq(tenantUsers.tenantId, tenantId),
                eq(tenantUsers.email, invitation.email)
              ))
              .limit(1);

            if (user) {
              Logger.log('info', 'user', 'remove-user', 'Found user from accepted invitation, removing user', { userId: user.userId });
              // Remove the user (this will be handled by the regular user removal logic below)
              userId = user.userId;
            } else {
              throw new Error('User from accepted invitation not found');
            }
          } else {
            throw new Error(`Cannot remove user from invitation with status: ${invitation.status}`);
          }
        } else {
          throw new Error('Invitation not found');
        }
      }

      // Check if user exists in tenant
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .limit(1);

      if (!user) {
        throw new Error('User not found in this tenant');
      }

      // Check if user is the last admin
      if (user.isTenantAdmin) {
        const adminCount = await db
          .select({ count: count() })
          .from(tenantUsers)
          .where(and(
            eq(tenantUsers.tenantId, tenantId),
            eq(tenantUsers.isTenantAdmin, true),
            eq(tenantUsers.isActive, true)
          ));

        if (adminCount[0].count <= 1) {
          throw new Error('Cannot remove the last admin user from the tenant');
        }
      }

      // Start transaction
      const result = await db.transaction(async (tx) => {
        // 1. Remove organization memberships
        const deletedMemberships = await tx
          .delete(organizationMemberships)
          .where(eq(organizationMemberships.userId, userId))
          .returning();
        Logger.log('info', 'user', 'remove-user', 'Removed organization memberships for user', { count: deletedMemberships.length });

        // 2. Remove user role assignments
        await tx
          .delete(userRoleAssignments)
          .where(eq(userRoleAssignments.userId, userId));

        // 3. Remove responsible person assignments (where user is the responsible person)
        try {
          const { responsiblePersons } = await import('../db/schema/organizations/responsible_persons.js');
          const deletedAssignments = await tx
            .delete(responsiblePersons)
            .where(eq(responsiblePersons.userId, userId))
            .returning();
          Logger.log('info', 'user', 'remove-user', 'Removed responsible person assignments', { count: deletedAssignments.length });
        } catch (err: unknown) {
          const rpError = err as Error;
          Logger.log('warning', 'user', 'remove-user', 'Error removing responsible person assignments', { error: rpError.message });
          // Continue even if this fails - might not exist
        }

        // 4. Handle responsible person assignments where user is the assigner (assignedBy)
        // Set assignedBy to another admin user if possible, otherwise delete the assignments
        try {
          const { responsiblePersons } = await import('../db/schema/organizations/responsible_persons.js');
          // Find another admin user in the tenant to reassign
          const [replacementAdmin] = await tx
            .select({ userId: tenantUsers.userId })
            .from(tenantUsers)
            .where(and(
              eq(tenantUsers.tenantId, tenantId),
              eq(tenantUsers.isTenantAdmin, true),
              eq(tenantUsers.isActive, true),
              ne(tenantUsers.userId, userId) // Not the user being deleted
            ))
            .limit(1);

          if (replacementAdmin) {
            const updatedAssignments = await tx
              .update(responsiblePersons)
              .set({ assignedBy: replacementAdmin.userId })
              .where(eq(responsiblePersons.assignedBy, userId))
              .returning();
            Logger.log('info', 'user', 'remove-user', 'Reassigned responsible person assignments to admin', { count: updatedAssignments.length });
          } else {
            // If no replacement admin, delete these assignments
            const deletedAssignments = await tx
              .delete(responsiblePersons)
              .where(eq(responsiblePersons.assignedBy, userId))
              .returning();
            Logger.log('info', 'user', 'remove-user', 'Deleted responsible person assignments (no replacement admin)', { count: deletedAssignments.length });
          }
        } catch (err: unknown) {
          const rpError = err as Error;
          Logger.log('warning', 'user', 'remove-user', 'Error handling responsible person assignments', { error: rpError.message });
          // Continue even if this fails
        }

        // 5. Cancel all invitations for this user's email (pending and accepted) so tenant_invitations stays consistent
        const cancelledInvitations = await tx
          .update(tenantInvitations)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: removedBy
          })
          .where(and(
            eq(tenantInvitations.tenantId, tenantId),
            eq(tenantInvitations.email, user.email)
          ))
          .returning();
        Logger.log('info', 'user', 'remove-user', 'Cancelled tenant invitations', { count: cancelledInvitations.length, email: user.email });

        // 6. Publish user deletion event to Amazon MQ before deletion
        try {
          const firstName = user.firstName || '';
          const lastName = user.lastName || '';
          // Use kindeUserId as entityId — FA/CRM look up wrapper_user_id_mapping by kindeId
          const entityIdForEvent = user.idpSub || user.userId;
          await snsSqsPublisher.publishUserEventToSuite('user_deleted', tenantId, entityIdForEvent, {
            userId: user.userId,
            kindeUserId: user.idpSub,
            email: user.email,
            firstName: firstName,
            lastName: lastName,
            name: [firstName, lastName].filter(Boolean).join(' ') || user.email,
            deletedAt: new Date().toISOString(),
            deletedBy: removedBy,
            reason: 'user_removed_from_tenant'
          });
          Logger.log('info', 'user', 'remove-user', 'Published user_deleted event to AWS MQ');
        } catch (err: unknown) {
          const streamError = err as Error;
          Logger.log('error', 'user', 'remove-user', 'Failed to publish user_deleted event', { error: streamError.message });
        }

        // 6b. Clear audit_logs reference to this user so FK does not block delete (preserve logs, dissociate user)
        try {
          const auditResult = await tx
            .update(auditLogs)
            .set({ userId: null })
            .where(eq(auditLogs.userId, userId))
            .returning();
          Logger.log('info', 'user', 'remove-user', 'Cleared user reference from audit logs', { count: auditResult.length });
        } catch (err: unknown) {
          const auditErr = err as Error;
          Logger.log('warning', 'user', 'remove-user', 'Error clearing audit_logs user reference', { error: auditErr.message });
          // Continue so user can still be deleted
        }

        // 7. Remove the user from tenant_users
        await tx
          .delete(tenantUsers)
          .where(and(
            eq(tenantUsers.userId, userId),
            eq(tenantUsers.tenantId, tenantId)
          ));

        return { success: true, message: 'User removed successfully' };
      });

      Logger.log('info', 'user', 'remove-user', 'User removed successfully', { userId, tenantId });
      return result;
    } catch (error) {
      Logger.log('error', 'user', 'remove-user', 'Error removing user', { error: (error as Error).message });
      throw error;
    }
  }

  // Remove active user
  static async removeActiveUser(userId: string, tenantId: string): Promise<{ success: boolean; message: string; data: typeof tenantUsers.$inferSelect }> {
    try {
      const [updatedUser] = await db
        .update(tenantUsers)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      // Publish user deactivation event to Amazon MQ
      try {
        const firstName = updatedUser.firstName || '';
        const lastName = updatedUser.lastName || '';

        await snsSqsPublisher.publishUserEventToSuite('user_deactivated', tenantId, updatedUser.userId, {
          userId: updatedUser.userId,
          email: updatedUser.email,
          firstName: firstName,
          lastName: lastName,
          name: [firstName, lastName].filter(Boolean).join(' ') || updatedUser.email,
          deactivatedAt: new Date().toISOString(),
          deactivatedBy: null, // System-initiated deactivation
          reason: 'user_deactivated'
        });
        Logger.log('info', 'user', 'remove-active-user', 'Published user_deactivated event to AWS MQ');
      } catch (err: unknown) {
        const publishError = err as Error;
        Logger.log('error', 'user', 'remove-active-user', 'Failed to publish user_deactivated event', { error: publishError.message });
      }

      return {
        success: true,
        message: 'User removed successfully',
        data: updatedUser
      };
    } catch (error) {
      Logger.log('error', 'user', 'remove-active-user', 'Error removing user', { error: (error as Error).message });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Role management
  // ---------------------------------------------------------------------------

  // Update user role (works for both user types)
  static async updateUserRole(userId: string, roleId: string, tenantId: string): Promise<{ success: boolean; message: string; data: unknown }> {
    try {
      if (userId.startsWith('inv_')) {
        // Update invitation role
        const invitationId = userId.replace('inv_', '');
        const [updatedInvitation] = await db
          .update(tenantInvitations)
          .set({
            roleId: roleId,
            updatedAt: new Date()
          })
          .where(and(
            eq(tenantInvitations.invitationId, invitationId),
            eq(tenantInvitations.tenantId, tenantId)
          ))
          .returning();

        if (!updatedInvitation) {
          throw new Error('Invitation not found');
        }

        return {
          success: true,
          message: 'Invitation role updated successfully',
          data: updatedInvitation
        };
      } else {
        // Update active user role
        // First remove existing role assignments and publish unassignment events
        const existingAssignments = await db
          .select({
            id: userRoleAssignments.id,
            roleId: userRoleAssignments.roleId,
            assignedAt: userRoleAssignments.assignedAt
          })
          .from(userRoleAssignments)
          .where(eq(userRoleAssignments.userId, userId));

        // Publish role unassignment events for removed roles
        for (const assignment of existingAssignments) {
          try {
            await snsSqsPublisher.publishRoleEventToSuite('role_unassigned', tenantId, assignment.roleId, {
              assignmentId: assignment.id,
              userId: userId,
              roleId: assignment.roleId,
              unassignedAt: new Date().toISOString(),
              unassignedBy: null, // Will be set by caller if available
              reason: 'Role updated to new assignment'
            });
            Logger.log('info', 'role', 'update-user-role', 'Published role unassignment event successfully');
          } catch (err: unknown) {
            const streamError = err as Error;
            Logger.log('error', 'role', 'update-user-role', 'Failed to publish role_unassigned event', { error: streamError.message });
          }
        }

        // Remove existing role assignments
        await db
          .delete(userRoleAssignments)
          .where(eq(userRoleAssignments.userId, userId));

        // Add new role assignment (assignedBy is required by schema; use userId as fallback)
        const [newRoleAssignment] = await db
          .insert(userRoleAssignments)
          .values({
            userId: userId,
            roleId: roleId,
            assignedBy: userId,
            assignedAt: new Date(),
            isActive: true
          })
          .returning();

        // Publish role assignment event for new role
        try {
          await snsSqsPublisher.publishRoleEventToSuite('role_assigned', tenantId, roleId, {
            assignmentId: newRoleAssignment.id,
            userId: userId,
            roleId: roleId,
            assignedAt: newRoleAssignment.assignedAt ? (typeof newRoleAssignment.assignedAt === 'string' ? newRoleAssignment.assignedAt : newRoleAssignment.assignedAt.toISOString()) : new Date().toISOString(),
            assignedBy: null, // Will be set by caller if available
            expiresAt: (newRoleAssignment as { expiresAt?: Date | string }).expiresAt,
            entityId: (newRoleAssignment as { organizationId?: string }).organizationId
          });
          Logger.log('info', 'role', 'update-user-role', 'Published role assignment event successfully');
        } catch (err: unknown) {
          const streamError = err as Error;
          Logger.log('error', 'role', 'update-user-role', 'Failed to publish role_assigned event', { error: streamError.message });
        }

        return {
          success: true,
          message: 'User role updated successfully',
          data: newRoleAssignment
        };
      }
    } catch (error) {
      Logger.log('error', 'role', 'update-user-role', 'Error updating user role', { error: (error as Error).message });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------------

  // Get user by email in tenant - includes both active and invited users
  static async getUserByEmailInTenant(tenantId: string, email: string): Promise<typeof tenantUsers.$inferSelect | undefined> {
    const [user] = await db
      .select()
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.email, email)
      ))
      .limit(1);

    return user;
  }
}
