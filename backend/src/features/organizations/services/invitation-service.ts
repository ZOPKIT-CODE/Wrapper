import { db, dbManager } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments, tenantInvitations, organizationMemberships, entities } from '../../../db/schema/index.js';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { invalidateRoleCache, invalidateUserCache } from '../../../middleware/auth/auth.js';
import type { FastifyRequest } from 'fastify';
import Logger from '../../../utils/logger.js';

// ---------------------------------------------------------------------------
// ServiceError — thrown by service functions to signal an HTTP error response
// ---------------------------------------------------------------------------
export class ServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: Record<string, unknown>
  ) {
    super(String(body.error ?? 'ServiceError'));
    this.name = 'ServiceError';
  }
}

// ---------------------------------------------------------------------------
// Low-level helpers (also exported for direct use when needed)
// ---------------------------------------------------------------------------

// Ensure the user is associated with the correct organization.
//
// Org membership now lives natively in the Wrapper DB (organization_memberships /
// userRoleAssignments, written during invitation acceptance), so this is no longer a Kinde
// one-way sync. The Wrapper DB is the source of truth, so this is a no-op that reports success.
// Kept as an exported helper so existing callers keep compiling.
export async function ensureUserInCorrectOrganization(
  _kindeUserId: string,
  _email: string,
  targetOrgCode: string
): Promise<{ success: boolean; targetOrg: string; error?: string }> {
  return { success: true, targetOrg: targetOrgCode };
}

// Permission validation helper for multi-entity invitations
export async function validateMultiEntityInvitationPermissions(
  inviterId: string,
  tenantId: string,
  targetEntities: Array<{ entityId: string; roleId?: string | null; entityType?: string | null; membershipType?: string }>
) {
  Logger.log('info', 'user', 'validate-multi-entity-invitation-permissions', 'Validating permissions for multi-entity invitation', {
    inviterId,
    tenantId,
    targetEntityCount: targetEntities.length
  });

  // Check if user is active and belongs to the tenant
  const [inviter] = await db
    .select()
    .from(tenantUsers)
    .where(and(
      eq(tenantUsers.userId, inviterId),
      eq(tenantUsers.tenantId, tenantId),
      eq(tenantUsers.isActive, true)
    ))
    .limit(1);

  if (!inviter) {
    throw new Error('Inviter not found or not active in this tenant');
  }

  // Check if user is a tenant admin (can invite to any entity)
  if (inviter.isTenantAdmin) {
    Logger.log('info', 'user', 'validate-multi-entity-invitation-permissions', 'Inviter is tenant admin - all permissions granted');
    return { canInvite: true, restrictions: [] };
  }

  const restrictions = [];
  const allowedEntities = [];

  // Get all entities the inviter has membership in with admin/manager access
  const inviterMemberships = await db
    .select({
      membership: organizationMemberships,
      entity: entities
    })
    .from(organizationMemberships)
    .leftJoin(entities, eq(organizationMemberships.entityId, entities.entityId))
    .where(and(
      eq(organizationMemberships.userId, inviterId),
      eq(organizationMemberships.membershipStatus, 'active'),
      eq(organizationMemberships.tenantId, tenantId)
    ));

  Logger.log('info', 'user', 'validate-multi-entity-invitation-permissions', 'Inviter memberships found', { count: inviterMemberships.length });

  // Check permissions for each target entity
  for (const targetEntity of targetEntities) {
    let canInviteToEntity = false;

    // Check if inviter has admin/manager access to this entity or its parents
    for (const membership of inviterMemberships) {
      if (membership.membership.accessLevel === 'admin' ||
          membership.membership.accessLevel === 'manager') {

        // Direct membership to the entity
        if (membership.membership.entityId === targetEntity.entityId) {
          canInviteToEntity = true;
          break;
        }

        // Check if membership is to a parent entity and canAccessSubEntities is true
        if (membership.membership.canAccessSubEntities && membership.entity) {
          // Check if target entity is under this entity's hierarchy
          // This is a simplified check - in production you'd want more sophisticated hierarchy checking
          const targetEntityRecord = await db
            .select()
            .from(entities)
            .where(eq(entities.entityId, targetEntity.entityId))
            .limit(1);

          if (targetEntityRecord[0] &&
              targetEntityRecord[0].hierarchyPath?.includes(membership.membership.entityId)) {
            canInviteToEntity = true;
            break;
          }
        }
      }
    }

    if (canInviteToEntity) {
      allowedEntities.push(targetEntity);
    } else {
      restrictions.push({
        entityId: targetEntity.entityId,
        reason: 'Insufficient permissions to invite to this entity'
      });
    }
  }

  const canInvite = restrictions.length === 0;

  Logger.log('info', 'user', 'validate-multi-entity-invitation-permissions', 'Permission validation result', {
    canInvite,
    allowedEntities: allowedEntities.length,
    restrictions: restrictions.length
  });

  return {
    canInvite,
    restrictions,
    allowedEntities
  };
}

// Helper function to generate proper invitation URLs
export async function generateInvitationUrl(
  invitationToken: string,
  request: FastifyRequest | null,
  tenantId: string | null = null
): Promise<string> {
  // CRITICAL: In development, always prioritize localhost first
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Priority 1: In development, check request origin first (most reliable for local testing)
  if (isDevelopment && request) {
    const origin = request?.headers?.origin || request?.headers?.referer;
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      try {
        const url = new URL(origin);
        const baseUrl = `${url.protocol}//${url.host}`;
        const invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;
        Logger.log('info', 'email', 'generate-invitation-url', 'Generated invitation URL using request origin (development)', { invitationUrl });
        return invitationUrl;
      } catch (_e) {
        Logger.log('warning', 'email', 'generate-invitation-url', 'Invalid origin URL, continuing with other methods', { origin });
      }
    }
  }

  // Priority 2: Use tenant subdomain in production
  if (!isDevelopment && tenantId) {
    try {
      const [tenant] = await db
        .select({
          subdomain: tenants.subdomain
        })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant?.subdomain) {
        const baseDomain = process.env.BASE_DOMAIN || 'myapp.com';
        const protocol = process.env.PROTOCOL || 'https';
        const baseUrl = `${protocol}://${tenant.subdomain}.${baseDomain}`;
        const invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;
        Logger.log('info', 'email', 'generate-invitation-url', 'Generated invitation URL using tenant subdomain', { invitationUrl });
        return invitationUrl;
      }
    } catch (err) {
      const error = err as Error;
      Logger.log('warning', 'email', 'generate-invitation-url', 'Failed to get tenant subdomain, falling back to other methods', { error: error.message });
    }
  }

  // Priority 3: In development, force localhost
  if (isDevelopment) {
    const baseUrl = 'http://localhost:3001';
    const invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;
    Logger.log('info', 'email', 'generate-invitation-url', 'Generated invitation URL for development (localhost)', { invitationUrl });
    return invitationUrl;
  }

  // Priority 4: Use INVITATION_BASE_URL if set (for production)
  let baseUrl = process.env.INVITATION_BASE_URL;

  // Priority 5: Use FRONTEND_URL if INVITATION_BASE_URL not set (for production)
  if (!baseUrl) {
    baseUrl = process.env.FRONTEND_URL;
  }

  // Priority 6: Use sensible defaults based on environment
  if (!baseUrl) {
    if (isDevelopment) {
      baseUrl = 'http://localhost:3001';
      Logger.log('warning', 'email', 'generate-invitation-url', 'No base URL found, using development default', { baseUrl });
    } else {
      baseUrl = process.env.BASE_URL || 'https://zopkit.com';
      Logger.log('warning', 'email', 'generate-invitation-url', 'No base URL found, using production default', { baseUrl });
    }
  }

  // Generate the full invitation URL
  const invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;

  // Ensure we always have a valid URL
  if (!invitationUrl || !invitationUrl.startsWith('http')) {
    Logger.log('error', 'email', 'generate-invitation-url', 'Invalid invitation URL generated', {
      baseUrl,
      invitationUrl,
      INVITATION_BASE_URL: process.env.INVITATION_BASE_URL,
      FRONTEND_URL: process.env.FRONTEND_URL,
      BASE_URL: process.env.BASE_URL,
      NODE_ENV: process.env.NODE_ENV
    });
    // Fallback to a safe default
    const fallbackUrl = isDevelopment
      ? 'http://localhost:3001'
      : 'https://zopkit.com';
    return `${fallbackUrl}/invite/accept?token=${invitationToken}`;
  }

  Logger.log('info', 'email', 'generate-invitation-url', 'Generated invitation URL', { invitationUrl });

  return invitationUrl;
}

// ---------------------------------------------------------------------------
// Service functions — one per route handler
// ---------------------------------------------------------------------------

