import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { UserManagementService } from '../services/user-management-service.js';
import { TenantService } from '../../../services/tenant-service.js';
import Logger from '../../../utils/logger.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Accept camelCase or snake_case from clients; empty string / null → undefined */
const optionalUuid = z
  .union([z.string().uuid(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? undefined : v));

const inviteEntitySchema = z.object({
  entityId: z.string().uuid(),
  roleId: optionalUuid,
  entityType: z.string().optional(),
});

const inviteSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const b = raw as Record<string, unknown>;
    const te = b.target_entities ?? b.targetEntities;
    const normalizedTe = Array.isArray(te)
      ? te.map((row) => {
          if (!row || typeof row !== 'object') return row;
          const r = row as Record<string, unknown>;
          return {
            ...r,
            entityId: r.entityId ?? r.entity_id,
            roleId: r.roleId ?? r.role_id,
            entityType: r.entityType ?? r.entity_type,
          };
        })
      : undefined;
    return {
      ...b,
      roleId: b.roleId ?? b.role_id,
      targetEntities: normalizedTe ?? b.targetEntities ?? b.target_entities,
      message: b.message,
    };
  },
  z.object({
    email: z.string().email(),
    roleId: optionalUuid,
    targetEntities: z.array(inviteEntitySchema).optional(),
    message: z.string().max(500).optional(),
  }),
);

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  title: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  scope: z.string().max(20).optional(),
  isTemporary: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

const assignOrganizationSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const b = raw as Record<string, unknown>;
    return {
      entityId: b.entityId ?? b.entity_id ?? b.organizationId ?? b.organization_id,
      accessLevel: b.accessLevel ?? b.access_level,
    };
  },
  z.object({
    entityId: z.string().uuid(),
    accessLevel: z.enum(['admin', 'manager', 'standard', 'limited']).optional(),
  }),
);

