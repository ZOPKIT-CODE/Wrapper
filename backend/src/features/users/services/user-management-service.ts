import { db } from '../../../db/index.js';
import {
  tenantUsers,
  tenants,
  customRoles,
  userRoleAssignments,
  organizationMemberships,
  tenantInvitations,
  entities,
} from '../../../db/schema/index.js';
import { eq, and, or, desc, asc, sql, count, like, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';
import Logger from '../../../utils/logger.js';

/** Matches seeded / matrix role name; enforced as a single active assignment + pending invite per tenant */
function isOrganizationAdminRoleName(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === 'organization admin';
}

/** `tenant_users` has no `name` column — derive display name from first/last. */
function displayNameFromParts(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const n = [firstName, lastName].filter(Boolean).join(' ').trim();
  return n.length ? n : null;
}

/** SQL expression for sort/search on full display name (PostgreSQL). */
function tenantUserDisplayNameExpr() {
  return sql`TRIM(CONCAT(COALESCE(${tenantUsers.firstName}, ''), ' ', COALESCE(${tenantUsers.lastName}, '')))`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GetUsersOptions {
  search?: string;
  status?: 'active' | 'invited' | 'inactive' | 'all';
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastActiveAt';
  sortOrder?: 'asc' | 'desc';
}

export interface GetInvitationsOptions {
  status?: 'pending' | 'accepted' | 'expired' | 'cancelled' | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export interface InviteUserInput {
  email: string;
  roleId?: string;
  targetEntities?: Array<{ entityId: string; roleId?: string; entityType?: string }>;
  invitedBy: string;
  message?: string;
}

export interface UpdateUserProfileInput {
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  department?: string;
  phone?: string;
}

/** Role assignments are always tenant-wide; `organizationId` / `scope` are ignored if sent. */
export interface AssignRoleInput {
  userId: string;
  roleId: string;
  /** @deprecated Ignored — use memberships for org access */
  organizationId?: string;
  /** @deprecated Ignored — stored as `global` */
  scope?: string;
  assignedBy: string;
  isTemporary?: boolean;
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class UserManagementService {
  /**
   * Get all users (active + invited) with their primary role in a single efficient query.
   * Supports search, filter by status, pagination.
   */
  static async getUsers(tenantId: string, options: GetUsersOptions = {}) {
    const {
      search,
      status = 'all',
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = [eq(tenantUsers.tenantId, tenantId)];

    if (status === 'active') {
      conditions.push(eq(tenantUsers.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(tenantUsers.isActive, false));
    }
    // 'invited' and 'all' handled below after merging invitations

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          sql`(${tenantUserDisplayNameExpr()})::text LIKE ${searchPattern}`,
          like(tenantUsers.email, searchPattern),
          like(tenantUsers.firstName, searchPattern),
          like(tenantUsers.lastName, searchPattern),
        )!,
      );
    }

    // If we only want invited users, skip tenantUsers query
    if (status === 'invited') {
      return this._getInvitedUsersPage(tenantId, search, page, limit, sortOrder);
    }

    // Get active users with their highest-priority role via LEFT JOIN
    const orderCol = (() => {
      switch (sortBy) {
        case 'name': return tenantUserDisplayNameExpr();
        case 'email': return tenantUsers.email;
        case 'lastActiveAt': return tenantUsers.lastActiveAt;
        case 'createdAt':
        default: return tenantUsers.createdAt;
      }
    })();

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Step 1: paginate on tenantUsers directly (no join) to get correct LIMIT/OFFSET
    const [userIdRows, totalResult] = await Promise.all([
      db
        .select({ userId: tenantUsers.userId })
        .from(tenantUsers)
        .where(and(...conditions))
        .orderBy(orderFn(orderCol))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: count() })
        .from(tenantUsers)
        .where(and(...conditions)),
    ]);

    const userIds = userIdRows.map((r) => r.userId);

    // Step 2: fetch full user data + roles for those specific user IDs
    const usersWithRoles = userIds.length
      ? await db
          .select({
            userId: tenantUsers.userId,
            email: tenantUsers.email,
            name: sql<string | null>`NULLIF(${tenantUserDisplayNameExpr()}, '')`.as('name'),
            firstName: tenantUsers.firstName,
            lastName: tenantUsers.lastName,
            isActive: tenantUsers.isActive,
            isTenantAdmin: tenantUsers.isTenantAdmin,
            lastActiveAt: tenantUsers.lastActiveAt,
            createdAt: tenantUsers.createdAt,
            primaryOrganizationId: tenantUsers.primaryOrganizationId,
            roleName: customRoles.roleName,
            roleId: customRoles.roleId,
            roleColor: customRoles.color,
          })
          .from(tenantUsers)
          .leftJoin(
            userRoleAssignments,
            and(
              eq(userRoleAssignments.userId, tenantUsers.userId),
              eq(userRoleAssignments.isActive, true),
            ),
          )
          .leftJoin(customRoles, eq(customRoles.roleId, userRoleAssignments.roleId))
          .where(inArray(tenantUsers.userId, userIds))
          .orderBy(orderFn(orderCol))
      : [];

    // Deduplicate: keep only the first (primary) role per user
    const seen = new Set<string>();
    const dedupedUsers = usersWithRoles.filter((u) => {
      if (seen.has(u.userId)) return false;
      seen.add(u.userId);
      return true;
    });

    const total = Number(totalResult[0]?.total ?? 0);

    // Map to clean output with a userType discriminator
    const items = dedupedUsers.map((u) => ({
      userId: u.userId,
      email: u.email,
      name: u.name ?? displayNameFromParts(u.firstName, u.lastName),
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      isTenantAdmin: u.isTenantAdmin,
      lastActiveAt: u.lastActiveAt,
      lastLoginAt: null as string | null,
      createdAt: u.createdAt,
      avatar: null as string | null,
      title: null as string | null,
      department: null as string | null,
      primaryOrganizationId: u.primaryOrganizationId,
      role: u.roleId
        ? { roleId: u.roleId, roleName: u.roleName, color: u.roleColor }
        : null,
      userType: 'member' as const,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Internal helper: paginated pending invitations formatted like users.
   */
  private static async _getInvitedUsersPage(
    tenantId: string,
    search: string | undefined,
    page: number,
    limit: number,
    sortOrder: 'asc' | 'desc',
  ) {
    const offset = (page - 1) * limit;
    const conditions = [
      eq(tenantInvitations.tenantId, tenantId),
      eq(tenantInvitations.status, 'pending'),
    ];

    if (search) {
      conditions.push(like(tenantInvitations.email, `%${search}%`));
    }

    const orderFn = sortOrder === 'asc' ? asc : desc;

    const [invitations, totalResult] = await Promise.all([
      db
        .select({
          invitationId: tenantInvitations.invitationId,
          email: tenantInvitations.email,
          roleId: tenantInvitations.roleId,
          status: tenantInvitations.status,
          expiresAt: tenantInvitations.expiresAt,
          createdAt: tenantInvitations.createdAt,
          invitedBy: tenantInvitations.invitedBy,
          roleName: customRoles.roleName,
          roleColor: customRoles.color,
        })
        .from(tenantInvitations)
        .leftJoin(customRoles, eq(customRoles.roleId, tenantInvitations.roleId))
        .where(and(...conditions))
        .orderBy(orderFn(tenantInvitations.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: count() })
        .from(tenantInvitations)
        .where(and(...conditions)),
    ]);

    const total = Number(totalResult[0]?.total ?? 0);

    const items = invitations.map((inv) => ({
      invitationId: inv.invitationId,
      email: inv.email,
      name: null,
      firstName: null,
      lastName: null,
      isActive: null,
      isTenantAdmin: false,
      lastActiveAt: null,
      lastLoginAt: null,
      createdAt: inv.createdAt,
      avatar: null,
      title: null,
      department: null,
      primaryOrganizationId: null,
      role: inv.roleId
        ? { roleId: inv.roleId, roleName: inv.roleName, color: inv.roleColor }
        : null,
      userType: 'invited' as const,
      invitationStatus: inv.status,
      expiresAt: inv.expiresAt,
    }));

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get a single user with full details: roles, memberships, activity.
   * Uses LEFT JOINs to get everything in minimal queries.
   */
  static async getUserDetail(tenantId: string, userId: string) {
    // Fetch user base record
    const [user] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .limit(1);

    if (!user) return null;

    // Fetch roles + memberships in parallel
    const [roles, memberships, primaryOrg] = await Promise.all([
      db
        .select({
          assignmentId: userRoleAssignments.id,
          roleId: userRoleAssignments.roleId,
          organizationId: userRoleAssignments.organizationId,
          scope: userRoleAssignments.scope,
          isTemporary: userRoleAssignments.isTemporary,
          expiresAt: userRoleAssignments.expiresAt,
          isActive: userRoleAssignments.isActive,
          assignedAt: userRoleAssignments.assignedAt,
          roleName: customRoles.roleName,
          roleColor: customRoles.color,
          roleDescription: customRoles.description,
          isSystemRole: customRoles.isSystemRole,
          priority: customRoles.priority,
        })
        .from(userRoleAssignments)
        .innerJoin(customRoles, and(
          eq(customRoles.roleId, userRoleAssignments.roleId),
          eq(customRoles.tenantId, tenantId)
        ))
        .where(eq(userRoleAssignments.userId, userId)),

      db
        .select({
          membershipId: organizationMemberships.membershipId,
          entityId: organizationMemberships.entityId,
          entityType: organizationMemberships.entityType,
          membershipType: organizationMemberships.membershipType,
          membershipStatus: organizationMemberships.membershipStatus,
          accessLevel: organizationMemberships.accessLevel,
          isPrimary: organizationMemberships.isPrimary,
          createdAt: organizationMemberships.createdAt,
          entityName: entities.entityName,
        })
        .from(organizationMemberships)
        .innerJoin(entities, eq(entities.entityId, organizationMemberships.entityId))
        .where(
          and(
            eq(organizationMemberships.tenantId, tenantId),
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.membershipStatus, 'active'),
          ),
        ),

      user.primaryOrganizationId
        ? db
            .select({ entityId: entities.entityId, entityName: entities.entityName, entityType: entities.entityType })
            .from(entities)
            .where(eq(entities.entityId, user.primaryOrganizationId))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    ]);

    return {
      ...user,
      primaryOrganization: primaryOrg,
      roles,
      memberships,
    };
  }

  /**
   * Get all invitations for a tenant with inviter info.
   * Supports filtering by status.
   */
  static async getInvitations(tenantId: string, options: GetInvitationsOptions = {}) {
    const {
      status = 'all',
      search,
      page = 1,
      limit = 25,
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [eq(tenantInvitations.tenantId, tenantId)];

    if (status !== 'all') {
      conditions.push(eq(tenantInvitations.status, status));
    }

    if (search) {
      conditions.push(like(tenantInvitations.email, `%${search}%`));
    }

    const [invitationRows, totalResult] = await Promise.all([
      db
        .select({
          invitationId: tenantInvitations.invitationId,
          email: tenantInvitations.email,
          roleId: tenantInvitations.roleId,
          targetEntities: tenantInvitations.targetEntities,
          invitationScope: tenantInvitations.invitationScope,
          primaryEntityId: tenantInvitations.primaryEntityId,
          status: tenantInvitations.status,
          expiresAt: tenantInvitations.expiresAt,
          acceptedAt: tenantInvitations.acceptedAt,
          cancelledAt: tenantInvitations.cancelledAt,
          createdAt: tenantInvitations.createdAt,
          invitedBy: tenantInvitations.invitedBy,
          invitationToken: tenantInvitations.invitationToken,
          invitationUrl: tenantInvitations.invitationUrl,
          // Inviter info (`tenant_users` has no single `name` column)
          inviterName: sql<string | null>`NULLIF(${tenantUserDisplayNameExpr()}, '')`.as('inviterName'),
          inviterEmail: tenantUsers.email,
          // Role info
          roleName: customRoles.roleName,
          roleColor: customRoles.color,
        })
        .from(tenantInvitations)
        .leftJoin(tenantUsers, eq(tenantUsers.userId, tenantInvitations.invitedBy))
        .leftJoin(customRoles, eq(customRoles.roleId, tenantInvitations.roleId))
        .where(and(...conditions))
        .orderBy(desc(tenantInvitations.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: count() })
        .from(tenantInvitations)
        .where(and(...conditions)),
    ]);

    const total = Number(totalResult[0]?.total ?? 0);

    const base =
      process.env.INVITATION_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3001';
    const baseNormalized = base.replace(/\/$/, '');

    const items = invitationRows.map((row) => {
      const { invitationToken, invitationUrl, ...rest } = row;
      const invitationLink =
        (invitationUrl && invitationUrl.trim()) ||
        (invitationToken ? `${baseNormalized}/invite/accept?token=${invitationToken}` : undefined);
      return { ...rest, invitationLink };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Organization Admin is a singleton per tenant: one active assignment and at most one pending invite with that role.
   */
  static async assertSingleOrganizationAdminSlotAvailable(tenantId: string, roleId: string): Promise<void> {
    const [r] = await db
      .select({ roleName: customRoles.roleName })
      .from(customRoles)
      .where(and(eq(customRoles.tenantId, tenantId), eq(customRoles.roleId, roleId)))
      .limit(1);

    if (!r?.roleName || !isOrganizationAdminRoleName(r.roleName)) return;

    const [assignmentRow] = await db
      .select({ n: count() })
      .from(userRoleAssignments)
      .innerJoin(tenantUsers, eq(tenantUsers.userId, userRoleAssignments.userId))
      .where(
        and(
          eq(tenantUsers.tenantId, tenantId),
          eq(userRoleAssignments.roleId, roleId),
          eq(userRoleAssignments.isActive, true),
        ),
      );

    const [inviteRow] = await db
      .select({ n: count() })
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.roleId, roleId),
          eq(tenantInvitations.status, 'pending'),
        ),
      );

    const occupied = Number(assignmentRow?.n ?? 0) + Number(inviteRow?.n ?? 0);
    if (occupied > 0) {
      throw new Error(
        'Only one Organization Admin is allowed per tenant. Remove the existing assignment or cancel the pending invitation first.',
      );
    }
  }

  /**
   * Invite a new user. Creates invitation record and returns it.
   */
  static async inviteUser(tenantId: string, data: InviteUserInput) {
    const { email, roleId: rawRoleId, targetEntities, invitedBy } = data;

    /** Prefer top-level role; else first per-entity role (UI often sends role only on targets). */
    let roleId = rawRoleId;
    if (!roleId && targetEntities?.length) {
      const fromTargets = targetEntities.map((e) => e.roleId).filter((x): x is string => !!x);
      if (fromTargets.length) {
        roleId = fromTargets[0];
      }
    }

    if (roleId) {
      await UserManagementService.assertSingleOrganizationAdminSlotAvailable(tenantId, roleId);
    }

    // Check if already invited with pending status
    const [existingInvitation] = await db
      .select()
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.email, email.toLowerCase()),
          eq(tenantInvitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (existingInvitation) {
      throw new Error('A pending invitation already exists for this email');
    }

    // Check if user already exists in the tenant
    const [existingUser] = await db
      .select({ userId: tenantUsers.userId })
      .from(tenantUsers)
      .where(
        and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.email, email.toLowerCase())),
      )
      .limit(1);

    if (existingUser) {
      throw new Error('User already exists in this tenant');
    }

    const invitationToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const [invitation] = await db
      .insert(tenantInvitations)
      .values({
        tenantId,
        email: email.toLowerCase(),
        roleId: roleId ?? null,
        targetEntities: targetEntities ?? [],
        invitationScope: targetEntities?.length ? 'multi-entity' : 'tenant',
        invitedBy,
        invitationToken,
        status: 'pending',
        expiresAt,
      })
      .returning();

    return invitation;
  }

  /**
   * Resend an invitation email. Extends expiry by 7 days.
   */
  static async resendInvitation(tenantId: string, invitationId: string) {
    const [invitation] = await db
      .select()
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.invitationId, invitationId),
          eq(tenantInvitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (!invitation) {
      throw new Error('Invitation not found or is no longer pending');
    }

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const [updated] = await db
      .update(tenantInvitations)
      .set({
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.invitationId, invitationId),
        ),
      )
      .returning();

    return updated;
  }

  /**
   * Cancel a pending invitation.
   */
  static async cancelInvitation(tenantId: string, invitationId: string, cancelledBy: string) {
    const [invitation] = await db
      .select()
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.invitationId, invitationId),
          eq(tenantInvitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (!invitation) {
      throw new Error('Invitation not found or is no longer pending');
    }

    const [updated] = await db
      .update(tenantInvitations)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.invitationId, invitationId),
        ),
      )
      .returning();

    return updated;
  }

  /**
   * Update user status (activate/deactivate).
   */
  static async updateUserStatus(tenantId: string, userId: string, isActive: boolean) {
    const [updated] = await db
      .update(tenantUsers)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .returning();

    if (!updated) {
      throw new Error('User not found');
    }

    return updated;
  }

  /**
   * Update user profile fields (name, title, department, etc.).
   */
  static async updateUserProfile(tenantId: string, userId: string, data: UpdateUserProfileInput) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;

    // `name` / `title` / `department` are not columns on `tenant_users`; map `name` → first/last when needed
    if (data.name !== undefined && data.firstName === undefined && data.lastName === undefined) {
      const trimmed = data.name.trim();
      const i = trimmed.indexOf(' ');
      if (i === -1) {
        updateData.firstName = trimmed;
      } else {
        updateData.firstName = trimmed.slice(0, i);
        updateData.lastName = trimmed.slice(i + 1).trim();
      }
    }

    const [updated] = await db
      .update(tenantUsers)
      .set(updateData)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .returning();

    if (!updated) {
      throw new Error('User not found');
    }

    snsSqsPublisher.publishUserEventToSuite('user.updated', tenantId, userId, {
      userId,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      isActive: updated.isActive,
    }).catch((err: Error) => {
      Logger.log('warning', 'users', 'update-user-profile', 'Failed to publish user.updated event', { userId, error: err.message });
    });

    return updated;
  }

  /**
   * Remove a user from the tenant entirely. Deactivates memberships and role assignments.
   * Uses a transaction for atomicity.
   */
  static async removeUser(tenantId: string, userId: string) {
    return db.transaction(async (tx) => {
      // Verify user exists in tenant
      const [user] = await tx
        .select({ userId: tenantUsers.userId, isTenantAdmin: tenantUsers.isTenantAdmin })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      if (user.isTenantAdmin) {
        throw new Error('Cannot remove the tenant admin. Transfer admin rights first.');
      }

      // Deactivate role assignments — scoped to this tenant's roles only
      await tx
        .update(userRoleAssignments)
        .set({ isActive: false, deactivatedAt: new Date() })
        .where(and(
          eq(userRoleAssignments.userId, userId),
          inArray(
            userRoleAssignments.roleId,
            db.select({ roleId: customRoles.roleId })
              .from(customRoles)
              .where(eq(customRoles.tenantId, tenantId))
          )
        ));

      // Deactivate memberships
      await tx
        .update(organizationMemberships)
        .set({ membershipStatus: 'inactive', updatedAt: new Date() })
        .where(
          and(
            eq(organizationMemberships.tenantId, tenantId),
            eq(organizationMemberships.userId, userId),
          ),
        );

      // Deactivate the user
      const [removed] = await tx
        .update(tenantUsers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
        .returning();

      return removed;
    });
  }

  /**
   * Get role assignments for a user.
   */
  static async getUserRoles(tenantId: string, userId: string) {
    // Verify user belongs to tenant
    const [user] = await db
      .select({ userId: tenantUsers.userId })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .limit(1);

    if (!user) {
      throw new Error('User not found in this tenant');
    }

    const roles = await db
      .select({
        assignmentId: userRoleAssignments.id,
        roleId: userRoleAssignments.roleId,
        organizationId: userRoleAssignments.organizationId,
        scope: userRoleAssignments.scope,
        isTemporary: userRoleAssignments.isTemporary,
        expiresAt: userRoleAssignments.expiresAt,
        isActive: userRoleAssignments.isActive,
        assignedAt: userRoleAssignments.assignedAt,
        assignedBy: userRoleAssignments.assignedBy,
        roleName: customRoles.roleName,
        roleColor: customRoles.color,
        roleDescription: customRoles.description,
        isSystemRole: customRoles.isSystemRole,
        priority: customRoles.priority,
        // Scoped to an entity OR tenant id stored as organization_id (schema FK points at tenants)
        organizationName: sql<string | null>`COALESCE(${entities.entityName}, ${tenants.companyName})`.as(
          'organizationName',
        ),
      })
      .from(userRoleAssignments)
      .innerJoin(customRoles, and(
        eq(customRoles.roleId, userRoleAssignments.roleId),
        eq(customRoles.tenantId, tenantId)
      ))
      .leftJoin(entities, eq(entities.entityId, userRoleAssignments.organizationId))
      .leftJoin(tenants, eq(tenants.tenantId, userRoleAssignments.organizationId))
      .where(and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.isActive, true)));

    return roles;
  }

  /**
   * Assign a role to a user.
   *
   * **Tenant-level roles (product contract):** Effective permissions come from
   * `getUserPermissions()`, which aggregates all active `user_role_assignments` for the user
   * joined to `custom_roles` by `tenantId` — it does **not** filter by `organizationId`.
   * So org-scoped rows would still grant tenant-wide API access. To stay consistent, this API
   * always stores assignments as **tenant-wide**: `organization_id` / `location_id` null and
   * `scope` `global`. Callers must not use `organizationId` for access control here; use
   * `organization_memberships` for org structure. Legacy org-scoped rows may still exist in DB.
   */
  static async assignRole(tenantId: string, data: AssignRoleInput) {
    const { userId, roleId, assignedBy, isTemporary, expiresAt } = data;

    // Verify user belongs to tenant
    const [user] = await db
      .select({ userId: tenantUsers.userId })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
      .limit(1);

    if (!user) {
      throw new Error('User not found in this tenant');
    }

    // Verify role belongs to tenant
    const [role] = await db
      .select({ roleId: customRoles.roleId })
      .from(customRoles)
      .where(and(eq(customRoles.tenantId, tenantId), eq(customRoles.roleId, roleId)))
      .limit(1);

    if (!role) {
      throw new Error('Role not found in this tenant');
    }

    // Check for duplicate active assignment
    const [existing] = await db
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, roleId),
          eq(userRoleAssignments.isActive, true),
        ),
      )
      .limit(1);

    if (existing) {
      throw new Error('User already has this role assigned');
    }

    await UserManagementService.assertSingleOrganizationAdminSlotAvailable(tenantId, roleId);

    const [assignment] = await db
      .insert(userRoleAssignments)
      .values({
        userId,
        roleId,
        organizationId: null,
        locationId: null,
        scope: 'global',
        assignedBy,
        isTemporary: isTemporary ?? false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      })
      .returning();

    snsSqsPublisher.publishUserEventToSuite('user.role.assigned', tenantId, userId, {
      userId,
      roleId,
      assignmentId: assignment.id,
      assignedBy,
      isTemporary: isTemporary ?? false,
      expiresAt: expiresAt ?? null,
    }).catch((err: Error) => {
      Logger.log('warning', 'users', 'assign-role', 'Failed to publish user.role.assigned event', { userId, roleId, error: err.message });
    });

    return assignment;
  }

  /**
   * Remove a role assignment.
   */
  static async removeRoleAssignment(tenantId: string, assignmentId: string) {
    // Verify the assignment belongs to a user in this tenant via JOIN
    const [assignment] = await db
      .select({
        id: userRoleAssignments.id,
        userId: userRoleAssignments.userId,
      })
      .from(userRoleAssignments)
      .innerJoin(tenantUsers, eq(tenantUsers.userId, userRoleAssignments.userId))
      .where(
        and(
          eq(userRoleAssignments.id, assignmentId),
          eq(tenantUsers.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new Error('Role assignment not found');
    }

    const [removed] = await db
      .update(userRoleAssignments)
      .set({ isActive: false, deactivatedAt: new Date() })
      .where(eq(userRoleAssignments.id, assignmentId))
      .returning();

    snsSqsPublisher.publishUserEventToSuite('user.role.removed', tenantId, assignment.userId, {
      userId: assignment.userId,
      roleId: removed.roleId,
      assignmentId,
    }).catch((err: Error) => {
      Logger.log('warning', 'users', 'remove-role-assignment', 'Failed to publish user.role.removed event', { assignmentId, error: err.message });
    });

    return removed;
  }

  /**
   * Remove a single organization/entity membership from a user (not the primary assignment).
   */
  static async removeOrganizationMembership(
    tenantId: string,
    targetUserId: string,
    membershipId: string,
    options?: { deletedByInternalUserId?: string | null },
  ) {
    const [membershipData] = await db
      .select({
        membership: organizationMemberships,
        entityName: entities.entityName,
      })
      .from(organizationMemberships)
      .innerJoin(entities, eq(organizationMemberships.entityId, entities.entityId))
      .where(
        and(
          eq(organizationMemberships.membershipId, membershipId),
          eq(organizationMemberships.userId, targetUserId),
          eq(organizationMemberships.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!membershipData) {
      throw new Error('Organization membership not found');
    }

    const membership = membershipData.membership;

    if (membership.isPrimary) {
      throw new Error('Cannot remove primary organization');
    }

    const entityId = membership.entityId;

    await db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.membershipId, membershipId));

    if (options?.deletedByInternalUserId) {
      try {
        const { OrganizationAssignmentService } = await import(
          '../../organizations/services/organization-assignment-service.js'
        );
        await OrganizationAssignmentService.publishOrgAssignmentDeleted({
          tenantId,
          userId: targetUserId,
          organizationId: entityId,
          assignmentId: membershipId,
          deletedBy: options.deletedByInternalUserId,
          reason: 'user_removed',
        });
      } catch {
        // non-critical
      }
    }

    return { membershipId, entityId };
  }

  /**
   * Get available roles for a tenant (for dropdowns).
   */
  static async getAvailableRoles(tenantId: string) {
    const roles = await db
      .select({
        roleId: customRoles.roleId,
        roleName: customRoles.roleName,
        description: customRoles.description,
        color: customRoles.color,
        isSystemRole: customRoles.isSystemRole,
        isDefault: customRoles.isDefault,
        priority: customRoles.priority,
        scope: customRoles.scope,
      })
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId))
      .orderBy(asc(customRoles.priority), asc(customRoles.roleName));

    return roles;
  }

  /**
   * Get user stats: total active, total invited, total inactive.
   */
  static async getUserStats(tenantId: string) {
    const [activeResult, inactiveResult, invitedResult] = await Promise.all([
      db
        .select({ total: count() })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, true))),

      db
        .select({ total: count() })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, false))),

      db
        .select({ total: count() })
        .from(tenantInvitations)
        .where(
          and(
            eq(tenantInvitations.tenantId, tenantId),
            eq(tenantInvitations.status, 'pending'),
          ),
        ),
    ]);

    return {
      active: Number(activeResult[0]?.total ?? 0),
      inactive: Number(inactiveResult[0]?.total ?? 0),
      invited: Number(invitedResult[0]?.total ?? 0),
      total:
        Number(activeResult[0]?.total ?? 0) +
        Number(inactiveResult[0]?.total ?? 0) +
        Number(invitedResult[0]?.total ?? 0),
    };
  }
}