export async function getInvitationDetails(org: string, email: string) {
  const decodedEmail = decodeURIComponent(email);
  Logger.log('info', 'email', 'get-invitation-details', 'Getting invitation details (public)', { org, email });
  Logger.log('info', 'email', 'get-invitation-details', 'Email comparison', { original: email, decoded: decodedEmail, areDifferent: email !== decodedEmail });

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      companyName: tenants.companyName,
      kindeOrgId: tenants.kindeOrgId,
      subdomain: tenants.subdomain,
      logoUrl: tenants.logoUrl,
      primaryColor: tenants.primaryColor,
      brandingConfig: tenants.brandingConfig
    })
    .from(tenants)
    .where(eq(tenants.kindeOrgId, org))
    .limit(1);

  if (!tenant) {
    Logger.log('error', 'email', 'get-invitation-details', 'Organization not found', { org });
    throw new ServiceError(404, { error: 'Organization not found' });
  }

  Logger.log('info', 'email', 'get-invitation-details', 'Found organization', {
    tenantId: tenant.tenantId,
    companyName: tenant.companyName,
    kindeOrgId: tenant.kindeOrgId
  });

  const [invitedUser] = await db
    .select()
    .from(tenantUsers)
    .where(and(
      eq(tenantUsers.email, decodedEmail),
      eq(tenantUsers.tenantId, tenant.tenantId)
    ))
    .limit(1);

  if (!invitedUser) {
    Logger.log('error', 'email', 'get-invitation-details', 'Invitation not found for email', { decodedEmail });
    throw new ServiceError(404, {
      error: 'Invitation not found',
      message: 'No invitation found for this email address'
    });
  }

  if (invitedUser.isActive) {
    throw new ServiceError(409, {
      error: 'Invitation already accepted',
      message: 'This invitation has already been accepted'
    });
  }

  const [invitationRow] = await db
    .select({ invitedBy: tenantInvitations.invitedBy })
    .from(tenantInvitations)
    .where(and(
      eq(tenantInvitations.tenantId, tenant.tenantId),
      eq(tenantInvitations.email, decodedEmail),
      eq(tenantInvitations.status, 'pending')
    ))
    .limit(1);
  const inviterIdFromInvitation = invitationRow?.invitedBy ?? invitedUser.userId;
  const [inviter] = await db
    .select({
      name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
      email: tenantUsers.email
    })
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, inviterIdFromInvitation))
    .limit(1);

  const userRoles = await db
    .select({
      roleName: customRoles.roleName
    })
    .from(userRoleAssignments)
    .leftJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
    .where(eq(userRoleAssignments.userId, invitedUser.userId));

  return {
    success: true,
    invitation: {
      email: invitedUser.email,
      organizationName: tenant.companyName,
      inviterName: inviter?.name || 'Team Member',
      roles: userRoles.map(r => r.roleName),
      orgCode: tenant.kindeOrgId
    }
  };
}

export async function getInvitationByToken(token: string) {
  Logger.log('info', 'email', 'get-invitation-by-token', 'Getting invitation by token', { token });

  const [invitation] = await db
    .select()
    .from(tenantInvitations)
    .where(and(
      eq(tenantInvitations.invitationToken, token),
      eq(tenantInvitations.status, 'pending')
    ))
    .limit(1);

  if (!invitation) {
    Logger.log('error', 'email', 'get-invitation-by-token', 'Invitation not found for token', { token });
    throw new ServiceError(404, {
      error: 'Invitation not found',
      message: 'Invalid or expired invitation token'
    });
  }

  if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
    Logger.log('error', 'email', 'get-invitation-by-token', 'Invitation expired for token', { token });
    throw new ServiceError(410, {
      error: 'Invitation expired',
      message: 'This invitation has expired'
    });
  }

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      companyName: tenants.companyName,
      kindeOrgId: tenants.kindeOrgId
    })
    .from(tenants)
    .where(eq(tenants.tenantId, invitation.tenantId))
    .limit(1);

  if (!tenant) {
    Logger.log('error', 'email', 'get-invitation-by-token', 'Organization not found for tenant', { tenantId: invitation.tenantId });
    throw new ServiceError(404, { error: 'Organization not found' });
  }

  let roleName = 'Team Member';
  if (invitation.roleId) {
    const [role] = await db
      .select()
      .from(customRoles)
      .where(eq(customRoles.roleId, invitation.roleId))
      .limit(1);
    if (role) {
      roleName = role.roleName;
    }
  }

  const [inviter] = await db
    .select()
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, invitation.invitedBy))
    .limit(1);

  Logger.log('info', 'email', 'get-invitation-by-token', 'Found invitation details', {
    invitationId: invitation.invitationId,
    email: invitation.email,
    tenantId: invitation.tenantId,
    companyName: tenant.companyName,
    roleName
  });

  return {
    success: true,
    invitation: {
      email: invitation.email,
      name: invitation.email.split('@')[0],
      organizationName: tenant.companyName,
      orgCode: tenant.kindeOrgId,
      invitationToken: invitation.invitationToken,
      invitationUrl: invitation.invitationUrl,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
      roleName: roleName,
      inviterName: [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ').trim() || inviter?.email || 'Team Administrator',
      tenantId: invitation.tenantId,
      invitationId: invitation.invitationId
    }
  };
}

export async function getAdminInvitations(orgCode: string, request: FastifyRequest) {
  Logger.log('info', 'email', 'get-admin-invitations', 'Admin getting invitations for organization', { orgCode });

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      companyName: tenants.companyName,
      kindeOrgId: tenants.kindeOrgId
    })
    .from(tenants)
    .where(eq(tenants.kindeOrgId, orgCode))
    .limit(1);

  if (!tenant) {
    throw new ServiceError(404, {
      error: 'Organization not found',
      message: `No organization found with orgCode: ${orgCode}`
    });
  }

  const invitations = await db
    .select({
      invitation: tenantInvitations,
      role: customRoles,
      inviter: tenantUsers
    })
    .from(tenantInvitations)
    .leftJoin(customRoles, eq(tenantInvitations.roleId, customRoles.roleId))
    .leftJoin(tenantUsers, eq(tenantInvitations.invitedBy, tenantUsers.userId))
    .where(eq(tenantInvitations.tenantId, tenant.tenantId))
    .orderBy(desc(tenantInvitations.createdAt));

  const formattedInvitations = await Promise.all(invitations.map(async ({ invitation, role, inviter }: { invitation: { invitationId: string; email: string; status: string | null; createdAt: Date | null; expiresAt: Date; acceptedAt: Date | null; invitationUrl: string | null; invitationToken: string }; role: { roleName?: string } | null; inviter: { firstName?: string | null; lastName?: string | null; email?: string | null } | null }) => {
    const invitationUrl = invitation.invitationUrl || await generateInvitationUrl(invitation.invitationToken, request, tenant.tenantId);

    if (!invitationUrl) {
      Logger.log('warning', 'email', 'get-admin-invitations', 'No invitation URL found for invitation, generating fallback', { invitationId: invitation.invitationId });
      const fallbackUrl = await generateInvitationUrl(invitation.invitationToken, request, tenant.tenantId);
      const expAt = invitation.expiresAt;
      return {
        invitationId: invitation.invitationId,
        email: invitation.email,
        roleName: role?.roleName || 'No role assigned',
        status: invitation.status,
        invitedBy: [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ').trim() || inviter?.email || 'Unknown',
        invitedAt: invitation.createdAt,
        expiresAt: expAt,
        acceptedAt: invitation.acceptedAt,
        invitationUrl: fallbackUrl,
        isExpired: expAt < new Date(),
        daysUntilExpiry: Math.ceil((Number(new Date(expAt)) - Number(new Date())) / (1000 * 60 * 60 * 24)),
        urlIssue: 'Generated fallback URL - original was missing'
      };
    }

    const expAt = invitation.expiresAt;
    return {
      invitationId: invitation.invitationId,
      email: invitation.email,
      roleName: role?.roleName || 'No role assigned',
      status: invitation.status,
      invitedBy: [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ').trim() || inviter?.email || 'Unknown',
      invitedAt: invitation.createdAt,
      expiresAt: expAt,
      acceptedAt: invitation.acceptedAt,
      invitationUrl: invitationUrl,
      isExpired: expAt < new Date(),
      daysUntilExpiry: Math.ceil((Number(new Date(expAt)) - Number(new Date())) / (1000 * 60 * 60 * 24))
    };
  }));

  Logger.log('info', 'email', 'get-admin-invitations', 'Found invitations for organization', { count: formattedInvitations.length, companyName: tenant.companyName });

  return {
    success: true,
    organization: {
      tenantId: tenant.tenantId,
      companyName: tenant.companyName,
      kindeOrgId: tenant.kindeOrgId
    },
    invitations: formattedInvitations,
    summary: {
      total: formattedInvitations.length,
      pending: formattedInvitations.filter(inv => inv.status === 'pending' && !inv.isExpired).length,
      accepted: formattedInvitations.filter(inv => inv.status === 'accepted').length,
      expired: formattedInvitations.filter(inv => inv.isExpired).length
    }
  };
}

export async function resendInvitationEmail(orgCode: string, invitationId: string, request: FastifyRequest) {
  Logger.log('info', 'email', 'resend-invitation-email', 'Admin resending invitation', { orgCode, invitationId });

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      companyName: tenants.companyName,
      kindeOrgId: tenants.kindeOrgId
    })
    .from(tenants)
    .where(eq(tenants.kindeOrgId, orgCode))
    .limit(1);

  if (!tenant) {
    throw new ServiceError(404, {
      error: 'Organization not found',
      message: `No organization found with orgCode: ${orgCode}`
    });
  }

  const [invitation] = await db
    .select({
      invitation: tenantInvitations,
      role: customRoles,
      inviter: tenantUsers
    })
    .from(tenantInvitations)
    .leftJoin(customRoles, eq(tenantInvitations.roleId, customRoles.roleId))
    .leftJoin(tenantUsers, eq(tenantInvitations.invitedBy, tenantUsers.userId))
    .where(and(
      eq(tenantInvitations.invitationId, invitationId),
      eq(tenantInvitations.tenantId, tenant.tenantId)
    ))
    .limit(1);

  if (!invitation) {
    throw new ServiceError(404, {
      error: 'Invitation not found',
      message: 'Invitation not found in this organization'
    });
  }

  if (invitation.invitation.status === 'accepted') {
    throw new ServiceError(400, {
      error: 'Invitation already accepted',
      message: 'Cannot resend an accepted invitation'
    });
  }

  if (invitation.invitation.expiresAt < new Date()) {
    throw new ServiceError(400, {
      error: 'Invitation expired',
      message: 'Cannot resend an expired invitation'
    });
  }

  const EmailService = (await import('../../../utils/email.js')).default;
  const invitationUrl = await generateInvitationUrl(invitation.invitation.invitationToken, request, tenant.tenantId);

  const organizations = [];
  const locations = [];
  let roleName = invitation.role?.roleName || 'Member';

  const targetEntitiesList = (invitation.invitation.targetEntities ?? []) as Array<{ entityId: string; roleId?: string | null }>;
  if (invitation.invitation.invitationScope === 'multi-entity' && targetEntitiesList.length > 0) {
    const roleNames = [];
    for (const targetEntity of targetEntitiesList) {
      const [entityRecord] = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType
        })
        .from(entities)
        .where(eq(entities.entityId, targetEntity.entityId))
        .limit(1);

      const [roleRecord] = await db
        .select({
          roleName: customRoles.roleName
        })
        .from(customRoles)
        .where(eq(customRoles.roleId, targetEntity.roleId as string))
        .limit(1);

      if (entityRecord) {
        const entityRoleName = roleRecord?.roleName || 'Member';
        roleNames.push(entityRoleName);

        if (entityRecord.entityType === 'organization') {
          organizations.push(entityRecord.entityName);
        } else if (entityRecord.entityType === 'location') {
          locations.push(entityRecord.entityName);
        }
      }
    }
    roleName = roleNames.length > 0
      ? (roleNames.length === 1 ? roleNames[0] : `${roleNames[0]} (${roleNames.length} roles)`)
      : 'Team Member';
  } else if (invitation.invitation.primaryEntityId) {
    const [entityRecord] = await db
      .select({
        entityName: entities.entityName,
        entityType: entities.entityType
      })
      .from(entities)
      .where(eq(entities.entityId, invitation.invitation.primaryEntityId))
      .limit(1);

    if (entityRecord) {
      if (entityRecord.entityType === 'organization') {
        organizations.push(entityRecord.entityName);
      } else if (entityRecord.entityType === 'location') {
        locations.push(entityRecord.entityName);
      }
    }
  }

  const emailOrganizations = organizations.length > 0 ? organizations : [tenant.companyName];
  const emailLocations = locations.length > 0 ? locations : undefined;

  await EmailService.sendUserInvitation({
    email: invitation.invitation.email,
    tenantName: tenant.companyName,
    roleName,
    invitationToken: invitationUrl, // Pass full URL instead of token
    invitedByName: [invitation.inviter?.firstName, invitation.inviter?.lastName].filter(Boolean).join(' ').trim() || invitation.inviter?.email || 'Team Administrator',
    message: 'Your invitation has been resent by an administrator.',
    organizations: emailOrganizations,
    locations: emailLocations,
    invitedDate: invitation.invitation.createdAt ?? undefined,
    expiryDate: invitation.invitation.expiresAt ?? undefined
  });

  Logger.log('info', 'email', 'resend-invitation-email', 'Invitation email resent successfully', { email: invitation.invitation.email });

  return {
    success: true,
    message: 'Invitation email resent successfully',
    email: invitation.invitation.email
  };
}