// ---------------------------------------------------------------------------
// Helper: generate a simple request ID
// ---------------------------------------------------------------------------
function requestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // GET / — list users (paginated, filterable)
  // -----------------------------------------------------------------------
  fastify.get(
    '/',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('get-users');
      try {
        const { tenantId } = request.userContext as { tenantId: string };
        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        const query = request.query as Record<string, string | undefined>;
        const data = await UserManagementService.getUsers(tenantId, {
          search: query.search,
          status: (query.status as 'active' | 'invited' | 'inactive' | 'all') ?? 'all',
          page: query.page ? Number(query.page) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
          sortBy: (query.sortBy as 'name' | 'email' | 'createdAt' | 'lastActiveAt') ?? undefined,
          sortOrder: (query.sortOrder as 'asc' | 'desc') ?? undefined,
        });

        return reply.send({ success: true, data });
      } catch (err: unknown) {
        Logger.log('error', 'user', reqId, 'Error fetching users', { error: (err as Error).message });
        return reply.code(500).send({ success: false, error: 'Failed to fetch users' });
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /stats — user counts by status
  // -----------------------------------------------------------------------
  fastify.get(
    '/stats',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('user-stats');
      try {
        const { tenantId } = request.userContext as { tenantId: string };
        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        const stats = await UserManagementService.getUserStats(tenantId);
        return reply.send({ success: true, data: stats });
      } catch (err: unknown) {
        Logger.log('error', 'user', reqId, 'Error fetching user stats', { error: (err as Error).message });
        return reply.code(500).send({ success: false, error: 'Failed to fetch user stats' });
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /invitations — list invitations
  // -----------------------------------------------------------------------
  fastify.get(
    '/invitations',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('get-invitations');
      try {
        const { tenantId } = request.userContext as { tenantId: string };
        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        const query = request.query as Record<string, string | undefined>;
        const data = await UserManagementService.getInvitations(tenantId, {
          status: (query.status as 'pending' | 'accepted' | 'expired' | 'cancelled' | 'all') ?? 'all',
          search: query.search,
          page: query.page ? Number(query.page) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
        });

        return reply.send({ success: true, data });
      } catch (err: unknown) {
        Logger.log('error', 'user', reqId, 'Error fetching invitations', { error: (err as Error).message });
        return reply.code(500).send({ success: false, error: 'Failed to fetch invitations' });
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /roles/available — available roles for dropdowns
  // -----------------------------------------------------------------------
  fastify.get(
    '/roles/available',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('available-roles');
      try {
        const { tenantId } = request.userContext as { tenantId: string };
        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        const roles = await UserManagementService.getAvailableRoles(tenantId);
        return reply.send({ success: true, data: roles });
      } catch (err: unknown) {
        Logger.log('error', 'user', reqId, 'Error fetching available roles', { error: (err as Error).message });
        return reply.code(500).send({ success: false, error: 'Failed to fetch available roles' });
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /:userId — user detail
  // -----------------------------------------------------------------------
  fastify.get(
    '/:userId',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('get-user-detail');
      try {
        const { tenantId } = request.userContext as { tenantId: string };
        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        const { userId } = request.params as { userId: string };
        const data = await UserManagementService.getUserDetail(tenantId, userId);

        if (!data) {
          return reply.code(404).send({ success: false, error: 'User not found' });
        }

        return reply.send({ success: true, data });
      } catch (err: unknown) {
        Logger.log('error', 'user', reqId, 'Error fetching user detail', { error: (err as Error).message });
        return reply.code(500).send({ success: false, error: 'Failed to fetch user detail' });
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /:userId/roles — user role assignments
  // -----------------------------------------------------------------------
  fastify.get(
    '/:userId/roles',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('get-user-roles');
      try {
        const { tenantId } = request.userContext as { tenantId: string };
        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        const { userId } = request.params as { userId: string };
        const roles = await UserManagementService.getUserRoles(tenantId, userId);
        return reply.send({ success: true, data: roles });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch user roles';
        Logger.log('error', 'user', reqId, 'Error fetching user roles', { error: message });
        return reply.code(err instanceof Error && message.includes('not found') ? 404 : 500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // -----------------------------------------------------------------------
  // POST /invite — invite a new user (admin only)
  // -----------------------------------------------------------------------
  fastify.post(
    '/invite',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('invite-user');
      try {
        const { tenantId, isTenantAdmin, internalUserId } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
          internalUserId: string | null;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        if (!internalUserId) {
          return reply.code(400).send({ success: false, error: 'Missing user record for inviter' });
        }

        const parsed = inviteSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: 'Validation error',
            details: parsed.error.issues,
          });
        }

        const invitation = await UserManagementService.inviteUser(tenantId, {
          ...parsed.data,
          invitedBy: internalUserId,
        });

        return reply.code(201).send({ success: true, data: invitation });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to invite user';
        Logger.log('error', 'user', reqId, 'Error inviting user', { error: message });

        const statusCode =
          message.includes('already exists') ||
          message.includes('pending invitation') ||
          message.includes('Only one Organization Admin')
            ? 409
            : 500;
        return reply.code(statusCode).send({ success: false, error: message });
      }
    },
  );

  // -----------------------------------------------------------------------
  // POST /:userId/roles — assign a role (admin only)
  // -----------------------------------------------------------------------
  fastify.post(
    '/:userId/roles',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('assign-role');
      try {
        const { tenantId, isTenantAdmin, internalUserId } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
          internalUserId: string | null;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        if (!internalUserId) {
          return reply.code(400).send({ success: false, error: 'Missing user record for admin' });
        }

        const { userId } = request.params as { userId: string };
        const parsed = assignRoleSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: 'Validation error',
            details: parsed.error.issues,
          });
        }

        const assignment = await UserManagementService.assignRole(tenantId, {
          userId,
          ...parsed.data,
          assignedBy: internalUserId,
        });

        return reply.code(201).send({ success: true, data: assignment });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to assign role';
        Logger.log('error', 'user', reqId, 'Error assigning role', { error: message });

        const statusCode = message.includes('not found')
          ? 404
          : message.includes('already has') || message.includes('Only one Organization Admin')
            ? 409
            : 500;
        return reply.code(statusCode).send({ success: false, error: message });
      }
    },
  );

  // -----------------------------------------------------------------------
  // PUT /:userId/profile — update profile fields
  // -----------------------------------------------------------------------
  fastify.put(
    '/:userId/profile',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('update-profile');
      try {
        const { tenantId, userId: currentUserId, isTenantAdmin } = request.userContext as {
          tenantId: string;
          userId: string;
          isTenantAdmin: boolean;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        const { userId } = request.params as { userId: string };

        // Users can update their own profile; admins can update anyone
        if (userId !== currentUserId && !isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'You can only update your own profile' });
        }

        const parsed = updateProfileSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: 'Validation error',
            details: parsed.error.issues,
          });
        }

        const updated = await UserManagementService.updateUserProfile(tenantId, userId, parsed.data);
        return reply.send({ success: true, data: updated });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update profile';
        Logger.log('error', 'user', reqId, 'Error updating profile', { error: message });
        return reply.code(message.includes('not found') ? 404 : 500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // -----------------------------------------------------------------------
  // PUT /:userId/status — activate/deactivate (admin only)
  // -----------------------------------------------------------------------
  fastify.put(
    '/:userId/status',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('update-status');
      try {
        const { tenantId, isTenantAdmin } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        const { userId } = request.params as { userId: string };
        const parsed = updateStatusSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: 'Validation error',
            details: parsed.error.issues,
          });
        }

        const updated = await UserManagementService.updateUserStatus(tenantId, userId, parsed.data.isActive);
        return reply.send({ success: true, data: updated });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update user status';
        Logger.log('error', 'user', reqId, 'Error updating user status', { error: message });
        return reply.code(message.includes('not found') ? 404 : 500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /:userId — remove user from tenant (admin only)
  // -----------------------------------------------------------------------
  fastify.delete(
    '/:userId',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('remove-user');
      try {
        const { tenantId, isTenantAdmin, internalUserId } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
          internalUserId: string | null;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        const { userId } = request.params as { userId: string };
        const removed = await TenantService.removeUser(tenantId, userId, internalUserId ?? '');
        return reply.send({ success: true, data: removed });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove user';
        Logger.log('error', 'user', reqId, 'Error removing user', { error: message });

        const statusCode = message.includes('not found')
          ? 404
          : message.includes('Cannot remove')
            ? 400
            : 500;
        return reply.code(statusCode).send({ success: false, error: message });
      }
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /:userId/roles/:assignmentId — remove role assignment (admin only)
  // -----------------------------------------------------------------------
  fastify.delete(
    '/:userId/roles/:assignmentId',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('remove-role');
      try {
        const { tenantId, isTenantAdmin } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        const { assignmentId } = request.params as { assignmentId: string };
        const removed = await UserManagementService.removeRoleAssignment(tenantId, assignmentId);
        return reply.send({ success: true, data: removed });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove role assignment';
        Logger.log('error', 'user', reqId, 'Error removing role assignment', { error: message });
        return reply.code(message.includes('not found') ? 404 : 500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // -----------------------------------------------------------------------
  // POST /:userId/organizations — assign user to an organization (admin only)
  // -----------------------------------------------------------------------
  fastify.post(
    '/:userId/organizations',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('add-org-membership');
      try {
        const { tenantId, isTenantAdmin, internalUserId } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
          internalUserId: string | null;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        const { userId } = request.params as { userId: string };
        const parsed = assignOrganizationSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: 'Validation error',
            details: parsed.error.issues,
          });
        }

        const data = await UserManagementService.addOrganizationMembership(tenantId, userId, parsed.data, {
          createdByInternalUserId: internalUserId,
        });
        return reply.code(201).send({ success: true, data });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to assign organization';
        Logger.log('error', 'user', reqId, 'Error assigning organization', { error: message });
        const statusCode = message.includes('not found')
          ? 404
          : message.includes('already a member')
            ? 409
            : 500;
        return reply.code(statusCode).send({ success: false, error: message });
      }
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /:userId/organizations/:membershipId — remove org membership (admin only)
  // -----------------------------------------------------------------------
  fastify.delete(
    '/:userId/organizations/:membershipId',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('remove-org-membership');
      try {
        const { tenantId, isTenantAdmin, internalUserId } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
          internalUserId: string | null;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        const { userId, membershipId } = request.params as { userId: string; membershipId: string };
        const data = await UserManagementService.removeOrganizationMembership(tenantId, userId, membershipId, {
          deletedByInternalUserId: internalUserId,
        });
        return reply.send({ success: true, data });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove organization membership';
        Logger.log('error', 'user', reqId, 'Error removing organization membership', { error: message });
        const statusCode = message.includes('not found')
          ? 404
          : message.includes('Cannot remove primary')
            ? 400
            : 500;
        return reply.code(statusCode).send({ success: false, error: message });
      }
    },
  );

  // -----------------------------------------------------------------------
  // POST /invitations/:invitationId/resend — resend invitation (admin only)
  // -----------------------------------------------------------------------
  fastify.post(
    '/invitations/:invitationId/resend',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('resend-invitation');
      try {
        const { tenantId, isTenantAdmin } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        const { invitationId } = request.params as { invitationId: string };
        const updated = await UserManagementService.resendInvitation(tenantId, invitationId);
        return reply.send({ success: true, data: updated });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to resend invitation';
        Logger.log('error', 'user', reqId, 'Error resending invitation', { error: message });
        return reply.code(message.includes('not found') ? 404 : 500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /invitations/:invitationId — cancel invitation (admin only)
  // -----------------------------------------------------------------------
  fastify.delete(
    '/invitations/:invitationId',
    { preHandler: [authenticateToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reqId = requestId('cancel-invitation');
      try {
        const { tenantId, isTenantAdmin, internalUserId } = request.userContext as {
          tenantId: string;
          isTenantAdmin: boolean;
          internalUserId: string | null;
        };

        if (!tenantId) {
          return reply.code(400).send({ success: false, error: 'Missing tenant context' });
        }

        if (!isTenantAdmin) {
          return reply.code(403).send({ success: false, error: 'Admin access required' });
        }

        if (!internalUserId) {
          return reply.code(400).send({ success: false, error: 'Missing user record' });
        }

        const { invitationId } = request.params as { invitationId: string };
        const cancelled = await UserManagementService.cancelInvitation(tenantId, invitationId, internalUserId);
        return reply.send({ success: true, data: cancelled });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to cancel invitation';
        Logger.log('error', 'user', reqId, 'Error cancelling invitation', { error: message });
        return reply.code(message.includes('not found') ? 404 : 500).send({
          success: false,
          error: message,
        });
      }
    },
  );
}
