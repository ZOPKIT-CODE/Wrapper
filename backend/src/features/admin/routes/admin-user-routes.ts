import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/index.js';
import { tenantUsers, customRoles, userRoleAssignments, organizationMemberships, entities, tenantInvitations } from '../../../db/schema/index.js';
import { eq, and, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import EmailService from '../../../utils/email.js';
import { authenticateToken, requirePermission, invalidateRoleCache, invalidateUserCache } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { checkUserLimit } from '../../../middleware/restrictions/planRestrictions.js';
import Logger from '../../../utils/logger.js';
import ErrorResponses from '../../../utils/error-responses.js';
import permissionService from '../../roles/services/permission-service.js';
import { TenantService } from '../../../services/tenant-service.js';

type ReqWithUser = FastifyRequest & { userContext?: Record<string, unknown> };

export default async function adminUserRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Invite user endpoint (legacy path)
  fastify.post('/invite-user', {
    preHandler: [authenticateToken, checkUserLimit]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const reqUser = request as ReqWithUser;
    const startTime = Date.now();
    const requestId = Logger.generateRequestId('user-invite');

    try {
      console.log('\n👤 ================ USER INVITATION STARTED ================');
      console.log(`📋 Request ID: ${requestId}`);
      console.log(`⏰ Timestamp: ${Logger.getTimestamp()}`);
      console.log(`👤 Inviting user by: ${reqUser.userContext?.email}`);

      const email = body.email as string;
      const name = body.name as string;
      const roleIds = body.roleIds as string[] | undefined;
      const tenantId = (reqUser.userContext?.tenantId ?? '') as string;

      (Logger as any).user?.invite?.(requestId, email, name, roleIds, tenantId);

      console.log(`📧 [${requestId}] Invitation Data:`, {
        email,
        name,
        roleIds,
        tenantId
      });

      console.log(`📧 [${requestId}] Validation: Validating input data`);

      if (!email || !name) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required fields',
          message: 'Email and name are required'
        });
      }

      if (!tenantId) {
        return reply.code(400).send({
          success: false,
          error: 'No tenant context',
          message: 'Unable to determine tenant for invitation'
        });
      }

      console.log(`✅ [${requestId}] Input validation successful`);

      // Check if user already exists in this tenant
      console.log(`🔍 [${requestId}] Checking if user already exists in tenant`);
      const existingUser = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.email, email)
        ))
        .limit(1);

      if (existingUser.length > 0) {
        console.log(`⚠️ [${requestId}] User already exists in tenant`);
        return reply.code(409).send({
          success: false,
          error: 'User already exists',
          message: 'This user is already a member of your organization'
        });
      }

      console.log(`✅ [${requestId}] User does not exist in tenant - proceeding with invitation`);

      // Send invitation email
      console.log(`📧 [${requestId}] Sending invitation email to: ${email}`);
      const emailResult = await EmailService.sendUserInvitation({
        email,
        tenantName: (reqUser.userContext?.tenantId ?? '') as string,
        roleName: 'Member',
        invitationToken: '',
        invitedByName: (reqUser.userContext?.email ?? name) as string,
        roleIds
      } as any);

      if (emailResult.success) {
        console.log(`✅ [${requestId}] Invitation email sent successfully`);
      } else {
        console.warn(`⚠️ [${requestId}] Failed to send invitation email: ${emailResult.error}`);
      }

      console.log(`🎉 [${requestId}] USER INVITATION COMPLETED SUCCESSFULLY!`);
      console.log(`⏱️ [${requestId}] Total processing time: ${Logger.getDuration(startTime)}`);
      console.log('👤 ================ USER INVITATION ENDED ================\n');

      return {
        success: true,
        message: 'User invitation sent successfully',
        requestId,
        duration: Logger.getDuration(startTime)
      };

    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      console.error(`❌ [${requestId}] USER INVITATION FAILED!`);
      console.error(`📋 [${requestId}] Error Message: ${error.message}`);
      console.error(`🔢 [${requestId}] Error Code: ${error.code ?? 'N/A'}`);
      console.error(`📋 [${requestId}] Stack Trace: ${error.stack ?? ''}`);
      console.log(`⏱️ [${requestId}] Failed after: ${Logger.getDuration(startTime)}`);
      console.log('👤 ================ USER INVITATION FAILED ================\n');

      return reply.code(500).send({
        success: false,
        error: 'Failed to invite user',
        message: error.message,
        requestId
      });
    }
  });

  // ================ USER MANAGEMENT ENDPOINTS ================

  // Get all users in tenant
  fastify.get('/users', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_VIEW)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = Logger.generateRequestId('users-list');
    const tenantId = request.userContext?.tenantId;

    try {
      if (!tenantId) {
        console.error(`❌ [${requestId}] Missing tenantId in userContext:`, {
          userContext: request.userContext,
          isAuthenticated: request.userContext?.isAuthenticated
        });
        return reply.code(400).send({
          success: false,
          error: 'Missing tenant ID',
          message: 'Tenant ID is required. Please ensure you are properly authenticated.',
          requestId
        });
      }

      console.log(`🔍 [${requestId}] Getting users list for tenant: ${tenantId}`);

      const usersRaw = await db
        .select({
          userId: tenantUsers.userId,
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          isActive: tenantUsers.isActive,
          isTenantAdmin: tenantUsers.isTenantAdmin,
          isVerified: tenantUsers.isVerified,
          onboardingCompleted: tenantUsers.onboardingCompleted,
          createdAt: tenantUsers.createdAt,
          lastActiveAt: tenantUsers.lastActiveAt
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId));
      const users = usersRaw.map(u => ({
        ...u,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
      }));

      console.log(`✅ [${requestId}] Found ${users.length} users`);

      return {
        success: true,
        data: users,
        count: users.length,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get users:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get users',
        message: error.message,
        requestId
      });
    }
  });

  // Get specific user details
  fastify.get('/users/:userId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_VIEW)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('user-details');
    const userId = params.userId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🔍 [${requestId}] Getting user details: ${userId} for tenant: ${tenantId}`);

      const [userRaw] = await db
        .select({
          userId: tenantUsers.userId,
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          isActive: tenantUsers.isActive,
          isTenantAdmin: tenantUsers.isTenantAdmin,
          isVerified: tenantUsers.isVerified,
          onboardingCompleted: tenantUsers.onboardingCompleted,
          createdAt: tenantUsers.createdAt,
          lastActiveAt: tenantUsers.lastActiveAt
        })
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .limit(1);
      const user = userRaw ? { ...userRaw, name: [userRaw.firstName, userRaw.lastName].filter(Boolean).join(' ') || userRaw.email } : undefined;

      if (!user) {
        return ErrorResponses.notFound(reply, 'User', 'User not found', {
          userId,
          tenantId,
          requestId
        });
      }

      console.log(`✅ [${requestId}] Found user: ${user?.email}`);

      return {
        success: true,
        data: user,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get user details:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get user details',
        message: error.message,
        requestId
      });
    }
  });

  // Update user role
  fastify.put('/users/:userId/role', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_EDIT)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('user-role-update');
    const userId = params.userId ?? '';
    const isTenantAdmin = body.isTenantAdmin as boolean;
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`✏️ [${requestId}] Updating user admin status:`, { userId, isTenantAdmin, tenantId });

      const result = await db
        .update(tenantUsers)
        .set({
          isTenantAdmin: isTenantAdmin === true,
          updatedAt: new Date()
        } as any)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .returning();

      if (result.length === 0) {
        return ErrorResponses.notFound(reply, 'User', 'User not found', {
          requestId
        });
      }

      if (result[0]?.kindeUserId) {
        invalidateUserCache(result[0].kindeUserId);
      }

      console.log(`✅ [${requestId}] User admin status updated successfully`);

      return {
        success: true,
        message: 'User admin status updated successfully',
        data: result[0],
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to update user admin status:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update user admin status',
        message: error.message,
        requestId
      });
    }
  });

  // Assign role to user
  fastify.post('/users/assign-role', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_ASSIGNMENT_ASSIGN)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const requestId = Logger.generateRequestId('assign-role');
    const userId = (body.userId ?? '') as string;
    const roleId = (body.roleId ?? '') as string;
    const expiresAt = body.expiresAt as string | undefined;
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🔄 [${requestId}] Assigning role:`, { userId, roleId, tenantId });

      const assignment = await permissionService.assignRole({
        userId,
        roleId,
        expiresAt,
        assignedBy: ((request as ReqWithUser).userContext?.kindeUserId ?? (request as ReqWithUser).userContext?.internalUserId ?? '') as string,
        tenantId
      } as any);

      console.log(`✅ [${requestId}] Role assigned successfully`);

      return {
        success: true,
        message: 'Role assigned successfully',
        data: assignment,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to assign role:`, error);
      if (error.message.includes('already assigned')) {
        return reply.code(409).send({
          success: false,
          error: error.message,
          requestId
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to assign role',
        message: error.message,
        requestId
      });
    }
  });

  // Deassign role from user
  fastify.delete('/users/:userId/roles/:roleId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ROLES_ASSIGNMENT_ASSIGN)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('deassign-role');
    const userId = params.userId ?? '';
    const roleId = params.roleId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🔄 [${requestId}] Deassigning role:`, { userId, roleId, tenantId });

      await permissionService.removeRoleAssignment(
        tenantId,
        userId,
        roleId,
        ((request as ReqWithUser).userContext?.kindeUserId ?? (request as ReqWithUser).userContext?.internalUserId ?? '') as string
      );

      console.log(`✅ [${requestId}] Role deassigned successfully`);

      return {
        success: true,
        message: 'Role deassigned successfully',
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to deassign role:`, error);
      if (error.message === 'Role assignment not found') {
        return reply.code(404).send({
          success: false,
          error: error.message,
          requestId
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to deassign role',
        message: error.message,
        requestId
      });
    }
  });

  // Remove user from tenant
  fastify.delete('/users/:userId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_DELETE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('user-remove');
    const userId = params.userId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🗑️ [${requestId}] Removing user:`, { userId, tenantId });

      // Get user data before deletion for event publishing
      const [userToDelete] = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .limit(1);

      if (!userToDelete) {
        return ErrorResponses.notFound(reply, 'User', 'User not found', {
          requestId
        });
      }

      // Delete user and all related data (use TenantService for proper cleanup)
      // This will handle: organization memberships, role assignments, invitations, and event publishing
      await TenantService.removeUser(
        tenantId,
        userId,
        ((request as ReqWithUser).userContext?.internalUserId ?? '') as string
      );

      invalidateRoleCache(userId);
      if (userToDelete.kindeUserId) {
        invalidateUserCache(userToDelete.kindeUserId);
      }

      console.log(`✅ [${requestId}] User removed successfully`);

      return {
        success: true,
        message: 'User removed successfully',
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to remove user:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to remove user',
        message: error.message,
        requestId
      });
    }
  });

  // Get user's roles
  fastify.get('/users/:userId/roles', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_VIEW)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('user-roles');
    const userId = params.userId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🔍 [${requestId}] Getting roles for user: ${userId}`);

      const userRoles = await db
        .select({
          roleId: customRoles.roleId,
          roleName: customRoles.roleName,
          description: customRoles.description,
          permissions: customRoles.permissions,
          isSystemRole: customRoles.isSystemRole,
          assignedAt: userRoleAssignments.assignedAt,
          expiresAt: userRoleAssignments.expiresAt
        })
        .from(userRoleAssignments)
        .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
        .where(and(
          eq(userRoleAssignments.userId, userId as string),
          eq(customRoles.tenantId, tenantId as string)
        ))
        .orderBy(userRoleAssignments.assignedAt);

      console.log(`✅ [${requestId}] Found ${userRoles.length} roles for user`);

      return {
        success: true,
        data: userRoles,
        roles: userRoles,
        count: userRoles.length,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get user roles:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get user roles',
        message: error.message,
        requestId
      });
    }
  });

  // Get user's organization assignments
  fastify.get('/users/:userId/organizations', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_VIEW)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('user-organizations');
    const userId = params.userId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🔍 [${requestId}] Getting organization assignments for user: ${userId}`);

      // Pending invitation: userId is inv_<invitationId> — return assignments from invitation targetEntities
      if (typeof userId === 'string' && userId.startsWith('inv_')) {
        const invitationId = userId.replace(/^inv_/, '');
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
          return {
            success: true,
            data: [],
            count: 0,
            requestId
          };
        }

        const targetEntities = invitation.targetEntities && Array.isArray(invitation.targetEntities)
          ? invitation.targetEntities
          : (invitation.primaryEntityId && invitation.roleId
            ? [{ entityId: invitation.primaryEntityId, roleId: invitation.roleId, entityType: 'organization', membershipType: 'direct' }]
            : []);

        const assignments = [];
        for (const target of targetEntities) {
          const [entity] = await db
            .select({
              entityId: entities.entityId,
              entityName: entities.entityName,
              entityType: entities.entityType
            })
            .from(entities)
            .where(and(
              eq(entities.entityId, target.entityId),
              or(
                eq(entities.entityType, 'organization'),
                eq(entities.entityType, 'location')
              )
            ))
            .limit(1);

          if (!entity) continue;

          const [role] = await db
            .select({ roleId: customRoles.roleId, roleName: customRoles.roleName })
            .from(customRoles)
            .where(eq(customRoles.roleId, target.roleId))
            .limit(1);

          assignments.push({
            membershipId: null,
            assignmentId: null,
            organizationId: entity.entityId,
            entityId: entity.entityId,
            organizationName: entity.entityName,
            entityName: entity.entityName,
            entityType: entity.entityType,
            membershipType: target.membershipType || 'direct',
            membershipStatus: 'pending',
            accessLevel: null,
            isPrimary: invitation.primaryEntityId === target.entityId,
            assignmentType: target.membershipType || 'direct',
            joinedAt: null,
            invitedAt: invitation.createdAt,
            roleName: role?.roleName || 'Member',
            roleId: target.roleId
          });
        }

        console.log(`✅ [${requestId}] Found ${assignments.length} organization assignments (pending invitation)`);
        return {
          success: true,
          data: assignments,
          count: assignments.length,
          requestId
        };
      }

      const assignments = await db
        .select({
          membershipId: organizationMemberships.membershipId,
          assignmentId: organizationMemberships.membershipId,
          organizationId: entities.entityId,
          entityId: entities.entityId,
          organizationName: entities.entityName,
          entityName: entities.entityName,
          entityType: entities.entityType,
          membershipType: organizationMemberships.membershipType,
          membershipStatus: organizationMemberships.membershipStatus,
          accessLevel: organizationMemberships.accessLevel,
          isPrimary: organizationMemberships.isPrimary,
          assignmentType: organizationMemberships.membershipType,
          joinedAt: organizationMemberships.joinedAt,
          invitedAt: organizationMemberships.invitedAt,
          roleName: customRoles.roleName,
          roleId: customRoles.roleId
        })
        .from(organizationMemberships)
        .innerJoin(entities, eq(organizationMemberships.entityId, entities.entityId))
        .leftJoin(customRoles, eq(organizationMemberships.roleId, customRoles.roleId))
        .where(and(
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.tenantId, tenantId),
          eq(organizationMemberships.membershipStatus, 'active'),
          or(
            eq(entities.entityType, 'organization'),
            eq(entities.entityType, 'location')
          )
        ))
        .orderBy(organizationMemberships.createdAt);

      console.log(`✅ [${requestId}] Found ${assignments.length} organization assignments`);

      return {
        success: true,
        data: assignments,
        count: assignments.length,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get user organization assignments:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get user organization assignments',
        message: error.message,
        requestId
      });
    }
  });

  // Assign organization to user
  fastify.post('/users/assign-organization', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_EDIT)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const requestId = Logger.generateRequestId('assign-organization');
    const userId = (body.userId ?? '') as string; const organizationId = (body.organizationId ?? '') as string; const assignmentType = (body.assignmentType as string) ?? 'secondary'; const roleId = body.roleId;
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🔄 [${requestId}] Assigning organization:`, { userId, organizationId, assignmentType, tenantId });

      // Check if assignment already exists
      const existing = await db
        .select()
        .from(organizationMemberships)
        .where(and(
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.entityId, organizationId),
          eq(organizationMemberships.tenantId, tenantId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          success: false,
          error: 'Organization already assigned',
          message: 'User is already assigned to this organization',
          requestId
        });
      }

      // Check if this should be primary
      const isPrimary = assignmentType === 'primary';
      if (isPrimary) {
        // Remove primary flag from other assignments
        await (db.update(organizationMemberships) as any)
          .set({ isPrimary: false })
          .where(and(
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.tenantId, tenantId)
          ));
      }

      const membershipId = uuidv4();
      const result = await (db.insert(organizationMemberships) as any)
        .values({
          membershipId,
          userId,
          tenantId,
          entityId: organizationId,
          entityType: 'organization',
          roleId: roleId || null,
          membershipType: 'direct',
          membershipStatus: 'active',
          isPrimary,
          createdBy: ((request as ReqWithUser).userContext?.internalUserId ?? '') as string,
          joinedAt: new Date()
        })
        .returning();

      console.log(`✅ [${requestId}] Organization assigned successfully`);

      return {
        success: true,
        message: 'Organization assigned successfully',
        data: result[0],
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to assign organization:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to assign organization',
        message: error.message,
        requestId
      });
    }
  });

  // Assign organization to user
  fastify.post('/users/:userId/organizations', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_EDIT)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('assign-organization');
    const userId = params.userId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;
    const entityId = (body.entityId ?? '') as string; const roleId = body.roleId; const membershipType = (body.membershipType as string) ?? 'direct'; const isPrimary = (body.isPrimary as boolean) ?? false;

    try {
      console.log(`➕ [${requestId}] Assigning organization to user:`, {
        userId,
        entityId,
        roleId,
        membershipType,
        isPrimary,
        tenantId
      });

      // Validate required fields
      if (!entityId) {
        return ErrorResponses.badRequest(reply, 'entityId is required', { requestId });
      }

      // Check if user exists and belongs to tenant
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .limit(1);

      if (!user) {
        return ErrorResponses.notFound(reply, 'User', 'User not found or does not belong to this tenant', { requestId });
      }

      // Check if entity exists and belongs to tenant (can be organization or location)
      const [entity] = await db
        .select()
        .from(entities)
        .where(and(
          eq(entities.entityId, entityId),
          eq(entities.tenantId, tenantId),
          or(
            eq(entities.entityType, 'organization'),
            eq(entities.entityType, 'location')
          )
        ))
        .limit(1);

      if (!entity) {
        console.log(`❌ [${requestId}] Entity not found:`, { entityId, tenantId });
        return ErrorResponses.notFound(reply, 'Organization', 'Organization or location not found', { requestId });
      }

      // Use entity for the rest of the logic
      const organization = entity;

      // Check if user is already assigned to this organization
      const [existingMembership] = await db
        .select()
        .from(organizationMemberships)
        .where(and(
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.entityId, entityId),
          eq(organizationMemberships.membershipStatus, 'active')
        ))
        .limit(1);

      if (existingMembership) {
        return ErrorResponses.conflict(reply, 'User is already assigned to this organization', {
          requestId,
          membershipId: existingMembership.membershipId
        });
      }

      // If setting as primary, remove primary status from other organizations
      if (isPrimary) {
        await (db.update(organizationMemberships) as any)
          .set({ isPrimary: false })
          .where(and(
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.tenantId, tenantId)
          ));
      }

      // Create the membership
      const membershipId = uuidv4();
      await (db.insert(organizationMemberships) as any).values({
        membershipId,
        userId,
        entityId,
        entityType: entity.entityType, // Set the correct entity type (organization or location)
        tenantId,
        roleId: roleId || null,
        membershipType,
        membershipStatus: 'active',
        accessLevel: 'member',
        isPrimary,
        createdBy: (request as ReqWithUser).userContext.internalUserId,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`✅ [${requestId}] Organization assigned successfully:`, { membershipId });

      // Publish organization assignment created event (optional - don't fail if eventPublisher is not available)
      try {
        const { OrganizationAssignmentService } = await import('../../../features/organizations/services/organization-assignment-service.js');
        await OrganizationAssignmentService.publishOrgAssignmentCreated({
          tenantId,
            userId,
          organizationId: entityId,
            organizationName: organization.entityName,
          assignmentId: membershipId,
          assignmentType: membershipType,
          accessLevel: 'member',
          isActive: true,
          isPrimary: isPrimary || false,
          roleId: roleId || undefined,
          assignedBy: (request as ReqWithUser).userContext.internalUserId, // Use internalUserId (UUID) instead of userId (Kinde ID)
          assignedAt: new Date().toISOString()
        });
        console.log(`✅ [${requestId}] Published organization assignment event to crm:organization-assignments stream`);
      } catch (eventErr: unknown) {
        const eventError = eventErr as Error;
        console.error(`❌ [${requestId}] Failed to publish organization assignment event:`, eventError);
        console.warn(`⚠️ [${requestId}] Event publishing failed (non-critical):`, eventError.message);
      }

      return {
        success: true,
        data: {
          membershipId,
          userId,
          entityId,
          organizationName: organization.entityName,
          roleId,
          membershipType,
          isPrimary,
          joinedAt: new Date()
        },
        message: 'Organization assigned successfully'
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Error assigning organization:`, error);
      return ErrorResponses.internalError(reply, 'Failed to assign organization', error as Error, {
        requestId
      });
    }
  });

  // Remove organization assignment from user
  fastify.delete('/users/:userId/organizations/:membershipId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_EDIT)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('remove-organization');
    const userId = params.userId ?? ''; const membershipId = params.membershipId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🗑️ [${requestId}] Removing organization assignment:`, { userId, membershipId, tenantId });

      // Verify the membership belongs to the user and get entity info
      const [membershipData] = await db
        .select({
          membership: organizationMemberships,
          entityName: entities.entityName,
          entityType: entities.entityType
        })
        .from(organizationMemberships)
        .innerJoin(entities, eq(organizationMemberships.entityId, entities.entityId))
        .where(and(
          eq(organizationMemberships.membershipId, membershipId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.tenantId, tenantId)
        ))
        .limit(1);

      if (!membershipData) {
        return ErrorResponses.notFound(reply, 'Membership', 'Organization assignment not found', {
          requestId
        });
      }

      const membership = membershipData.membership;

      // Don't allow removing primary assignment
      if (membership.isPrimary) {
        return reply.code(400).send({
          success: false,
          error: 'Cannot remove primary organization',
          message: 'Cannot remove the user\'s primary organization assignment',
          requestId
        });
      }

      // Store entity info for event publishing before deletion
      const entityId = membership.entityId;

      await db
        .delete(organizationMemberships)
        .where(eq(organizationMemberships.membershipId, membershipId))
        .returning();

      console.log(`✅ [${requestId}] Organization assignment removed successfully`);

      // Publish organization assignment deleted event (optional - don't fail if eventPublisher is not available)
      try {
        const { OrganizationAssignmentService } = await import('../../../features/organizations/services/organization-assignment-service.js');
        await OrganizationAssignmentService.publishOrgAssignmentDeleted({
          tenantId,
          userId,
          organizationId: entityId,
          assignmentId: membershipId,
          deletedBy: (request as ReqWithUser).userContext.internalUserId, // Use internalUserId (UUID) instead of userId (Kinde ID)
          reason: 'user_removed'
        });
        console.log(`✅ [${requestId}] Published organization assignment deleted event to crm:organization-assignments stream`);
      } catch (eventErr: unknown) {
        const eventError = eventErr as Error;
        console.error(`❌ [${requestId}] Failed to publish organization assignment deleted event:`, eventError);
        console.warn(`⚠️ [${requestId}] Event publishing failed (non-critical):`, eventError.message);
      }

      return {
        success: true,
        message: 'Organization assignment removed successfully',
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to remove organization assignment:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to remove organization assignment',
        message: error.message,
        requestId
      });
    }
  });

  // Update user's organization role
  fastify.put('/users/:userId/organizations/:membershipId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_EDIT)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const requestId = Logger.generateRequestId('update-organization-role');
    const userId = params.userId ?? ''; const membershipId = params.membershipId ?? '';
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;
    const roleId = body.roleId;

    try {
      console.log(`🔄 [${requestId}] Updating organization role:`, {
        userId,
        membershipId,
        roleId,
        tenantId
      });

      // Verify the membership exists and belongs to the user
      const [membership] = await db
        .select({
          membership: organizationMemberships,
          organizationName: entities.entityName
        })
        .from(organizationMemberships)
        .innerJoin(entities, eq(organizationMemberships.entityId, entities.entityId))
        .where(and(
          eq(organizationMemberships.membershipId, membershipId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.tenantId, tenantId),
          eq(organizationMemberships.membershipStatus, 'active')
        ))
        .limit(1);

      if (!membership) {
        return ErrorResponses.notFound(reply, 'Membership', 'Organization assignment not found', {
          requestId
        });
      }

      // If roleId is provided, validate it exists (allow null for no role)
      if (roleId) {
        const [role] = await db
          .select()
          .from(customRoles)
          .where(and(
            eq(customRoles.roleId, roleId as string),
            eq(customRoles.tenantId, tenantId)
          ))
          .limit(1);

        if (!role) {
          return ErrorResponses.notFound(reply, 'Role', 'Role not found', { requestId });
        }
      }

      // Update the role
      await (db.update(organizationMemberships) as any)
        .set({
          roleId: (roleId as string) || null,
          updatedAt: new Date()
        })
        .where(eq(organizationMemberships.membershipId, membershipId));

      console.log(`✅ [${requestId}] Organization role updated successfully`);

      // Publish organization assignment updated event (optional - don't fail if eventPublisher is not available)
      try {
        const { OrganizationAssignmentService } = await import('../../../features/organizations/services/organization-assignment-service.js');
        await OrganizationAssignmentService.publishOrgAssignmentUpdated({
          tenantId,
            userId,
          organizationId: membership.membership.entityId,
            organizationName: membership.organizationName,
          assignmentId: membershipId,
          assignmentType: membership.membership.membershipType,
          accessLevel: membership.membership.accessLevel || 'member',
          isActive: membership.membership.membershipStatus === 'active',
          isPrimary: membership.membership.isPrimary,
          roleId: roleId || undefined,
          updatedBy: ((request as ReqWithUser).userContext?.internalUserId ?? '') as string, // Use internalUserId (UUID) instead of userId (Kinde ID)
          changes: {
            roleId: roleId
          }
        });
        console.log(`✅ [${requestId}] Published organization assignment updated event to crm:organization-assignments stream`);
      } catch (eventErr: unknown) {
        const eventError = eventErr as Error;
        console.error(`❌ [${requestId}] Failed to publish organization assignment updated event:`, eventError);
        console.warn(`⚠️ [${requestId}] Event publishing failed (non-critical):`, eventError.message);
      }

      return {
        success: true,
        data: {
          membershipId,
          userId,
          entityId: membership.membership.entityId,
          organizationName: membership.organizationName,
          roleId
        },
        message: 'Organization role updated successfully'
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Error updating organization role:`, error);
      return ErrorResponses.internalError(reply, 'Failed to update organization role', error, {
        requestId
      });
    }
  });
}