export async function cancelInvitation(orgCode: string, invitationId: string) {
  Logger.log('info', 'email', 'cancel-invitation', 'Admin canceling invitation', { orgCode, invitationId });

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      companyName: tenants.companyName,
      kindeOrgId: tenants.kindeOrgId
    })
    .from(tenants)
    .where(eq(tenants.kindeOrgId, orgCode))
    .limit(1);

  if (!tenant) {
    throw new ServiceError(404, {
      error: 'Organization not found',
      message: `No organization found with orgCode: ${orgCode}`
    });
  }

  const [updatedInvitation] = await db
    .update(tenantInvitations)
    .set({
      status: 'cancelled',
      updatedAt: new Date()
    })
    .where(and(
      eq(tenantInvitations.invitationId, invitationId),
      eq(tenantInvitations.tenantId, tenant.tenantId)
    ))
    .returning();

  if (!updatedInvitation) {
    throw new ServiceError(404, {
      error: 'Invitation not found',
      message: 'Invitation not found in this organization'
    });
  }

  Logger.log('info', 'email', 'cancel-invitation', 'Invitation cancelled successfully', { invitationId });

  return {
    success: true,
    message: 'Invitation cancelled successfully',
    invitation: {
      invitationId: updatedInvitation.invitationId,
      email: updatedInvitation.email,
      status: updatedInvitation.status
    }
  };
}

export interface CreateInvitationParams {
  email: string;
  roleName: string;
  tenantId: string;
  inviterContext: {
    internalUserId?: string;
    userId?: string;
    kindeUserId?: string;
    name?: string;
  };
  message?: string;
  request: FastifyRequest;
}

export async function createInvitation(params: CreateInvitationParams) {
  const { email, roleName, tenantId, inviterContext, message, request } = params;

  Logger.log('info', 'email', 'create-invitation', 'Creating invitation for current tenant', { email, roleName, tenantId });

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      companyName: tenants.companyName,
      kindeOrgId: tenants.kindeOrgId
    })
    .from(tenants)
    .where(eq(tenants.tenantId, tenantId))
    .limit(1);

  if (!tenant) {
    throw new ServiceError(404, {
      error: 'Organization not found',
      message: "Current user's organization not found"
    });
  }

  const [existingInvitation] = await db
    .select()
    .from(tenantInvitations)
    .where(and(
      eq(tenantInvitations.tenantId, tenant.tenantId),
      eq(tenantInvitations.email, email)
    ))
    .limit(1);

  if (existingInvitation) {
    throw new ServiceError(409, {
      error: 'Invitation already exists',
      message: `An invitation for ${email} already exists in this organization`,
      invitation: existingInvitation
    });
  }

  const invitationToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const invitationUrl = await generateInvitationUrl(invitationToken, request, tenant.tenantId);

  let invitedByUserId: string | undefined = inviterContext.internalUserId || inviterContext.userId;
  if (!invitedByUserId) {
    const [inviterUser] = await db
      .select({ userId: tenantUsers.userId })
      .from(tenantUsers)
      .where(eq(tenantUsers.kindeUserId, inviterContext.kindeUserId ?? ''))
      .limit(1);
    if (!inviterUser) {
      throw new ServiceError(400, {
        error: 'Inviter not found',
        message: 'Unable to find inviter user record'
      });
    }
    invitedByUserId = inviterUser.userId;
  }

  const { newInvitation, role } = await db.transaction(async (tx) => {
    let [existingRole] = await tx
      .select()
      .from(customRoles)
      .where(and(
        eq(customRoles.tenantId, tenant.tenantId),
        eq(customRoles.roleName, roleName)
      ))
      .limit(1);

    if (!existingRole) {
      const [newRole] = await tx.insert(customRoles).values({
        tenantId: tenant.tenantId,
        roleName: roleName,
        description: `Default ${roleName} role`,
        permissions: { read: true, write: false, admin: false },
        restrictions: {},
        isSystemRole: false,
        isDefault: false,
        priority: 50
      } as any).returning();
      existingRole = newRole;
    }

    const [inv] = await tx.insert(tenantInvitations).values({
      tenantId: tenant.tenantId,
      email: email,
      invitationToken: invitationToken,
      invitationUrl: invitationUrl,
      status: 'pending',
      expiresAt: expiresAt,
      invitedBy: invitedByUserId!,
      roleId: existingRole.roleId
    } as any).returning();

    return { newInvitation: inv, role: existingRole };
  });

  Logger.log('info', 'email', 'create-invitation', 'Invitation created successfully', {
    invitationId: newInvitation.invitationId,
    email: newInvitation.email,
    invitedBy: newInvitation.invitedBy,
    roleId: newInvitation.roleId,
    urlStored: !!newInvitation.invitationUrl
  });

  try {
    const EmailService = (await import('../../../utils/email.js')).default;
    await EmailService.sendUserInvitation({
      email: newInvitation.email,
      tenantName: tenant.companyName,
      roleName: role.roleName,
      invitationToken: invitationUrl, // Pass full URL instead of token
      invitedByName: inviterContext.name || 'Team Administrator',
      message: message || `You've been invited to join ${tenant.companyName} as a ${role.roleName}.`,
      organizations: [tenant.companyName],
      invitedDate: new Date(),
      expiryDate: expiresAt ?? undefined
    });
    Logger.log('info', 'email', 'create-invitation', 'Invitation email sent successfully', { email: newInvitation.email });
  } catch (err) {
    const emailError = err as Error;
    Logger.log('error', 'email', 'create-invitation', 'Failed to send invitation email', { email: newInvitation.email, error: emailError.message });
    // Don't fail the invitation creation if email fails
    Logger.log('warning', 'email', 'create-invitation', 'Invitation created but email failed', { invitationToken: newInvitation.invitationToken });
  }

  return {
    success: true,
    message: 'Invitation created successfully',
    invitation: {
      invitationId: newInvitation.invitationId,
      email: newInvitation.email,
      token: newInvitation.invitationToken,
      url: newInvitation.invitationUrl,
      expiresAt: newInvitation.expiresAt,
      roleName: role.roleName
    }
  };
}

export interface CreateMultiEntityInvitationParams {
  email: string;
  targetEntities: Array<{ entityId: string; roleId: string; membershipType?: string }>;
  primaryEntityId?: string;
  message?: string;
  tenantId: string;
  inviterInternalUserId: string;
  inviterName?: string;
  request: FastifyRequest;
}

export async function createMultiEntityInvitation(params: CreateMultiEntityInvitationParams) {
  const { email, targetEntities: rawTargetEntities, primaryEntityId, message, tenantId, inviterInternalUserId, inviterName, request } = params;

  Logger.log('info', 'email', 'create-multi-entity-invitation', 'Creating multi-entity invitation', {
    email,
    entityCount: rawTargetEntities?.length || 0,
    primaryEntityId,
    tenantId,
    entitiesType: Array.isArray(rawTargetEntities) ? 'array' : typeof rawTargetEntities,
  });

  Logger.log('info', 'email', 'create-multi-entity-invitation', 'Querying tenant', { tenantId });
  let tenant;
  try {
    const query = db
      .select({
        tenantId: tenants.tenantId,
        companyName: tenants.companyName,
        kindeOrgId: tenants.kindeOrgId
      })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);

    Logger.log('info', 'email', 'create-multi-entity-invitation', 'Executing tenant query');
    const [tenantRecord] = await query;
    tenant = tenantRecord;
    Logger.log('info', 'email', 'create-multi-entity-invitation', 'Tenant query successful', { tenantId: tenant?.tenantId });

    if (!tenant) {
      throw new ServiceError(404, {
        error: 'Organization not found',
        message: "Current user's organization not found"
      });
    }
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    const error = err as Error;
    Logger.log('error', 'email', 'create-multi-entity-invitation', 'Tenant query failed', { error: error.message });
    throw error;
  }

  const validatedEntities = [];
  for (const entity of rawTargetEntities) {
    if (!entity.entityId || !entity.roleId) {
      throw new ServiceError(400, {
        error: 'Invalid entity specification',
        message: 'Each entity must have entityId and roleId'
      });
    }

    Logger.log('info', 'email', 'create-multi-entity-invitation', 'Verifying entity', { entityId: entity.entityId, tenantId });
    let entityRecord;
    try {
      const entityQuery = db
        .select()
        .from(entities)
        .where(and(
          eq(entities.entityId, entity.entityId),
          eq(entities.tenantId, tenantId)
        ))
        .limit(1);

      Logger.log('info', 'email', 'create-multi-entity-invitation', 'Executing entity verification query');
      [entityRecord] = await entityQuery;
      Logger.log('info', 'email', 'create-multi-entity-invitation', 'Entity verification successful', { entityId: entityRecord?.entityId });

      if (!entityRecord) {
        throw new ServiceError(404, {
          error: 'Entity not found',
          message: `Entity ${entity.entityId} not found in this tenant`
        });
      }
    } catch (err) {
      if (err instanceof ServiceError) throw err;
      const error = err as Error;
      Logger.log('error', 'email', 'create-multi-entity-invitation', 'Entity verification failed', { entityId: entity.entityId, tenantId, error: error.message });
      throw error;
    }

    const [roleRecord] = await db
      .select()
      .from(customRoles)
      .where(eq(customRoles.roleId, entity.roleId))
      .limit(1);

    if (!roleRecord) {
      throw new ServiceError(404, {
        error: 'Role not found',
        message: `Role ${entity.roleId} not found`
      });
    }

    const permissionCheck = await validateMultiEntityInvitationPermissions(
      inviterInternalUserId,
      tenant.tenantId,
      [{
        entityId: entity.entityId,
        roleId: entity.roleId,
        entityType: entityRecord.entityType
      }]
    );

    if (!permissionCheck.canInvite) {
      throw new ServiceError(403, {
        error: 'Insufficient permissions',
        message: `You don't have permission to invite users to ${entityRecord.entityName}`,
        restrictions: permissionCheck.restrictions
      });
    }

    validatedEntities.push({
      entityId: entity.entityId,
      roleId: entity.roleId,
      entityType: entityRecord.entityType,
      membershipType: entity.membershipType || 'direct'
    });
  }

  if (primaryEntityId) {
    const isPrimaryValid = validatedEntities.some(e => e.entityId === primaryEntityId);
    if (!isPrimaryValid) {
      throw new ServiceError(400, {
        error: 'Invalid primary entity',
        message: 'Primary entity must be one of the target entities'
      });
    }
  }

  if (validatedEntities.length === 0) {
    throw new ServiceError(400, {
      error: 'No valid entities',
      message: 'At least one valid entity must be specified'
    });
  }

  const [existingInvitation] = await db
    .select()
    .from(tenantInvitations)
    .where(and(
      eq(tenantInvitations.tenantId, tenant.tenantId),
      eq(tenantInvitations.email, email)
    ))
    .limit(1);

  if (existingInvitation) {
    throw new ServiceError(409, {
      error: 'Invitation already exists',
      message: `An invitation for ${email} already exists in this organization`,
      invitation: existingInvitation
    });
  }

  const invitationToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const invitationUrl = await generateInvitationUrl(invitationToken, request, tenant.tenantId);

  if (!invitationUrl || !invitationUrl.startsWith('http')) {
    Logger.log('error', 'email', 'create-multi-entity-invitation', 'Invalid invitation URL generated', { invitationUrl });
    throw new ServiceError(500, {
      error: 'Failed to generate invitation URL',
      message: 'Could not generate a valid invitation URL'
    });
  }

  Logger.log('info', 'email', 'create-multi-entity-invitation', 'Generated invitation URL', { email });

  const finalPrimaryEntityId = primaryEntityId || validatedEntities[0]?.entityId;
  if (!finalPrimaryEntityId) {
    throw new ServiceError(400, {
      error: 'Invalid primary entity',
      message: 'Unable to determine primary entity ID'
    });
  }

  const dbConnection = dbManager.getAppConnection();
  const escapedInvitationUrl = invitationUrl.replace(/'/g, "''").replace(/\\/g, '\\\\');

  const insertQuery = `
    INSERT INTO tenant_invitations (
      tenant_id, email, invitation_scope, primary_entity_id,
      invited_by, invitation_token, invitation_url, status, expires_at, updated_at
    ) VALUES (
      '${tenant.tenantId}', '${email}', 'multi-entity',
      '${finalPrimaryEntityId}', '${inviterInternalUserId}', '${invitationToken}',
      '${escapedInvitationUrl}', 'pending', '${expiresAt.toISOString()}', '${new Date().toISOString()}'
    )
    RETURNING invitation_id, invitation_url
  `;

  Logger.log('info', 'email', 'create-multi-entity-invitation', 'Step 1 - Inserting base invitation with URL', { email, hasUrl: !!invitationUrl });

  const insertResult = await dbConnection.unsafe(insertQuery);
  const invitationId = insertResult[0].invitation_id;
  const storedUrl = insertResult[0].invitation_url;

  Logger.log('info', 'email', 'create-multi-entity-invitation', 'Base invitation inserted', { invitationId, urlMatches: storedUrl === invitationUrl });

  const targetEntitiesJson = JSON.stringify(validatedEntities).replace(/'/g, "''").replace(/\\/g, '\\\\');
  const updateQuery = `
    UPDATE tenant_invitations
    SET target_entities = '${targetEntitiesJson}'::jsonb
    WHERE invitation_id = '${invitationId}'
    RETURNING *
  `;

  Logger.log('info', 'email', 'create-multi-entity-invitation', 'Step 2 - Updating with JSONB');

  const updateResult = await dbConnection.unsafe(updateQuery);
  const newInvitation = updateResult[0];

  if (!newInvitation.invitation_url) {
    Logger.log('error', 'email', 'create-multi-entity-invitation', 'WARNING: Invitation URL was not stored! Attempting to update');
    const urlUpdateQuery = `
      UPDATE tenant_invitations
      SET invitation_url = '${escapedInvitationUrl}'
      WHERE invitation_id = '${invitationId}'
      RETURNING invitation_url
    `;
    const urlUpdateResult = await dbConnection.unsafe(urlUpdateQuery);
    newInvitation.invitation_url = urlUpdateResult[0]?.invitation_url || invitationUrl;
    Logger.log('info', 'email', 'create-multi-entity-invitation', 'URL update result', { success: !!newInvitation.invitation_url });
  }

  Logger.log('info', 'email', 'create-multi-entity-invitation', 'Multi-entity invitation created successfully', {
    invitationId: newInvitation.invitation_id,
    email: newInvitation.email,
    targetEntities: validatedEntities.length
  });

  Logger.log('info', 'email', 'create-multi-entity-invitation', 'Preparing to send multi-entity invitation email', { email: newInvitation.email });
  try {
    const EmailService = (await import('../../../utils/email.js')).default;

    const organizations = [];
    const locations = [];
    const roleNames = [];

    for (const entity of validatedEntities) {
      const [entityRecord] = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType
        })
        .from(entities)
        .where(eq(entities.entityId, entity.entityId))
        .limit(1);

      const [roleRecord] = await db
        .select({
          roleId: customRoles.roleId,
          roleName: customRoles.roleName,
          description: customRoles.description
        })
        .from(customRoles)
        .where(eq(customRoles.roleId, entity.roleId))
        .limit(1);

      Logger.log('info', 'email', 'create-multi-entity-invitation', 'Entity role lookup', {
        entityId: entity.entityId,
        roleId: entity.roleId,
        hasRoleRecord: !!roleRecord,
        hasEntityRecord: !!entityRecord
      });

      if (entityRecord) {
        let roleName = null;
        if (roleRecord && roleRecord.roleName) {
          roleName = roleRecord.roleName;
        } else {
          Logger.log('warning', 'email', 'create-multi-entity-invitation', 'Role not found for entity', { roleId: entity.roleId, entityId: entity.entityId });
        }

        if (roleName) {
          roleNames.push(roleName);
        }

        if (entityRecord.entityType === 'organization') {
          organizations.push(entityRecord.entityName);
        } else if (entityRecord.entityType === 'location') {
          locations.push(entityRecord.entityName);
        }
      } else {
        Logger.log('warning', 'email', 'create-multi-entity-invitation', 'Entity not found', { entityId: entity.entityId });
      }
    }

    let primaryRoleName = 'Member';
    if (roleNames.length > 0) {
      const uniqueRoleNames = [...new Set(roleNames)];
      if (uniqueRoleNames.length === 1) {
        primaryRoleName = uniqueRoleNames[0];
      } else {
        primaryRoleName = `${uniqueRoleNames[0]} (${uniqueRoleNames.length} roles)`;
      }
    } else {
      Logger.log('error', 'email', 'create-multi-entity-invitation', 'No role names found for invitation — this should not happen if validation passed');
      if (validatedEntities.length > 0 && validatedEntities[0].roleId) {
        const [fallbackRole] = await db
          .select({ roleName: customRoles.roleName })
          .from(customRoles)
          .where(eq(customRoles.roleId, validatedEntities[0].roleId))
          .limit(1);
        if (fallbackRole && fallbackRole.roleName) {
          primaryRoleName = fallbackRole.roleName;
          Logger.log('info', 'email', 'create-multi-entity-invitation', 'Recovered role name from fallback lookup', { primaryRoleName });
        }
      }
    }

    Logger.log('info', 'email', 'create-multi-entity-invitation', 'Email details', {
      email: newInvitation.email,
      tenantName: tenant.companyName,
      roleName: primaryRoleName,
      organizations,
      locations,
      entityCount: validatedEntities.length
    });

    const emailOrganizations = organizations.length > 0 ? organizations : [tenant.companyName];
    const emailLocations = locations.length > 0 ? locations : undefined;

    let primaryOrganizationName = null;
    if (finalPrimaryEntityId && organizations.length > 0) {
      const primaryEntity = validatedEntities.find(e => e.entityId === finalPrimaryEntityId);
      if (primaryEntity) {
        const [primaryEntityRecord] = await db
          .select({ entityName: entities.entityName, entityType: entities.entityType })
          .from(entities)
          .where(eq(entities.entityId, primaryEntity.entityId))
          .limit(1);
        if (primaryEntityRecord && primaryEntityRecord.entityType === 'organization') {
          primaryOrganizationName = primaryEntityRecord.entityName;
        } else if (organizations.length > 0) {
          primaryOrganizationName = organizations[0];
        }
      } else if (organizations.length > 0) {
        primaryOrganizationName = organizations[0];
      }
    } else if (organizations.length > 0) {
      primaryOrganizationName = organizations[0];
    }

    Logger.log('info', 'email', 'create-multi-entity-invitation', 'Primary organization name determined', { primaryOrganizationName, hasOrganizations: organizations.length > 0 });

    const emailResult = await EmailService.sendUserInvitation({
      email: newInvitation.email,
      tenantName: tenant.companyName,
      roleName: primaryRoleName,
      invitationToken: invitationUrl, // Pass full URL instead of token
      invitedByName: inviterName || 'Team Administrator',
      message: message || `You've been invited to join ${tenant.companyName} with access to ${validatedEntities.length} organization${validatedEntities.length > 1 ? 's' : ''} as a ${primaryRoleName}.`,
      organizations: emailOrganizations,
      locations: emailLocations,
      primaryOrganizationName: primaryOrganizationName ?? undefined,
      invitedDate: new Date(),
      expiryDate: expiresAt ?? undefined
    });

    Logger.log('info', 'email', 'create-multi-entity-invitation', 'Multi-entity invitation email sent successfully', { email: newInvitation.email });
  } catch (err) {
    const emailError = err as Error & { response?: { data?: unknown } };
    Logger.log('error', 'email', 'create-multi-entity-invitation', 'Failed to send multi-entity invitation email', { email: newInvitation.email, error: emailError.message });
    Logger.log('warning', 'email', 'create-multi-entity-invitation', 'Multi-entity invitation created but email failed', { invitationToken: (newInvitation as { invitation_token?: string }).invitation_token });
  }

  const inv = newInvitation as unknown as { invitationId: string; email: string; primaryEntityId: string | null; invitationScope: string | null; invitationToken: string; invitationUrl: string | null; expiresAt: Date };
  return {
    success: true,
    message: 'Multi-entity invitation created successfully',
    invitation: {
      invitationId: inv.invitationId,
      email: inv.email,
      targetEntities: validatedEntities,
      primaryEntityId: inv.primaryEntityId,
      invitationScope: inv.invitationScope,
      token: inv.invitationToken,
      url: inv.invitationUrl,
      expiresAt: inv.expiresAt
    }
  };
}

export async function getInvitationDetailsByToken(token: string) {
  Logger.log('info', 'email', 'get-invitation-details-by-token', 'Getting invitation details by token', { token });

  let [invitation] = await db
    .select()
    .from(tenantInvitations)
    .where(and(
      eq(tenantInvitations.invitationToken, token),
      eq(tenantInvitations.status, 'pending')
    ))
    .limit(1);

  if (!invitation && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(token).trim())) {
    [invitation] = await db
      .select()
      .from(tenantInvitations)
      .where(and(
        eq(tenantInvitations.invitationId, token),
        eq(tenantInvitations.status, 'pending')
      ))
      .limit(1);
    if (invitation) {
      Logger.log('info', 'email', 'get-invitation-details-by-token', 'Found invitation by invitation_id (token was UUID)', { invitationId: invitation.invitationId });
    }
  }

  if (!invitation) {
    Logger.log('error', 'email', 'get-invitation-details-by-token', 'Invitation not found for token', { token });
    throw new ServiceError(404, {
      error: 'Invitation not found',
      message: 'Invalid or expired invitation token'
    });
  }

  if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
    Logger.log('error', 'email', 'get-invitation-details-by-token', 'Invitation expired for token', { token });
    throw new ServiceError(410, {
      error: 'Invitation expired',
      message: 'This invitation has expired'
    });
  }

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      companyName: tenants.companyName,
      kindeOrgId: tenants.kindeOrgId,
      subdomain: tenants.subdomain,
      logoUrl: tenants.logoUrl,
      primaryColor: tenants.primaryColor,
      brandingConfig: tenants.brandingConfig
    })
    .from(tenants)
    .where(eq(tenants.tenantId, invitation.tenantId))
    .limit(1);

  if (!tenant) {
    throw new ServiceError(404, { error: 'Organization not found' });
  }

  const [inviter] = await db
    .select({
      name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
      email: tenantUsers.email
    })
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, invitation.invitedBy))
    .limit(1);

  let invitationDetails;
  const targetEntitiesArr = (invitation.targetEntities ?? []) as Array<{ entityId: string; roleId?: string | null; entityType?: string | null }>;
  if (invitation.invitationScope === 'multi-entity' && targetEntitiesArr.length > 0) {
    const targetEntityDetails = [];

    for (const targetEntity of targetEntitiesArr) {
      const [entity] = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          hierarchyPath: entities.hierarchyPath
        })
        .from(entities)
        .where(eq(entities.entityId, targetEntity.entityId))
        .limit(1);

      const [role] = targetEntity.roleId
        ? await db
            .select({
              roleName: customRoles.roleName,
              description: customRoles.description
            })
            .from(customRoles)
            .where(eq(customRoles.roleId, targetEntity.roleId))
            .limit(1)
        : [];

      targetEntityDetails.push({
        entityId: targetEntity.entityId,
        entityName: entity?.entityName || 'Unknown Entity',
        entityType: targetEntity.entityType,
        roleName: role?.roleName || 'Member',
        roleDescription: role?.description,
        isPrimary: targetEntity.entityId === invitation.primaryEntityId
      });
    }

    invitationDetails = {
      email: invitation.email,
      organizationName: tenant.companyName,
      inviterName: inviter?.name || 'Team Member',
      invitationScope: 'multi-entity',
      targetEntities: targetEntityDetails,
      primaryEntityId: invitation.primaryEntityId,
      primaryEntityName: targetEntityDetails.find(e => e.isPrimary)?.entityName,
      orgCode: tenant.kindeOrgId,
      expiresAt: invitation.expiresAt
    };
  } else {
    const [role] = invitation.roleId
      ? await db
          .select({
            roleName: customRoles.roleName,
            description: customRoles.description
          })
          .from(customRoles)
          .where(eq(customRoles.roleId, invitation.roleId))
          .limit(1)
      : [];

    invitationDetails = {
      email: invitation.email,
      organizationName: tenant.companyName,
      inviterName: inviter?.name || 'Team Member',
      invitationScope: invitation.invitationScope || 'organization',
      roles: role ? [role.roleName] : ['Member'],
      orgCode: tenant.kindeOrgId,
      roleName: role?.roleName || 'Member',
      expiresAt: invitation.expiresAt
    };
  }

  return {
    success: true,
    invitation: invitationDetails
  };
}

export interface AcceptInvitationByTokenParams {
  token: string;
  kindeUserId: string;
  authenticatedEmail: string;
}

export async function acceptInvitationByToken(params: AcceptInvitationByTokenParams) {
  const { token, kindeUserId, authenticatedEmail } = params;

  Logger.log('info', 'email', 'accept-invitation-by-token', 'Accepting invitation by token', { token, kindeUserId });

  const tokenStr = token;
  let [invitation] = await db
    .select()
    .from(tenantInvitations)
    .where(eq(tenantInvitations.invitationToken, tokenStr))
    .limit(1);

  if (!invitation && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(tokenStr).trim())) {
    [invitation] = await db
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.invitationId, tokenStr))
      .limit(1);
    if (invitation) {
      Logger.log('info', 'email', 'accept-invitation-by-token', 'Found invitation by invitation_id for accept', { invitationId: invitation.invitationId });
    }
  }

  if (!invitation) {
    Logger.log('error', 'email', 'accept-invitation-by-token', 'Invitation not found for token', { token });
    throw new ServiceError(404, {
      error: 'Invitation not found',
      message: 'Invalid or expired invitation token'
    });
  }

  // SECURITY: Verify the authenticated user's email matches the invitation email.
  if (authenticatedEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    Logger.log('error', 'email', 'accept-invitation-by-token', 'Email mismatch — authenticated user does not match invitation', {
      authenticated: authenticatedEmail,
      invited: invitation.email
    });
    throw new ServiceError(403, {
      error: 'Forbidden',
      message: 'This invitation was sent to a different email address. Please sign in with the invited email account.'
    });
  }

  if (invitation.status === 'accepted') {
    Logger.log('info', 'email', 'accept-invitation-by-token', 'Invitation already accepted', { invitationId: invitation.invitationId });

    const [existingUser] = await db
      .select()
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.email, invitation.email),
        eq(tenantUsers.tenantId, invitation.tenantId)
      ))
      .limit(1);

    if (existingUser) {
      return {
        alreadyAccepted: true,
        success: true,
        message: 'Invitation already accepted',
        userId: existingUser.userId,
        email: existingUser.email
      };
    }
  }

  if (invitation.status !== 'pending') {
    Logger.log('error', 'email', 'accept-invitation-by-token', 'Invitation is not pending', { status: invitation.status });
    throw new ServiceError(400, {
      error: 'Invitation not available',
      message: `Invitation status is ${invitation.status}, cannot accept`
    });
  }

  if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
    Logger.log('error', 'email', 'accept-invitation-by-token', 'Invitation expired for token', { token });
    throw new ServiceError(410, {
      error: 'Invitation expired',
      message: 'This invitation has expired'
    });
  }

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      companyName: tenants.companyName,
      kindeOrgId: tenants.kindeOrgId
    })
    .from(tenants)
    .where(eq(tenants.tenantId, invitation.tenantId))
    .limit(1);

  if (!tenant) {
    throw new ServiceError(404, { error: 'Organization not found' });
  }

  const roleAssignmentsToPublish = [];

  Logger.log('info', 'email', 'accept-invitation-by-token', 'Ensuring user is in correct Kinde organizations for invitation');

  const targetEntitiesList = (invitation.targetEntities ?? []) as Array<{ entityId: string; entityType?: string }>;
  if (invitation.invitationScope === 'multi-entity' && targetEntitiesList.length > 0) {
    Logger.log('info', 'email', 'accept-invitation-by-token', 'Processing multi-entity invitation', { entityCount: targetEntitiesList.length });

    const targetOrgIds = new Set<string>();

    for (const entity of targetEntitiesList) {
      if (entity.entityId) {
        const [entityRecord] = await db
          .select({
            entityId: entities.entityId,
            entityType: entities.entityType,
            parentEntityId: entities.parentEntityId
          })
          .from(entities)
          .where(eq(entities.entityId, entity.entityId))
          .limit(1);

        if (entityRecord) {
          if (entityRecord.entityType === 'location' && entityRecord.parentEntityId) {
            const [parentOrg] = await db
              .select({
                entityId: entities.entityId,
                kindeOrgId: tenants.kindeOrgId
              })
              .from(entities)
              .leftJoin(tenants, eq(entities.tenantId, tenants.tenantId))
              .where(eq(entities.entityId, entityRecord.parentEntityId))
              .limit(1);

            if (parentOrg?.kindeOrgId) {
              targetOrgIds.add(parentOrg.kindeOrgId);
              Logger.log('info', 'email', 'accept-invitation-by-token', 'Added parent organization for location', { kindeOrgId: parentOrg.kindeOrgId });
            }
          } else if (entityRecord.entityType === 'organization') {
            targetOrgIds.add(tenant.kindeOrgId);
            Logger.log('info', 'email', 'accept-invitation-by-token', 'Added direct organization', { kindeOrgId: tenant.kindeOrgId });
          }
        }
      }
    }

    const uniqueOrgIds = Array.from(targetOrgIds);
    Logger.log('info', 'email', 'accept-invitation-by-token', 'Adding user to unique organizations', { count: uniqueOrgIds.length, uniqueOrgIds });

    for (const orgId of uniqueOrgIds) {
      try {
        Logger.log('info', 'email', 'accept-invitation-by-token', 'Adding user to organization', { orgId });
        const orgResult = await ensureUserInCorrectOrganization(
          kindeUserId as string,
          invitation.email,
          orgId as string
        );

        if (orgResult.success) {
          Logger.log('info', 'email', 'accept-invitation-by-token', 'Successfully added user to organization', { orgId });
        } else {
          Logger.log('warning', 'email', 'accept-invitation-by-token', 'Failed to add user to organization', { orgId, error: orgResult.error });
        }
      } catch (orgError) {
        Logger.log('warning', 'email', 'accept-invitation-by-token', 'Error adding user to organization', { orgId, error: (orgError as Error).message });
      }
    }
  } else {
    Logger.log('info', 'email', 'accept-invitation-by-token', 'Processing single-entity invitation, adding to tenant organization', { kindeOrgId: tenant.kindeOrgId });

    try {
      let orgResult = await ensureUserInCorrectOrganization(
        kindeUserId as string,
        invitation.email,
        tenant.kindeOrgId
      );

      if (!orgResult.success && tenant.kindeOrgId.startsWith('org_')) {
        const orgCodeWithoutPrefix = tenant.kindeOrgId.replace('org_', '');
        Logger.log('info', 'email', 'accept-invitation-by-token', 'Retrying with org code without prefix', { orgCodeWithoutPrefix });
        orgResult = await ensureUserInCorrectOrganization(
          kindeUserId as string,
          invitation.email,
          orgCodeWithoutPrefix
        );
      }

      if (orgResult.success) {
        Logger.log('info', 'email', 'accept-invitation-by-token', 'User organization assignment completed');
      } else {
        Logger.log('warning', 'email', 'accept-invitation-by-token', 'Kinde organization assignment failed, but continuing — this is expected if your M2M client lacks organization management permissions', { error: orgResult.error });
      }
    } catch (orgError) {
      Logger.log('warning', 'email', 'accept-invitation-by-token', 'Kinde organization assignment threw error, but continuing — this is expected if your M2M client lacks organization management permissions', { error: (orgError as Error).message });
    }
  }

  Logger.log('info', 'email', 'accept-invitation-by-token', 'Proceeding with invitation acceptance - user will be properly set up in internal system');

  const [existingUser] = await db
    .select()
    .from(tenantUsers)
    .where(and(
      eq(tenantUsers.email, invitation.email),
      eq(tenantUsers.tenantId, invitation.tenantId)
    ))
    .limit(1);

  let newUser;
  if (existingUser) {
    Logger.log('info', 'email', 'accept-invitation-by-token', 'Updating existing user record', { userId: existingUser.userId });

    const existingPreferences = existingUser.preferences || {};

    [newUser] = await db
      .update(tenantUsers)
      .set({
        kindeUserId: kindeUserId as string,
        isActive: true,
        onboardingCompleted: true,
        preferences: {
          ...existingPreferences,
          userType: 'INVITED_USER',
          isInvitedUser: true,
          invitedAt: invitation.createdAt?.toISOString() || new Date().toISOString()
        },
        updatedAt: new Date()
      } as any)
      .where(eq(tenantUsers.userId, existingUser.userId))
      .returning();

    try {
      const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
      const firstName = newUser.firstName || '';
      const lastName = newUser.lastName || '';
      await snsSqsPublisher.publishUserEventToSuite('user_invitation_accepted', tenant.kindeOrgId, newUser.userId, {
        userId: newUser.userId,
        email: newUser.email,
        firstName: firstName,
        lastName: lastName,
        name: `${firstName} ${lastName}`.trim() || newUser.email || '',
        isActive: newUser.isActive !== undefined ? newUser.isActive : true,
        onboardingCompleted: true,
        kindeUserId: newUser.kindeUserId,
        invitedBy: invitation.invitedBy,
        invitationId: invitation.invitationId,
        acceptedAt: new Date().toISOString()
      });
      Logger.log('info', 'email', 'accept-invitation-by-token', 'Published user_invitation_accepted event to all applications (existing user)');
    } catch (publishErr) {
      Logger.log('warning', 'email', 'accept-invitation-by-token', 'Failed to publish user_invitation_accepted (existing user)', { error: (publishErr as Error).message });
    }
  } else {
    Logger.log('info', 'email', 'accept-invitation-by-token', 'Creating new user record', {
      email: invitation.email,
      tenantId: invitation.tenantId,
      invitedBy: invitation.invitedBy
    });
    [newUser] = await db
      .insert(tenantUsers)
      .values({
        tenantId: invitation.tenantId,
        kindeUserId: kindeUserId as string,
        email: invitation.email,
        name: invitation.email.split('@')[0],
        isActive: true,
        onboardingCompleted: true,
        isTenantAdmin: false,
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt,
        preferences: {
          userType: 'INVITED_USER',
          isInvitedUser: true,
          invitedAt: invitation.createdAt?.toISOString() || new Date().toISOString()
        },
        updatedAt: new Date()
      } as any)
      .returning();

    Logger.log('info', 'email', 'accept-invitation-by-token', 'User created successfully', {
      userId: newUser.userId,
      email: newUser.email,
      tenantId: newUser.tenantId,
      isActive: newUser.isActive
    });

    try {
      const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
      const firstName = newUser.firstName || '';
      const lastName = newUser.lastName || '';

      await snsSqsPublisher.publishUserEventToSuite('user_created', tenant.kindeOrgId, newUser.userId, {
        userId: newUser.userId,
        email: newUser.email,
        kindeUserId: newUser.kindeUserId,
        firstName: firstName,
        lastName: lastName,
        name: `${firstName} ${lastName}`.trim() || newUser.email || '',
        isActive: newUser.isActive !== undefined ? newUser.isActive : true,
        createdAt: newUser.createdAt ? (typeof newUser.createdAt === 'string' ? newUser.createdAt : newUser.createdAt.toISOString()) : new Date().toISOString()
      });
      Logger.log('info', 'email', 'accept-invitation-by-token', 'Published user_created event to AWS MQ');
      await snsSqsPublisher.publishUserEventToSuite('user_invitation_accepted', tenant.kindeOrgId, newUser.userId, {
        userId: newUser.userId,
        email: newUser.email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim() || newUser.email || '',
        isActive: newUser.isActive !== undefined ? newUser.isActive : true,
        onboardingCompleted: true,
        kindeUserId: newUser.kindeUserId,
        invitedBy: invitation.invitedBy,
        invitationId: invitation.invitationId,
        createdAt: newUser.createdAt ? (typeof newUser.createdAt === 'string' ? newUser.createdAt : newUser.createdAt.toISOString()) : new Date().toISOString(),
        acceptedAt: new Date().toISOString()
      });
      Logger.log('info', 'email', 'accept-invitation-by-token', 'Published user_invitation_accepted event to all applications (new user)');
    } catch (streamError) {
      Logger.log('warning', 'email', 'accept-invitation-by-token', 'Failed to publish user creation event to AWS MQ', { error: (streamError as Error).message });
    }
  }

  const acceptTargetEntities = (invitation.targetEntities ?? []) as Array<{ entityId: string; roleId?: string | null; entityType?: string; membershipType?: string }>;
  const orgAssignmentsToPublish: Array<{ entityId: string; isPrimary: boolean }> = [];
  if (invitation.invitationScope === 'multi-entity' && acceptTargetEntities.length > 0) {
    Logger.log('info', 'email', 'accept-invitation-by-token', 'Processing multi-entity invitation', { entityCount: acceptTargetEntities.length });

    const memberships: unknown[] = [];
    const assignedRoleIds = new Set<string>();

    for (const targetEntity of acceptTargetEntities) {
      const [existingMembership] = await db
        .select()
        .from(organizationMemberships)
        .where(and(
          eq(organizationMemberships.userId, newUser.userId),
          eq(organizationMemberships.entityId, targetEntity.entityId),
          eq(organizationMemberships.tenantId, invitation.tenantId)
        ))
        .limit(1);

      if (existingMembership) {
        Logger.log('info', 'email', 'accept-invitation-by-token', 'Membership already exists for user and entity, skipping duplicate', {
          userId: newUser.userId,
          entityId: targetEntity.entityId,
          membershipId: existingMembership.membershipId
        });
        memberships.push(existingMembership);
        orgAssignmentsToPublish.push({ entityId: targetEntity.entityId, isPrimary: targetEntity.entityId === invitation.primaryEntityId });

        if (targetEntity.roleId && !assignedRoleIds.has(targetEntity.roleId)) {
          const [existingRoleAssignment] = await db
            .select()
            .from(userRoleAssignments)
            .where(and(
              eq(userRoleAssignments.userId, newUser.userId),
              eq(userRoleAssignments.roleId, targetEntity.roleId)
            ))
            .limit(1);

          if (!existingRoleAssignment) {
            try {
              const [inserted] = await db
                .insert(userRoleAssignments)
                .values({
                  userId: newUser.userId,
                  roleId: targetEntity.roleId,
                  assignedBy: invitation.invitedBy,
                  assignedAt: new Date()
                })
                .returning();
              if (inserted) roleAssignmentsToPublish.push(inserted);
              assignedRoleIds.add(targetEntity.roleId);
              Logger.log('info', 'email', 'accept-invitation-by-token', 'Assigned role to user', { userId: newUser.userId, roleId: targetEntity.roleId });
            } catch (err) {
              const roleError = err as Error & { code?: string };
              if (roleError.code !== '23505') {
                Logger.log('warning', 'email', 'accept-invitation-by-token', 'Failed to assign role', { error: roleError.message });
              } else {
                Logger.log('info', 'email', 'accept-invitation-by-token', 'Role already assigned, skipping duplicate');
              }
            }
          } else {
            Logger.log('info', 'email', 'accept-invitation-by-token', 'Role assignment already exists, skipping duplicate');
            assignedRoleIds.add(targetEntity.roleId);
            roleAssignmentsToPublish.push(existingRoleAssignment);
          }
        }
        continue;
      }

      try {
        const [membership] = await db
          .insert(organizationMemberships)
          .values({
            userId: newUser.userId,
            tenantId: invitation.tenantId,
            entityId: targetEntity.entityId,
            entityType: (targetEntity as { entityType?: string }).entityType ?? 'organization',
            roleId: targetEntity.roleId,
            roleName: null,
            membershipType: (targetEntity as { membershipType?: string }).membershipType || 'direct',
            membershipStatus: 'active',
            isPrimary: targetEntity.entityId === invitation.primaryEntityId,
            canAccessSubEntities: true,
            invitedBy: invitation.invitedBy,
            invitedAt: invitation.createdAt,
            joinedAt: new Date(),
            createdBy: invitation.invitedBy,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any)
          .returning();

        memberships.push(membership);
        orgAssignmentsToPublish.push({ entityId: targetEntity.entityId, isPrimary: targetEntity.entityId === invitation.primaryEntityId });
        Logger.log('info', 'email', 'accept-invitation-by-token', 'Created membership for entity', { entityId: targetEntity.entityId });
      } catch (err) {
        const membershipError = err as Error & { code?: string };
        if (membershipError.code === '23505') {
          Logger.log('info', 'email', 'accept-invitation-by-token', 'Membership already exists (race condition), skipping duplicate');
          const [existing] = await db
            .select()
            .from(organizationMemberships)
            .where(and(
              eq(organizationMemberships.userId, newUser.userId),
              eq(organizationMemberships.entityId, targetEntity.entityId),
              eq(organizationMemberships.tenantId, invitation.tenantId)
            ))
            .limit(1);
          if (existing) {
            memberships.push(existing);
            orgAssignmentsToPublish.push({ entityId: targetEntity.entityId, isPrimary: targetEntity.entityId === invitation.primaryEntityId });
          }
        } else {
          Logger.log('error', 'email', 'accept-invitation-by-token', 'Failed to create membership', { error: (membershipError as Error).message });
          throw membershipError;
        }
      }

      if (targetEntity.roleId && !assignedRoleIds.has(targetEntity.roleId)) {
        const [existingRoleAssignment] = await db
          .select()
          .from(userRoleAssignments)
          .where(and(
            eq(userRoleAssignments.userId, newUser.userId),
            eq(userRoleAssignments.roleId, targetEntity.roleId)
          ))
          .limit(1);

        if (!existingRoleAssignment) {
          try {
            const [inserted] = await db
              .insert(userRoleAssignments)
              .values({
                userId: newUser.userId,
                roleId: targetEntity.roleId,
                assignedBy: invitation.invitedBy,
                assignedAt: new Date()
              })
              .returning();
            if (inserted) roleAssignmentsToPublish.push(inserted);
            assignedRoleIds.add(targetEntity.roleId);
            Logger.log('info', 'email', 'accept-invitation-by-token', 'Assigned role to user', { userId: newUser.userId, roleId: targetEntity.roleId });
          } catch (err) {
            const roleError = err as Error & { code?: string };
            if (roleError.code !== '23505') {
              Logger.log('warning', 'email', 'accept-invitation-by-token', 'Failed to assign role', { error: roleError.message });
            } else {
              Logger.log('info', 'email', 'accept-invitation-by-token', 'Role already assigned, skipping duplicate');
              if (targetEntity.roleId) assignedRoleIds.add(targetEntity.roleId);
            }
          }
        } else {
          Logger.log('info', 'email', 'accept-invitation-by-token', 'Role assignment already exists, skipping duplicate');
          if (targetEntity.roleId) assignedRoleIds.add(targetEntity.roleId);
          roleAssignmentsToPublish.push(existingRoleAssignment);
        }
      }
    }

    if (invitation.primaryEntityId) {
      await db
        .update(tenantUsers)
        .set({
          primaryOrganizationId: invitation.primaryEntityId as string,
          updatedAt: new Date()
        } as any)
        .where(eq(tenantUsers.userId, newUser.userId));
      Logger.log('info', 'email', 'accept-invitation-by-token', 'Set primary organization', { primaryEntityId: invitation.primaryEntityId });
    }

  } else {
    Logger.log('info', 'email', 'accept-invitation-by-token', 'Processing single-entity invitation');

    if (invitation.roleId) {
      const [inserted] = await db
        .insert(userRoleAssignments)
        .values({
          userId: newUser.userId,
          roleId: invitation.roleId,
          assignedBy: invitation.invitedBy,
          assignedAt: new Date()
        })
        .returning();
      if (inserted) roleAssignmentsToPublish.push(inserted);
      Logger.log('info', 'email', 'accept-invitation-by-token', 'Assigned role to user', { userId: newUser.userId, roleId: invitation.roleId, assignedBy: invitation.invitedBy });
    } else {
      Logger.log('warning', 'email', 'accept-invitation-by-token', 'No roleId in invitation for single-entity invitation');
    }

    let targetEntityId = invitation.primaryEntityId;

    if (!targetEntityId) {
      const [tenantEntity] = await db
        .select({
          entityId: entities.entityId
        })
        .from(entities)
        .where(and(
          eq(entities.tenantId, invitation.tenantId),
          eq(entities.entityType, 'organization'),
          isNull(entities.parentEntityId)
        ))
        .limit(1);

      if (tenantEntity) {
        targetEntityId = tenantEntity.entityId;
      }
    }

    if (targetEntityId) {
      const [existingMembership] = await db
        .select()
        .from(organizationMemberships)
        .where(and(
          eq(organizationMemberships.userId, newUser.userId),
          eq(organizationMemberships.entityId, targetEntityId),
          eq(organizationMemberships.tenantId, invitation.tenantId)
        ))
        .limit(1);

      if (existingMembership) {
        Logger.log('info', 'email', 'accept-invitation-by-token', 'Membership already exists for user and entity, skipping duplicate', {
          userId: newUser.userId,
          entityId: targetEntityId,
          membershipId: existingMembership.membershipId
        });
        orgAssignmentsToPublish.push({ entityId: targetEntityId, isPrimary: true });
      } else {
        const [entityRecord] = await db
          .select({
            entityId: entities.entityId,
            entityType: entities.entityType
          })
          .from(entities)
          .where(eq(entities.entityId, targetEntityId))
          .limit(1);

        const entityType = entityRecord?.entityType || 'organization';

        try {
          const [membership] = await db
            .insert(organizationMemberships)
            .values({
              userId: newUser.userId,
              tenantId: invitation.tenantId,
              entityId: targetEntityId,
              entityType: entityType,
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
            } as any)
            .returning();

          orgAssignmentsToPublish.push({ entityId: targetEntityId, isPrimary: true });
          Logger.log('info', 'email', 'accept-invitation-by-token', 'Created organization membership', {
            membershipId: membership.membershipId,
            entityId: targetEntityId,
            entityType,
            roleId: invitation.roleId
          });
        } catch (err) {
          const membershipError = err as Error & { code?: string };
          if (membershipError.code === '23505') {
            Logger.log('info', 'email', 'accept-invitation-by-token', 'Membership already exists (race condition), skipping duplicate');
            orgAssignmentsToPublish.push({ entityId: targetEntityId, isPrimary: true });
          } else {
            Logger.log('error', 'email', 'accept-invitation-by-token', 'Failed to create membership', { error: (membershipError as Error).message });
            throw membershipError;
          }
        }
      }

      if (invitation.roleId) {
        const [existingRoleAssignment] = await db
          .select()
          .from(userRoleAssignments)
          .where(and(
            eq(userRoleAssignments.userId, newUser.userId),
            eq(userRoleAssignments.roleId, invitation.roleId)
          ))
          .limit(1);

        if (!existingRoleAssignment) {
          try {
            const [inserted] = await db
              .insert(userRoleAssignments)
              .values({
                userId: newUser.userId,
                roleId: invitation.roleId,
                assignedBy: invitation.invitedBy,
                assignedAt: new Date()
              })
              .returning();
            if (inserted) roleAssignmentsToPublish.push(inserted);
            Logger.log('info', 'email', 'accept-invitation-by-token', 'Assigned role to user', { userId: newUser.userId, roleId: invitation.roleId, assignedBy: invitation.invitedBy });
          } catch (err) {
            const roleError = err as Error & { code?: string };
            if (roleError.code !== '23505') {
              Logger.log('warning', 'email', 'accept-invitation-by-token', 'Failed to assign role', { error: roleError.message });
            } else {
              Logger.log('info', 'email', 'accept-invitation-by-token', 'Role already assigned, skipping duplicate');
            }
          }
        } else {
          Logger.log('info', 'email', 'accept-invitation-by-token', 'Role assignment already exists, skipping duplicate');
          roleAssignmentsToPublish.push(existingRoleAssignment);
        }
      }

      await db
        .update(tenantUsers)
        .set({
          primaryOrganizationId: targetEntityId,
          updatedAt: new Date()
        } as any)
        .where(eq(tenantUsers.userId, newUser.userId));

      Logger.log('info', 'email', 'accept-invitation-by-token', 'Set primary organization', { targetEntityId });
    } else {
      Logger.log('warning', 'email', 'accept-invitation-by-token', 'No target entity found for single-entity invitation');
    }
  }

  if (roleAssignmentsToPublish.length > 0) {
    try {
      const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
      for (const a of roleAssignmentsToPublish) {
        await snsSqsPublisher.publishRoleEventToSuite('role_assigned', tenant.kindeOrgId, a.roleId, {
          assignmentId: a.id,
          userId: newUser.userId,
          roleId: a.roleId,
          assignedAt: a.assignedAt ? (typeof a.assignedAt === 'string' ? a.assignedAt : a.assignedAt.toISOString()) : new Date().toISOString(),
          assignedBy: invitation.invitedBy,
          expiresAt: (a as { expiresAt?: Date | string }).expiresAt,
          entityId: (a as { organizationId?: string }).organizationId
        });
      }
      Logger.log('info', 'email', 'accept-invitation-by-token', 'Published role_assigned events for invitation acceptance', { count: roleAssignmentsToPublish.length });
    } catch (publishError) {
      Logger.log('warning', 'email', 'accept-invitation-by-token', 'Failed to publish role assignment events (invitation accept)', { error: (publishError as Error).message });
    }
  }

  if (orgAssignmentsToPublish.length > 0) {
    try {
      const { OrganizationAssignmentService } = await import('../services/organization-assignment-service.js');
      for (const { entityId, isPrimary } of orgAssignmentsToPublish) {
        const [organization] = await db
          .select({
            entityId: entities.entityId,
            entityName: entities.entityName,
          })
          .from(entities)
          .where(and(
            eq(entities.entityId, entityId),
            eq(entities.tenantId, invitation.tenantId)
          ))
          .limit(1);

        if (organization) {
          const assignmentData = {
            assignmentId: `${newUser.userId}_${entityId}_${Date.now()}`,
            tenantId: invitation.tenantId,
            userId: newUser.userId,
            organizationId: entityId,
            organizationCode: organization.entityId,
            assignmentType: isPrimary ? 'primary' : 'direct',
            isActive: true,
            assignedAt: new Date().toISOString(),
            priority: isPrimary ? 1 : 2,
            assignedBy: invitation.invitedBy,
            metadata: {
              source: 'invitation_acceptance',
              invitationId: invitation.invitationId
            }
          };
          await OrganizationAssignmentService.publishOrgAssignmentCreated(assignmentData);
        }
      }
      Logger.log('info', 'email', 'accept-invitation-by-token', 'Published organization.assignment.created events for invitation acceptance', { count: orgAssignmentsToPublish.length });
    } catch (publishError) {
      Logger.log('warning', 'email', 'accept-invitation-by-token', 'Failed to publish organization assignment events (invitation accept)', { error: (publishError as Error).message });
    }
  }

  await invalidateRoleCache(newUser.userId);
  if (newUser.kindeUserId) {
    await invalidateUserCache(newUser.kindeUserId);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(tenantInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date()
      } as any)
      .where(and(
        eq(tenantInvitations.invitationId, invitation.invitationId),
        eq(tenantInvitations.status, 'pending')
      ));
  });

  Logger.log('info', 'email', 'accept-invitation-by-token', 'Invitation accepted successfully', {
    userId: newUser.userId,
    email: newUser.email,
    tenantId: newUser.tenantId,
    invitedOrg: tenant.kindeOrgId,
    invitationScope: invitation.invitationScope,
    targetEntities: invitation.invitationScope === 'multi-entity' ? ((invitation.targetEntities as unknown[])?.length ?? 0) : 1,
    isActive: newUser.isActive,
    onboardingCompleted: newUser.onboardingCompleted,
    isTenantAdmin: newUser.isTenantAdmin
  });

  return {
    success: true,
    message: 'Invitation accepted successfully',
    user: {
      userId: newUser.userId,
      email: newUser.email,
      name: `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() || newUser.email || '',
      isActive: newUser.isActive,
      tenantId: newUser.tenantId,
      onboardingCompleted: newUser.onboardingCompleted,
      isTenantAdmin: newUser.isTenantAdmin
    },
    invitationDetails: {
      invitationScope: invitation.invitationScope,
      targetEntities: invitation.targetEntities || [],
      primaryEntityId: invitation.primaryEntityId
    }
  };
}
