import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, dbManager } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments, tenantInvitations, organizationMemberships, entities } from '../../../db/schema/index.js';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { kindeService } from '../../auth/index.js';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, invalidateRoleCache, invalidateUserCache } from '../../../middleware/auth/auth.js';

type OrgItem = { code: string; name?: string };

// Enhanced function to ensure user is in correct Kinde organization
async function ensureUserInCorrectOrganization(
  kindeUserId: string,
  email: string,
  targetOrgCode: string,
  maxRetries = 5
) {
  console.log(`🔗 Starting organization assignment for user:`, {
    kindeUserId,
    email,
    targetOrgCode,
    maxRetries
  });

  try {
    // Step 1: Get user's current organizations
    console.log(`📋 Checking current organizations for user: ${kindeUserId}`);
    const userOrgs = await kindeService.getUserOrganizations(kindeUserId);
    const orgs = (userOrgs.organizations ?? []) as OrgItem[];
    console.log(`📋 User is currently in organizations:`, orgs.map((org: OrgItem) => ({
      code: org.code,
      name: org.name
    })));

    // Step 2: Check if user is already in target organization
    const isAlreadyInTarget = orgs.some((org: OrgItem) => org.code === targetOrgCode);
    console.log(`🎯 Is user already in target organization ${targetOrgCode}:`, isAlreadyInTarget);

    // Step 3: If not in target organization, add them with retry logic
    if (!isAlreadyInTarget) {
      console.log(`🔄 Adding user to target organization: ${targetOrgCode}`);
      
      let lastError = null;
      let success = false;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Organization assignment attempt ${attempt}/${maxRetries}`);
          
          // Use the enhanced addUserToOrganization method with exclusive mode
          const result = await kindeService.addUserToOrganization(
            kindeUserId,
            targetOrgCode as string,
            { exclusive: true } // This ensures user is ONLY in the target organization
          );
          
          console.log(`✅ User assignment result (attempt ${attempt}):`, {
            userId: result.userId,
            method: result.method,
            success: result.success,
            message: result.message,
            error: result.error
          });
          
          // Check if the assignment was successful
          if (result.success && result.userId) {
            // Wait a moment for the assignment to propagate
            console.log(`⏳ Waiting for assignment to propagate...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify the assignment immediately
            const verifyResult = await kindeService.getUserOrganizations(kindeUserId);
            const verifyOrgs = (verifyResult.organizations ?? []) as OrgItem[];
            const isNowInTarget = verifyOrgs.some((o: OrgItem) => o.code === targetOrgCode);
            
            console.log(`🔍 Immediate verification result:`, {
              isNowInTarget,
              totalOrgs: verifyOrgs.length,
              orgCodes: verifyOrgs.map((o: OrgItem) => o.code)
            });
            
            if (isNowInTarget) {
              success = true;
              console.log(`✅ Assignment verified successfully on attempt ${attempt}`);
              break;
            } else {
              console.warn(`⚠️ Assignment reported success but verification failed on attempt ${attempt}`);
              lastError = new Error(`Assignment verification failed on attempt ${attempt}`);
            }
          } else {
            console.warn(`⚠️ User assignment reported failure on attempt ${attempt}:`, (result as { error?: string; message?: string }).error || (result as { message?: string }).message || 'Unknown assignment error');
            lastError = new Error((result as { error?: string; message?: string }).error || (result as { message?: string }).message || 'Unknown assignment error');
          }
          
        } catch (err) {
          const error = err as Error;
          console.log(`❌ Organization assignment attempt ${attempt} failed:`, error.message);
          lastError = error;
          
          // If it's the last attempt, don't wait
          if (attempt < maxRetries) {
            const waitTime = Math.min(attempt * 2000, 10000); // Exponential backoff, max 10 seconds
            console.log(`⏳ Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!success) {
        console.error('❌ Failed to add user to organization after all retries:', lastError?.message);
        return { 
          success: false, 
          error: lastError?.message || 'Unknown error',
          message: 'Failed to assign user to organization after multiple attempts',
          attempts: maxRetries,
          lastError: lastError?.message
        };
      }
      
    } else {
      console.log('✅ User already in target organization');
      
      // Still run exclusive mode to ensure they're not in other organizations
      try {
        console.log('🧹 Cleaning up user from other organizations...');
        const result = await kindeService.addUserToOrganization(
          kindeUserId,
          targetOrgCode,
          { exclusive: true }
        );
        console.log('✅ Organization cleanup completed:', result.method);
      } catch (err) {
        const cleanupError = err as Error;
        console.warn('⚠️ Organization cleanup failed but user is in target org:', cleanupError.message);
      }
    }

    // Step 4: Final verification with multiple attempts
    console.log('🔍 Performing final organization state verification...');
    let finalVerificationSuccess = false;
    let verificationAttempts = 0;
    const maxVerificationAttempts = 3;
    
    while (!finalVerificationSuccess && verificationAttempts < maxVerificationAttempts) {
      try {
        verificationAttempts++;
        console.log(`🔍 Final verification attempt ${verificationAttempts}/${maxVerificationAttempts}`);
        
        const finalOrgs = await kindeService.getUserOrganizations(kindeUserId);
        const finalOrgCodes = ((finalOrgs.organizations ?? []) as OrgItem[]).map((o: OrgItem) => o.code);
        
        console.log('📊 Final organization state:', {
          totalOrganizations: finalOrgCodes.length,
          organizations: finalOrgCodes,
          isInTargetOrg: finalOrgCodes.includes(targetOrgCode),
          isInOnlyTargetOrg: finalOrgCodes.length === 1 && finalOrgCodes[0] === targetOrgCode
        });
        
        if (finalOrgCodes.includes(targetOrgCode)) {
          finalVerificationSuccess = true;
          console.log('✅ Final verification successful');
        } else {
          console.warn(`⚠️ Final verification attempt ${verificationAttempts} failed - user not in target org`);
          if (verificationAttempts < maxVerificationAttempts) {
            console.log(`⏳ Waiting before next verification attempt...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
      } catch (err) {
        const verifyError = err as Error;
        console.warn(`⚠️ Final verification attempt ${verificationAttempts} error:`, verifyError.message);
        if (verificationAttempts < maxVerificationAttempts) {
          console.log(`⏳ Waiting before next verification attempt...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    if (!finalVerificationSuccess) {
      return {
        success: false,
        error: 'User not found in target organization after assignment',
        message: 'Assignment appeared to succeed but verification failed after multiple attempts',
        verificationAttempts,
        targetOrgCode
      };
    }

    return { 
      success: true, 
      message: 'User successfully assigned to organization',
      targetOrg: targetOrgCode,
      verificationAttempts
    };
    
  } catch (err) {
    const error = err as Error;
    console.error('❌ Error ensuring user in correct organization:', error);
    return { 
      success: false, 
      error: error.message,
      message: 'Organization assignment failed due to unexpected error',
      stack: error.stack
    };
  }
}

// Permission validation helper for multi-entity invitations
async function validateMultiEntityInvitationPermissions(
  inviterId: string,
  tenantId: string,
  targetEntities: Array<{ entityId: string; roleId?: string | null; entityType?: string | null; membershipType?: string }>
) {
  console.log('🔐 Validating permissions for multi-entity invitation:', {
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
    console.log('✅ Inviter is tenant admin - all permissions granted');
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

  console.log('👤 Inviter memberships found:', inviterMemberships.length);

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

  console.log('🔐 Permission validation result:', {
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
async function generateInvitationUrl(
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
        console.log('🔗 Generated invitation URL using request origin (development):', invitationUrl);
        return invitationUrl;
      } catch (_e) {
        console.warn('⚠️ Invalid origin URL, continuing with other methods:', origin);
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
        console.log('🔗 Generated invitation URL using tenant subdomain:', invitationUrl);
        return invitationUrl;
      }
    } catch (err) {
      const error = err as Error;
      console.warn('⚠️ Failed to get tenant subdomain, falling back to other methods:', error.message);
    }
  }

  // Priority 3: In development, force localhost
  if (isDevelopment) {
    const baseUrl = 'http://localhost:3001';
    const invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;
    console.log('🔗 Generated invitation URL for development (localhost):', invitationUrl);
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
      console.log('⚠️ No base URL found, using development default:', baseUrl);
    } else {
      baseUrl = process.env.BASE_URL || 'https://zopkit.com';
      console.log('⚠️ No base URL found, using production default:', baseUrl);
    }
  }
  
  // Generate the full invitation URL
  const invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;
  
  // Ensure we always have a valid URL
  if (!invitationUrl || !invitationUrl.startsWith('http')) {
    console.error('❌ Invalid invitation URL generated:', {
      baseUrl,
      invitationToken,
      invitationUrl,
      env: {
        INVITATION_BASE_URL: process.env.INVITATION_BASE_URL,
        FRONTEND_URL: process.env.FRONTEND_URL,
        BASE_URL: process.env.BASE_URL,
        NODE_ENV: process.env.NODE_ENV
      }
    });
    // Fallback to a safe default
    const fallbackUrl = isDevelopment 
      ? 'http://localhost:3001' 
      : 'https://zopkit.com';
    return `${fallbackUrl}/invite/accept?token=${invitationToken}`;
  }
  
  console.log('🔗 Generated invitation URL:', invitationUrl);
  
  return invitationUrl;
}

export default async function invitationRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // Get invitation details for acceptance page - PUBLIC ENDPOINT
  fastify.get('/details', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { org, email } = query;
      
      if (!org || !email) {
        return reply.code(400).send({
          error: 'Missing required parameters',
          message: 'org and email parameters are required'
        });
      }

      console.log('🔍 Getting invitation details (public):', { org, email });
      console.log('🔍 Raw query params:', request.query);
      
      // Decode email in case it's URL encoded
      const decodedEmail = decodeURIComponent(email);
      console.log('🔍 Email comparison:', { 
        original: email, 
        decoded: decodedEmail,
        areDifferent: email !== decodedEmail 
      });

      // Get organization details
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
        .where(eq(tenants.kindeOrgId, org as string))
        .limit(1);

      if (!tenant) {
        console.log('❌ Organization not found for org:', org);
        return reply.code(404).send({
          error: 'Organization not found'
        });
      }

      console.log('✅ Found organization:', {
        tenantId: tenant.tenantId,
        companyName: tenant.companyName,
        kindeOrgId: tenant.kindeOrgId
      });

      // Get invited user details
      const [invitedUser] = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.email, decodedEmail),
          eq(tenantUsers.tenantId, tenant.tenantId)
        ))
        .limit(1);

      if (!invitedUser) {
        console.log('❌ Invitation not found for email:', decodedEmail);
        return reply.code(404).send({
          error: 'Invitation not found',
          message: 'No invitation found for this email address'
        });
      }

      // Check if user is already active
      if (invitedUser.isActive) {
        return reply.code(409).send({
          error: 'Invitation already accepted',
          message: 'This invitation has already been accepted'
        });
      }

      // Get invitation to find inviter (tenant_users does not have invitedBy)
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

      // Get user's assigned roles
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
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error getting invitation details:', error);
      return reply.code(500).send({
        error: 'Failed to get invitation details',
        message: error.message
      });
    }
  });

  // Accept invitation (public endpoint)
  fastify.post('/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { token } = body;
      
      if (!token) {
        return reply.code(400).send({
          error: 'Missing required field',
          message: 'token is required'
        });
      }

      console.log('🔓 Accepting invitation with token:', token);

      // Find invitation by token
      const tokenStr = token as string;
      const [invitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.invitationToken, tokenStr),
          eq(tenantInvitations.status, 'pending')
        ))
        .limit(1);

      if (!invitation) {
        console.log('❌ Invitation not found for token:', tokenStr);
        return reply.code(404).send({
          error: 'Invitation not found',
          message: 'Invalid or expired invitation token'
        });
      }

      // Check if invitation has expired
      if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
        console.log('❌ Invitation expired for token:', token);
        return reply.code(410).send({
          error: 'Invitation expired',
          message: 'This invitation has expired'
        });
      }

      // Get organization details
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
        console.log('❌ Organization not found for tenant:', invitation.tenantId);
        return reply.code(404).send({
          error: 'Organization not found'
        });
      }

      // Get role details
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

      // Get inviter details
      const [inviter] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, invitation.invitedBy))
        .limit(1);

      console.log('✅ Found invitation details:', {
        invitationId: invitation.invitationId,
        email: invitation.email,
        tenantId: invitation.tenantId,
        companyName: tenant.companyName,
        roleName: roleName
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
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error getting invitation details:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to get invitation details'
      });
    }
  });

  // Admin endpoint to get all invitations for an organization
  fastify.get('/admin/:orgCode', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { orgCode } = params;
      
      console.log('🔍 Admin getting invitations for organization:', orgCode);
      
      // Get organization details
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
        return reply.code(404).send({
          error: 'Organization not found',
          message: `No organization found with orgCode: ${orgCode}`
        });
      }

      // Get all invitations for this organization
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

      // Format invitations with invitation URLs
      const formattedInvitations = await Promise.all(invitations.map(async ({ invitation, role, inviter }: { invitation: { invitationId: string; email: string; status: string | null; createdAt: Date | null; expiresAt: Date; acceptedAt: Date | null; invitationUrl: string | null; invitationToken: string }; role: { roleName?: string } | null; inviter: { firstName?: string | null; lastName?: string | null; email?: string | null } | null }) => {
        // Use stored URL if available, otherwise generate a new one
        const invitationUrl = invitation.invitationUrl || await generateInvitationUrl(invitation.invitationToken, request, tenant.tenantId);
        
        // Ensure we always have a URL - this should never be undefined
        if (!invitationUrl) {
          console.warn(`⚠️ No invitation URL found for invitation ${invitation.invitationId}, generating fallback`);
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

      console.log(`✅ Found ${formattedInvitations.length} invitations for organization ${tenant.companyName}`);

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
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error getting admin invitations:', error);
      return reply.code(500).send({
        error: 'Failed to get invitations',
        message: error.message,
        stack: error.stack
      });
    }
  });

  // Admin endpoint to resend invitation email
  fastify.post('/admin/:orgCode/:invitationId/resend', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { orgCode, invitationId } = params;
      
      console.log('📧 Admin resending invitation:', { orgCode, invitationId });
      
      // Get organization details
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
        return reply.code(404).send({
          error: 'Organization not found',
          message: `No organization found with orgCode: ${orgCode}`
        });
      }

      // Get invitation details
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
        return reply.code(404).send({
          error: 'Invitation not found',
          message: 'Invitation not found in this organization'
        });
      }

      if (invitation.invitation.status === 'accepted') {
        return reply.code(400).send({
          error: 'Invitation already accepted',
          message: 'Cannot resend an accepted invitation'
        });
      }

      if (invitation.invitation.expiresAt < new Date()) {
        return reply.code(400).send({
          error: 'Invitation expired',
          message: 'Cannot resend an expired invitation'
        });
      }

      // Resend invitation email
      try {
        // Import EmailService dynamically to avoid circular dependencies
        const EmailService = (await import('../../../utils/email.js')).default;
        
        // Regenerate invitation URL to ensure it uses the correct subdomain
        const invitationUrl = await generateInvitationUrl(invitation.invitation.invitationToken, request, tenant.tenantId);
        
        // Extract organization and location names from invitation
        const organizations = [];
        const locations = [];
        let roleName = invitation.role?.roleName || 'Member';

        // Handle multi-entity invitations
        const targetEntitiesList = (invitation.invitation.targetEntities ?? []) as Array<{ entityId: string; roleId?: string | null }>;
        if (invitation.invitation.invitationScope === 'multi-entity' && targetEntitiesList.length > 0) {
          const roleNames = [];
          for (const targetEntity of targetEntitiesList) {
            // Get entity details
            const [entityRecord] = await db
              .select({
                entityId: entities.entityId,
                entityName: entities.entityName,
                entityType: entities.entityType
              })
              .from(entities)
              .where(eq(entities.entityId, targetEntity.entityId))
              .limit(1);

            // Get role details
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
          // Handle single-entity invitations
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
        
        // Ensure we always have organization information for the email
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
        
        console.log(`✅ Invitation email resent successfully to ${invitation.invitation.email}`);
        
        return {
          success: true,
          message: 'Invitation email resent successfully',
          email: invitation.invitation.email
        };
      } catch (err) {
        const emailError = err as Error;
        console.error(`❌ Failed to resend invitation email to ${invitation.invitation.email}:`, emailError.message);
        
        const fallbackUrl = await generateInvitationUrl(invitation.invitation.invitationToken, request, tenant.tenantId);
        return reply.code(500).send({
          error: 'Failed to resend invitation email',
          message: emailError.message,
          invitationUrl: fallbackUrl
        });
      }
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error resending invitation:', error);
      return reply.code(500).send({
        error: 'Failed to resend invitation',
        message: error.message,
        stack: error.stack
      });
    }
  });

  // Admin endpoint to cancel invitation
  fastify.delete('/admin/:orgCode/:invitationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { orgCode, invitationId } = params;
      
      console.log('❌ Admin canceling invitation:', { orgCode, invitationId });
      
      // Get organization details
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
        return reply.code(404).send({
          error: 'Organization not found',
          message: `No organization found with orgCode: ${orgCode}`
        });
      }

      // Cancel invitation
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
        return reply.code(404).send({
          error: 'Invitation not found',
          message: 'Invitation not found in this organization'
        });
      }

      console.log(`✅ Invitation ${invitationId} cancelled successfully`);

      return {
        success: true,
        message: 'Invitation cancelled successfully',
        invitation: {
          invitationId: updatedInvitation.invitationId,
          email: updatedInvitation.email,
          status: updatedInvitation.status
        }
      };
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error cancelling invitation:', error);
      return reply.code(500).send({
        error: 'Failed to cancel invitation',
        message: error.message,
        stack: error.stack
      });
    }
  });

  // Create invitation for current tenant (authenticated endpoint)
  fastify.post('/create', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { email, roleName = 'Member' } = body;
      
      if (!email) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'email is required'
        });
      }
      
      if (!request.userContext?.isAuthenticated) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const tenantId = request.userContext.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: 'Tenant context required',
          message: 'User must be associated with a tenant'
        });
      }
      
      console.log('📧 Creating invitation for current tenant...', { email, roleName, tenantId });
      
      // Get organization details
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
        return reply.code(404).send({
          error: 'Organization not found',
          message: 'Current user\'s organization not found'
        });
      }

      // Get the current user as inviter
      const inviter = request.userContext;

      // Check if invitation already exists BEFORE creating a role (avoid orphaned roles)
      const [existingInvitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.tenantId, tenant.tenantId),
          eq(tenantInvitations.email, email as string)
        ))
        .limit(1);

      if (existingInvitation) {
        return reply.code(409).send({
          error: 'Invitation already exists',
          message: `An invitation for ${email} already exists in this organization`,
          invitation: existingInvitation
        });
      }

      // Prepare invitation data before the transaction
      const invitationToken = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const invitationUrl = await generateInvitationUrl(invitationToken, request, tenant.tenantId);

      // Resolve invitedBy user ID
      let invitedByUserId: string | undefined = (inviter as { internalUserId?: string; userId?: string }).internalUserId || (inviter as { userId?: string }).userId;
      if (!invitedByUserId) {
        const [inviterUser] = await db
          .select({ userId: tenantUsers.userId })
          .from(tenantUsers)
          .where(eq(tenantUsers.kindeUserId, (inviter as { kindeUserId?: string }).kindeUserId ?? ''))
          .limit(1);
        if (!inviterUser) {
          return reply.code(400).send({
            error: 'Inviter not found',
            message: 'Unable to find inviter user record'
          });
        }
        invitedByUserId = inviterUser.userId;
      }

      // Atomically: get/create role + create invitation
      const { newInvitation, role } = await db.transaction(async (tx) => {
        // Get or create a default role
        let [existingRole] = await tx
          .select()
          .from(customRoles)
          .where(and(
            eq(customRoles.tenantId, tenant.tenantId),
            eq(customRoles.roleName, roleName as string)
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

      console.log('✅ Invitation created successfully:', {
        invitationId: newInvitation.invitationId,
        email: newInvitation.email,
        token: newInvitation.invitationToken,
        url: newInvitation.invitationUrl,
        invitedBy: newInvitation.invitedBy,
        roleId: newInvitation.roleId,
        urlStored: !!newInvitation.invitationUrl,
        urlLength: newInvitation.invitationUrl?.length || 0
      });

      // Send invitation email
      try {
        // Import EmailService dynamically to avoid circular dependencies
        const EmailService = (await import('../../../utils/email.js')).default;
        
        await EmailService.sendUserInvitation({
          email: newInvitation.email,
          tenantName: tenant.companyName,
          roleName: role.roleName,
          invitationToken: invitationUrl, // Pass full URL instead of token
          invitedByName: request.userContext?.name || 'Team Administrator',
          message: (request.body as Record<string, unknown>)?.message as string || `You've been invited to join ${tenant.companyName} as a ${role.roleName}.`,
          organizations: [tenant.companyName], // Include tenant as organization
          invitedDate: new Date(),
          expiryDate: expiresAt ?? undefined
        });

        console.log(`✅ Invitation email sent successfully to ${newInvitation.email}`);
      } catch (err) {
        const emailError = err as Error;
        console.error(`❌ Failed to send invitation email to ${newInvitation.email}:`, emailError.message);
        // Don't fail the invitation creation if email fails
        console.log(`⚠️ Invitation created but email failed. Token: ${newInvitation.invitationToken}`);
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
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error creating invitation:', error);
      return reply.code(500).send({
        error: 'Failed to create invitation',
        message: error.message
      });
    }
  });

  // Create multi-entity invitation (authenticated endpoint)
  fastify.post('/create-multi-entity', {
    // Authentication handled globally, no need for route-level auth
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('🔥 MULTI-ENTITY INVITATION ROUTE CALLED');
      const body = request.body as Record<string, unknown>;
      const { email, entities: rawEntities, primaryEntityId, message } = body;
      const targetEntities = Array.isArray(rawEntities)
        ? rawEntities
        : rawEntities
          ? [rawEntities]
          : [];

      console.log('🔍 Request body destructured:', {
        email,
        entitiesType: Array.isArray(rawEntities) ? 'array' : typeof rawEntities,
        entitiesValue: targetEntities,
        primaryEntityId,
        message,
        fullBody: body
      });

      if (!email) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'email is required'
        });
      }

      if (!targetEntities || targetEntities.length === 0) {
        console.log('🔍 Entities validation failed:', {
          entities: targetEntities,
          isArray: Array.isArray(targetEntities),
          length: targetEntities?.length
        });
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'entities array is required and cannot be empty'
        });
      }

      if (!request.userContext?.isAuthenticated) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const tenantId = request.userContext.tenantId;
      if (!tenantId) {
        return reply.code(400).send({
          error: 'Tenant context required',
          message: 'User must be associated with a tenant'
        });
      }

      console.log('🚀 NEW CODE RUNNING: Creating multi-entity invitation...', {
        email,
        entityCount: targetEntities?.length || 0,
        primaryEntityId,
        tenantId,
        entitiesType: Array.isArray(targetEntities) ? 'array' : typeof targetEntities,
        entitiesValue: targetEntities,
        requestBody: request.body
      });

      // Get tenant details
      console.log('🔍 Querying tenant with ID:', tenantId, typeof tenantId);
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

        console.log('🔍 Executing tenant query...');
        const [tenantRecord] = await query;
        tenant = tenantRecord;
        console.log('✅ Tenant query successful:', tenant);

        if (!tenant) {
          return reply.code(404).send({
            error: 'Organization not found',
            message: 'Current user\'s organization not found'
          });
        }
      } catch (err) {
      const error = err as Error;
        console.error('❌ Tenant query failed:', error);
        throw error;
      }

      // Validate target entities and permissions
      const validatedEntities = [];
      for (const entity of targetEntities) {
        if (!entity.entityId || !entity.roleId) {
          return reply.code(400).send({
            error: 'Invalid entity specification',
            message: 'Each entity must have entityId and roleId'
          });
        }

        // Verify entity exists and belongs to the tenant
        console.log('🔍 Verifying entity:', { entityId: entity.entityId, tenantId });
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

          console.log('🔍 Executing entity verification query...');
          [entityRecord] = await entityQuery;
          console.log('✅ Entity verification successful:', entityRecord);

          if (!entityRecord) {
            return reply.code(404).send({
              error: 'Entity not found',
              message: `Entity ${entity.entityId} not found in this tenant`
            });
          }
        } catch (err) {
      const error = err as Error;
          console.error('❌ Entity verification failed:', error);
          console.error('❌ Entity ID:', entity.entityId);
          console.error('❌ Tenant ID:', tenantId);
          throw error;
        }

        // Verify role exists
        const [roleRecord] = await db
          .select()
          .from(customRoles)
          .where(eq(customRoles.roleId, entity.roleId))
          .limit(1);

        if (!roleRecord) {
          return reply.code(404).send({
            error: 'Role not found',
            message: `Role ${entity.roleId} not found`
          });
        }

        // Validate permissions for this entity
        const permissionCheck = await validateMultiEntityInvitationPermissions(
          request.userContext?.internalUserId ?? '',
          tenant.tenantId,
          [{
            entityId: entity.entityId,
            roleId: entity.roleId,
            entityType: entityRecord.entityType
          }]
        );

        if (!permissionCheck.canInvite) {
          return reply.code(403).send({
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

      // Validate primary entity if specified
      if (primaryEntityId) {
        const isPrimaryValid = validatedEntities.some(e => e.entityId === primaryEntityId);
        if (!isPrimaryValid) {
          return reply.code(400).send({
            error: 'Invalid primary entity',
            message: 'Primary entity must be one of the target entities'
          });
        }
      }

      // Ensure we have at least one entity
      if (validatedEntities.length === 0) {
        return reply.code(400).send({
          error: 'No valid entities',
          message: 'At least one valid entity must be specified'
        });
      }

      // Check if invitation already exists
      const [existingInvitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.tenantId, tenant.tenantId),
          eq(tenantInvitations.email, email as string)
        ))
        .limit(1);

      if (existingInvitation) {
        return reply.code(409).send({
          error: 'Invitation already exists',
          message: `An invitation for ${email} already exists in this organization`,
          invitation: existingInvitation
        });
      }

      // Create the invitation
      const invitationToken = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Generate the full invitation URL using tenant subdomain
      const invitationUrl = await generateInvitationUrl(invitationToken, request, tenant.tenantId);
      
      // Ensure we have a valid URL
      if (!invitationUrl || !invitationUrl.startsWith('http')) {
        console.error('❌ Invalid invitation URL generated for multi-entity invitation:', invitationUrl);
        return reply.code(500).send({
          error: 'Failed to generate invitation URL',
          message: 'Could not generate a valid invitation URL'
        });
      }
      
      console.log('🔗 Generated invitation URL for multi-entity invitation:', {
        invitationUrl,
        token: invitationToken.substring(0, 8) + '...',
        email
      });

      // Try simple raw SQL with string interpolation (temporary workaround)
      // Ensure we have a valid primary entity ID
      const finalPrimaryEntityId = primaryEntityId || validatedEntities[0]?.entityId;
      if (!finalPrimaryEntityId) {
        return reply.code(400).send({
          error: 'Invalid primary entity',
          message: 'Unable to determine primary entity ID'
        });
      }

      // Try a two-step approach: insert without JSONB first, then update
      const dbConnection = dbManager.getAppConnection();

      // Escape the invitation URL for SQL (replace single quotes and backslashes)
      const escapedInvitationUrl = invitationUrl.replace(/'/g, "''").replace(/\\/g, '\\\\');

      // First insert without the JSONB field
      const insertQuery = `
        INSERT INTO tenant_invitations (
          tenant_id, email, invitation_scope, primary_entity_id,
          invited_by, invitation_token, invitation_url, status, expires_at, updated_at
        ) VALUES (
          '${tenant.tenantId}', '${email}', 'multi-entity',
          '${finalPrimaryEntityId}', '${request.userContext.internalUserId}', '${invitationToken}',
          '${escapedInvitationUrl}', 'pending', '${expiresAt.toISOString()}', '${new Date().toISOString()}'
        )
        RETURNING invitation_id, invitation_url
      `;

      console.log('🔍 Step 1 - Inserting base invitation with URL:', {
        email,
        invitationToken: invitationToken.substring(0, 8) + '...',
        invitationUrl: invitationUrl.substring(0, 50) + '...',
        hasUrl: !!invitationUrl
      });

      const insertResult = await dbConnection.unsafe(insertQuery);
      const invitationId = insertResult[0].invitation_id;
      const storedUrl = insertResult[0].invitation_url;
      
      console.log('✅ Base invitation inserted:', {
        invitationId,
        storedUrl: storedUrl ? storedUrl.substring(0, 50) + '...' : 'NULL',
        urlMatches: storedUrl === invitationUrl
      });

      // Now update with JSONB
      const targetEntitiesJson = JSON.stringify(validatedEntities).replace(/'/g, "''").replace(/\\/g, '\\\\');
      const updateQuery = `
        UPDATE tenant_invitations
        SET target_entities = '${targetEntitiesJson}'::jsonb
        WHERE invitation_id = '${invitationId}'
        RETURNING *
      `;

      console.log('🔍 Step 2 - Updating with JSONB');

      const updateResult = await dbConnection.unsafe(updateQuery);
      const newInvitation = updateResult[0];
      
      // Verify the URL was stored correctly
      if (!newInvitation.invitation_url) {
        console.error('❌ WARNING: Invitation URL was not stored! Attempting to update...');
        // Try to update the URL again
        const urlUpdateQuery = `
          UPDATE tenant_invitations
          SET invitation_url = '${escapedInvitationUrl}'
          WHERE invitation_id = '${invitationId}'
          RETURNING invitation_url
        `;
        const urlUpdateResult = await dbConnection.unsafe(urlUpdateQuery);
        newInvitation.invitation_url = urlUpdateResult[0]?.invitation_url || invitationUrl;
        console.log('✅ URL updated:', newInvitation.invitation_url ? 'SUCCESS' : 'FAILED');
      }

      console.log('✅ Multi-entity invitation created successfully:', {
        invitationId: newInvitation.invitation_id,
        email: newInvitation.email,
        token: newInvitation.invitation_token,
        url: newInvitation.invitation_url,
        targetEntities: validatedEntities.length
      });

      // Send invitation email
      console.log(`📧 Preparing to send multi-entity invitation email to ${newInvitation.email}`);
      try {
        // Import EmailService dynamically to avoid circular dependencies
        const EmailService = (await import('../../../utils/email.js')).default;

        // Extract organization names, locations, and role names from validated entities
        const organizations = [];
        const locations = [];
        const roleNames = [];

        for (const entity of validatedEntities) {
          // Get entity details
          const [entityRecord] = await db
            .select({
              entityId: entities.entityId,
              entityName: entities.entityName,
              entityType: entities.entityType
            })
            .from(entities)
            .where(eq(entities.entityId, entity.entityId))
            .limit(1);

          // Get role details
          const [roleRecord] = await db
            .select({
              roleId: customRoles.roleId,
              roleName: customRoles.roleName,
              description: customRoles.description
            })
            .from(customRoles)
            .where(eq(customRoles.roleId, entity.roleId))
            .limit(1);

          console.log(`🔍 Entity ${entity.entityId} - Role lookup:`, {
            entityId: entity.entityId,
            roleId: entity.roleId,
            roleRecord: roleRecord ? {
              roleId: roleRecord.roleId,
              roleName: roleRecord.roleName
            } : null,
            entityRecord: entityRecord ? {
              entityId: entityRecord.entityId,
              entityName: entityRecord.entityName,
              entityType: entityRecord.entityType
            } : null
          });

          if (entityRecord) {
            // Get the actual role name from the role record
            let roleName = null;
            if (roleRecord && roleRecord.roleName) {
              roleName = roleRecord.roleName;
            } else {
              console.warn(`⚠️ Role not found for roleId: ${entity.roleId}, entityId: ${entity.entityId}`);
              // Don't add 'Member' as default - only add if we have a valid role
              // This ensures we can detect missing roles
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
            console.warn(`⚠️ Entity not found: ${entity.entityId}`);
          }
        }

        // Determine primary role name (use first role or most common)
        // If we have role names, use the first one (or combine if multiple)
        // Only default to 'Member' if we truly have no role names (should not happen if validation passed)
        let primaryRoleName = 'Member';
        if (roleNames.length > 0) {
          // Remove duplicates and use the first unique role name
          const uniqueRoleNames = [...new Set(roleNames)];
          if (uniqueRoleNames.length === 1) {
            primaryRoleName = uniqueRoleNames[0];
          } else {
            // Multiple different roles - show first one with count
            primaryRoleName = `${uniqueRoleNames[0]} (${uniqueRoleNames.length} roles)`;
          }
        } else {
          console.error('⚠️ No role names found for invitation! This should not happen if validation passed.');
          // Fallback: try to get role name from first validated entity directly
          if (validatedEntities.length > 0 && validatedEntities[0].roleId) {
            const [fallbackRole] = await db
              .select({ roleName: customRoles.roleName })
              .from(customRoles)
              .where(eq(customRoles.roleId, validatedEntities[0].roleId))
              .limit(1);
            if (fallbackRole && fallbackRole.roleName) {
              primaryRoleName = fallbackRole.roleName;
              console.log(`✅ Recovered role name from fallback lookup: ${primaryRoleName}`);
            }
          }
        }

        console.log(`📧 Email details:`, {
          email: newInvitation.email,
          tenantName: tenant.companyName,
          roleName: primaryRoleName,
          roleNamesArray: roleNames,
          organizations: organizations,
          locations: locations,
          invitationToken: newInvitation.invitation_token.substring(0, 8) + '...',
          invitationUrl: invitationUrl,
          invitedByName: request.userContext.name || 'Team Administrator',
          entityCount: validatedEntities.length,
          validatedEntities: validatedEntities.map(e => ({
            entityId: e.entityId,
            roleId: e.roleId,
            entityType: e.entityType
          }))
        });

        // Ensure we always have organization information for multi-entity invitations
        const emailOrganizations = organizations.length > 0 ? organizations : [tenant.companyName];
        const emailLocations = locations.length > 0 ? locations : undefined;

        // Determine primary organization name (from primary entity or first organization)
        let primaryOrganizationName = null;
        if (finalPrimaryEntityId && organizations.length > 0) {
          // Find the organization name for the primary entity
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

        console.log(`📧 Primary organization name determined:`, {
          primaryOrganizationName,
          organizations,
          finalPrimaryEntityId,
          hasOrganizations: organizations.length > 0
        });

        const emailResult = await EmailService.sendUserInvitation({
          email: newInvitation.email,
          tenantName: tenant.companyName,
          roleName: primaryRoleName,
          invitationToken: invitationUrl, // Pass full URL instead of token
          invitedByName: request.userContext.name || 'Team Administrator',
          message: (request.body as Record<string, unknown>)?.message as string || `You've been invited to join ${tenant.companyName} with access to ${validatedEntities.length} organization${validatedEntities.length > 1 ? 's' : ''} as a ${primaryRoleName}.`,
          organizations: emailOrganizations,
          locations: emailLocations,
          primaryOrganizationName: primaryOrganizationName ?? undefined,
          invitedDate: new Date(),
          expiryDate: expiresAt ?? undefined
        });

        console.log(`✅ Multi-entity invitation email sent successfully to ${newInvitation.email}:`, emailResult);
      } catch (err) {
        const emailError = err as Error & { response?: { data?: unknown } };
        console.error(`❌ Failed to send multi-entity invitation email to ${newInvitation.email}:`, {
          error: emailError.message,
          stack: emailError.stack,
          response: emailError.response?.data
        });

        // Don't fail the entire invitation process if email fails
        console.log(`⚠️ Multi-entity invitation created but email failed. Token: ${(newInvitation as { invitation_token?: string }).invitation_token}`);
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
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error creating multi-entity invitation:', error);
      return reply.code(500).send({
        error: 'Failed to create multi-entity invitation',
        message: error.message
      });
    }
  });

  // Get invitation details by token - PUBLIC ENDPOINT
  fastify.get('/details-by-token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { token } = query;
      
      if (!token) {
        return reply.code(400).send({
          error: 'Missing required parameters',
          message: 'token parameter is required'
        });
      }

      console.log('🔍 Getting invitation details by token:', { token });

      // Find invitation by token first
      let [invitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.invitationToken, token),
          eq(tenantInvitations.status, 'pending')
        ))
        .limit(1);

      // If not found and token looks like a UUID (e.g. invitation id used by mistake), try by invitation_id
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
          console.log('🔍 Found invitation by invitation_id (token was UUID):', invitation.invitationId);
        }
      }

      if (!invitation) {
        console.log('❌ Invitation not found for token:', token);
        return reply.code(404).send({
          error: 'Invitation not found',
          message: 'Invalid or expired invitation token'
        });
      }

      // Check if invitation has expired
      if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
        console.log('❌ Invitation expired for token:', token);
        return reply.code(410).send({
          error: 'Invitation expired',
          message: 'This invitation has expired'
        });
      }

      // Get organization details
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
        return reply.code(404).send({
          error: 'Organization not found'
        });
      }

      // Get inviter details
      const [inviter] = await db
        .select({
          name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
          email: tenantUsers.email
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, invitation.invitedBy))
        .limit(1);

      // Handle multi-entity vs single-entity invitation details
      let invitationDetails;
      const targetEntitiesArr = (invitation.targetEntities ?? []) as Array<{ entityId: string; roleId?: string | null; entityType?: string | null }>;
      if (invitation.invitationScope === 'multi-entity' && targetEntitiesArr.length > 0) {
        // Multi-entity invitation - get details for each target entity
        const targetEntityDetails = [];

        for (const targetEntity of targetEntitiesArr) {
          // Get entity details
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

          // Get role details for this entity
          const [role] = await db
            .select({
              roleName: customRoles.roleName,
              description: customRoles.description
            })
            .from(customRoles)
            .where(eq(customRoles.roleId, targetEntity.roleId as string))
            .limit(1);

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
        // Legacy single-entity invitation
        const [role] = await db
          .select({
            roleName: customRoles.roleName,
            description: customRoles.description
          })
          .from(customRoles)
          .where(eq(customRoles.roleId, invitation.roleId as string))
          .limit(1);

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
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error getting invitation details by token:', error);
      return reply.code(500).send({
        error: 'Failed to get invitation details',
        message: error.message
      });
    }
  });

  // Accept invitation by token - PUBLIC ENDPOINT
  fastify.post('/accept-by-token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { token, kindeUserId } = body;
      
      if (!token || !kindeUserId) {
        return reply.code(400).send({
          error: 'Missing required fields',
          message: 'token and kindeUserId are required'
        });
      }

      console.log('✅ Accepting invitation by token:', { token, kindeUserId });

      // Find invitation by token in tenantInvitations table
      const tokenStr = token as string;
      let [invitation] = await db
        .select()
        .from(tenantInvitations)
        .where(eq(tenantInvitations.invitationToken, tokenStr))
        .limit(1);

      // If not found and token looks like a UUID (invitation id), try by invitation_id
      if (!invitation && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(tokenStr).trim())) {
        [invitation] = await db
          .select()
          .from(tenantInvitations)
          .where(eq(tenantInvitations.invitationId, tokenStr))
          .limit(1);
        if (invitation) {
          console.log('🔍 Found invitation by invitation_id for accept:', invitation.invitationId);
        }
      }

      if (!invitation) {
        console.log('❌ Invitation not found for token:', token);
        return reply.code(404).send({
          error: 'Invitation not found',
          message: 'Invalid or expired invitation token'
        });
      }

      // Check if invitation has already been accepted
      if (invitation.status === 'accepted') {
        console.log('ℹ️ Invitation already accepted:', invitation.invitationId);
        
        // Check if user already exists and return success
        const [existingUser] = await db
          .select()
          .from(tenantUsers)
          .where(and(
            eq(tenantUsers.email, invitation.email),
            eq(tenantUsers.tenantId, invitation.tenantId)
          ))
          .limit(1);

        if (existingUser) {
          return reply.code(200).send({
            success: true,
            message: 'Invitation already accepted',
            userId: existingUser.userId,
            email: existingUser.email
          });
        }
      }

      // Ensure invitation is pending
      if (invitation.status !== 'pending') {
        console.log('❌ Invitation is not pending:', invitation.status);
        return reply.code(400).send({
          error: 'Invitation not available',
          message: `Invitation status is ${invitation.status}, cannot accept`
        });
      }

      // Check if invitation has expired
      if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
        console.log('❌ Invitation expired for token:', token);
        return reply.code(410).send({
          error: 'Invitation expired',
          message: 'This invitation has expired'
        });
      }

      // Get organization details
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
        return reply.code(404).send({
          error: 'Organization not found'
        });
      }

      // Collect role assignments so we can publish role_assigned to other apps
      const roleAssignmentsToPublish = [];

      // CRITICAL: Ensure user is in the correct organization(s)
      console.log('🔗 Ensuring user is in correct Kinde organizations for invitation...');

      // For multi-entity invitations, add user to each specified organization/location
      const targetEntitiesList = (invitation.targetEntities ?? []) as Array<{ entityId: string; entityType?: string }>;
      if (invitation.invitationScope === 'multi-entity' && targetEntitiesList.length > 0) {
        console.log('🎯 Processing multi-entity invitation with', targetEntitiesList.length, 'target entities');

        // Collect unique organization IDs from target entities
        const targetOrgIds = new Set<string>();

        for (const entity of targetEntitiesList) {
          if (entity.entityId) {
            // Get the organization that contains this entity (could be a location or organization)
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
              // If it's a location, get its parent organization
              // If it's already an organization, use it directly

              if (entityRecord.entityType === 'location' && entityRecord.parentEntityId) {
                // For locations, we need the parent organization
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
                  console.log('🏢 Added parent organization for location:', parentOrg.kindeOrgId);
                }
              } else if (entityRecord.entityType === 'organization') {
                // For organizations, get the tenant's Kinde org ID
                targetOrgIds.add(tenant.kindeOrgId);
                console.log('🏢 Added direct organization:', tenant.kindeOrgId);
              }
            }
          }
        }

        // Add user to each unique organization
        const uniqueOrgIds = Array.from(targetOrgIds);
        console.log('🎯 Adding user to', uniqueOrgIds.length, 'unique organizations:', uniqueOrgIds);

        for (const orgId of uniqueOrgIds) {
          try {
            console.log('🔗 Adding user to organization:', orgId);
            const orgResult = await ensureUserInCorrectOrganization(
              kindeUserId as string,
              invitation.email,
              orgId as string
            );

            if (orgResult.success) {
              console.log('✅ Successfully added user to organization:', orgId);
            } else {
              console.warn('⚠️ Failed to add user to organization:', orgId, orgResult);
            }
          } catch (orgError) {
            console.warn('⚠️ Error adding user to organization:', orgId, (orgError as Error).message);
          }
        }
      } else {
        // Single-entity or legacy invitation - add to tenant's default organization
        console.log('🏢 Processing single-entity invitation, adding to tenant organization:', tenant.kindeOrgId);

        try {
          // Try with the full org code first, then try without 'org_' prefix if it fails
          let orgResult = await ensureUserInCorrectOrganization(
            kindeUserId as string,
            invitation.email,
            tenant.kindeOrgId // Use the organization's Kinde org ID
          );

          // If the first attempt fails and the org code starts with 'org_', try without the prefix
          if (!orgResult.success && tenant.kindeOrgId.startsWith('org_')) {
            const orgCodeWithoutPrefix = tenant.kindeOrgId.replace('org_', '');
            console.log('🔄 Retrying with org code without prefix:', orgCodeWithoutPrefix);
            orgResult = await ensureUserInCorrectOrganization(
              kindeUserId as string,
              invitation.email,
              orgCodeWithoutPrefix
            );
          }

          if (orgResult.success) {
            console.log('✅ User organization assignment completed:', orgResult);
          } else {
            console.warn('⚠️ Kinde organization assignment failed, but continuing:', orgResult);
            console.log('ℹ️ This is expected if your M2M client lacks organization management permissions');
          }
        } catch (orgError) {
          console.warn('⚠️ Kinde organization assignment threw error, but continuing:', (orgError as Error).message);
          console.log('ℹ️ This is expected if your M2M client lacks organization management permissions');
        }
      }

      // Always continue with invitation acceptance regardless of Kinde org assignment status
      console.log('✅ Proceeding with invitation acceptance - user will be properly set up in internal system');

      // Check if user already exists (from legacy invitation system)
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
        // Update existing user record (from legacy invitation)
        console.log('✅ Updating existing user record:', existingUser.userId);
        
        // Get existing preferences or create new object
        const existingPreferences = existingUser.preferences || {};
        
        [newUser] = await db
          .update(tenantUsers)
          .set({
            kindeUserId: kindeUserId as string,
            isActive: true,
            onboardingCompleted: true, // ✅ INVITED USERS SKIP ONBOARDING
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

        // Publish invitation-accepted event to all applications (existing user path)
        try {
          const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
          const firstName = newUser.firstName || '';
          const lastName = newUser.lastName || '';
          await snsSqsPublisher.publishUserEventToSuite('user_invitation_accepted', invitation.tenantId, newUser.userId, {
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
          console.log('📡 Published user_invitation_accepted event to all applications (existing user)');
        } catch (publishErr) {
          console.warn('⚠️ Failed to publish user_invitation_accepted (existing user):', (publishErr as Error).message);
        }
      } else {
        // Create new user record
        console.log('✅ Creating new user record:', {
          email: invitation.email,
          kindeUserId: kindeUserId,
          tenantId: invitation.tenantId,
          invitedBy: invitation.invitedBy
        });
        [newUser] = await db
          .insert(tenantUsers)
          .values({
            tenantId: invitation.tenantId,
            kindeUserId: kindeUserId as string,
            email: invitation.email, // FIXED: Email is properly set
            name: invitation.email.split('@')[0], // Use email prefix as name
            isActive: true,
            onboardingCompleted: true, // ✅ INVITED USERS SKIP ONBOARDING
            isTenantAdmin: false, // Invited users are never admins
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
        
        console.log('✅ User created successfully:', {
          userId: newUser.userId,
          email: newUser.email,
          kindeUserId: newUser.kindeUserId,
          tenantId: newUser.tenantId,
          isActive: newUser.isActive
        });

        // Publish user creation event to Redis streams
        try {
          const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
          // Build firstName and lastName from schema columns
          const firstName = newUser.firstName || '';
          const lastName = newUser.lastName || '';

          await snsSqsPublisher.publishUserEventToSuite('user_created', invitation.tenantId, newUser.userId, {
            userId: newUser.userId,
            email: newUser.email,
            kindeUserId: newUser.kindeUserId,
            firstName: firstName,
            lastName: lastName,
            name: `${firstName} ${lastName}`.trim() || newUser.email || '',
            isActive: newUser.isActive !== undefined ? newUser.isActive : true,
            createdAt: newUser.createdAt ? (typeof newUser.createdAt === 'string' ? newUser.createdAt : newUser.createdAt.toISOString()) : new Date().toISOString()
          });
          console.log('📡 Published user_created event to AWS MQ');
          // Also publish invitation-accepted so all applications get a consistent event
          await snsSqsPublisher.publishUserEventToSuite('user_invitation_accepted', invitation.tenantId, newUser.userId, {
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
          console.log('📡 Published user_invitation_accepted event to all applications (new user)');
        } catch (streamError) {
          console.warn('⚠️ Failed to publish user creation event to AWS MQ:', (streamError as Error).message);
          // Don't fail the user creation if stream publishing fails
        }
      }

      // Handle role/entity assignments based on invitation type
      const acceptTargetEntities = (invitation.targetEntities ?? []) as Array<{ entityId: string; roleId?: string | null; entityType?: string; membershipType?: string }>;
      const orgAssignmentsToPublish: Array<{ entityId: string; isPrimary: boolean }> = [];
      if (invitation.invitationScope === 'multi-entity' && acceptTargetEntities.length > 0) {
        // Multi-entity invitation - create memberships for each target entity
        console.log('🎯 Processing multi-entity invitation with', acceptTargetEntities.length, 'target entities');

        const memberships: unknown[] = [];
        const assignedRoleIds = new Set<string>(); // Track unique role IDs to avoid duplicates
        
        for (const targetEntity of acceptTargetEntities) {
          // Check if membership already exists for this user and entity
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
            console.log('ℹ️ Membership already exists for user and entity, skipping duplicate:', {
              userId: newUser.userId,
              entityId: targetEntity.entityId,
              membershipId: existingMembership.membershipId
            });
            memberships.push(existingMembership);
            orgAssignmentsToPublish.push({ entityId: targetEntity.entityId, isPrimary: targetEntity.entityId === invitation.primaryEntityId });
            
            // Still ensure role assignment exists
            if (targetEntity.roleId && !assignedRoleIds.has(targetEntity.roleId)) {
              // Check if role assignment already exists
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
                  console.log('✅ Assigned role to user:', {
                    userId: newUser.userId,
                    roleId: targetEntity.roleId
                  });
                } catch (err) {
                  const roleError = err as Error & { code?: string };
                  if (roleError.code !== '23505') { // PostgreSQL unique constraint violation
                    console.warn('⚠️ Failed to assign role:', roleError.message);
                  } else {
                    console.log('ℹ️ Role already assigned, skipping duplicate');
                  }
                }
              } else {
                console.log('ℹ️ Role assignment already exists, skipping duplicate');
                assignedRoleIds.add(targetEntity.roleId);
                roleAssignmentsToPublish.push(existingRoleAssignment);
              }
            }
            continue; // Skip creating duplicate membership
          }

          // Create organization membership for each target entity
          try {
            const [membership] = await db
              .insert(organizationMemberships)
              .values({
                userId: newUser.userId,
                tenantId: invitation.tenantId,
                entityId: targetEntity.entityId,
                entityType: (targetEntity as { entityType?: string }).entityType ?? 'organization',
                roleId: targetEntity.roleId,
                roleName: null, // Will be set by trigger or separate query
                membershipType: (targetEntity as { membershipType?: string }).membershipType || 'direct',
                membershipStatus: 'active',
                isPrimary: targetEntity.entityId === invitation.primaryEntityId,
                canAccessSubEntities: true, // Default for invited users
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
            console.log('✅ Created membership for entity:', targetEntity.entityId);
          } catch (err) {
            const membershipError = err as Error & { code?: string };
            // If membership already exists (race condition), that's okay
            if (membershipError.code === '23505') { // PostgreSQL unique constraint violation
              console.log('ℹ️ Membership already exists (race condition), skipping duplicate');
              // Try to fetch the existing membership
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
              console.error('❌ Failed to create membership:', (membershipError as Error).message);
              throw membershipError;
            }
          }

          // Also create userRoleAssignments entry so roles show up in user details
          // Only create if we haven't already assigned this roleId
          if (targetEntity.roleId && !assignedRoleIds.has(targetEntity.roleId)) {
            // Check if role assignment already exists
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
                console.log('✅ Assigned role to user:', {
                  userId: newUser.userId,
                  roleId: targetEntity.roleId
                });
              } catch (err) {
                const roleError = err as Error & { code?: string };
                // If role assignment already exists, that's okay
                if (roleError.code !== '23505') { // PostgreSQL unique constraint violation
                  console.warn('⚠️ Failed to assign role:', roleError.message);
                } else {
                  console.log('ℹ️ Role already assigned, skipping duplicate');
                  if (targetEntity.roleId) assignedRoleIds.add(targetEntity.roleId);
                }
              }
            } else {
              console.log('ℹ️ Role assignment already exists, skipping duplicate');
              if (targetEntity.roleId) assignedRoleIds.add(targetEntity.roleId);
              roleAssignmentsToPublish.push(existingRoleAssignment);
            }
          }
        }

        // Update user's primary organization
        if (invitation.primaryEntityId) {
          await db
            .update(tenantUsers)
            .set({
              primaryOrganizationId: invitation.primaryEntityId as string,
              updatedAt: new Date()
            } as any)
            .where(eq(tenantUsers.userId, newUser.userId));
          console.log('✅ Set primary organization to:', invitation.primaryEntityId);
        }

      } else {
        // Single-entity invitation - assign role and create organization membership
        console.log('📋 Processing single-entity invitation');

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
          console.log('✅ Assigned role to user:', {
            userId: newUser.userId,
            roleId: invitation.roleId,
            assignedBy: invitation.invitedBy
          });
        } else {
          console.warn('⚠️ No roleId in invitation for single-entity invitation');
        }

        // Create organization membership - use primaryEntityId if available, otherwise find root organization
        let targetEntityId = invitation.primaryEntityId;

        // If no primaryEntityId, find the root organization for this tenant
        if (!targetEntityId) {
          const [tenantEntity] = await db
            .select({
              entityId: entities.entityId
            })
            .from(entities)
            .where(and(
              eq(entities.tenantId, invitation.tenantId),
              eq(entities.entityType, 'organization'),
              isNull(entities.parentEntityId) // Root organization
            ))
            .limit(1);

          if (tenantEntity) {
            targetEntityId = tenantEntity.entityId;
          }
        }

        if (targetEntityId) {
          // Check if membership already exists for this user and entity
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
            console.log('ℹ️ Membership already exists for user and entity, skipping duplicate:', {
              userId: newUser.userId,
              entityId: targetEntityId,
              membershipId: existingMembership.membershipId
            });
            orgAssignmentsToPublish.push({ entityId: targetEntityId, isPrimary: true });
          } else {
            // Get entity type for the target entity
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
                  entityId: targetEntityId, // FIXED: Use targetEntityId instead of invitation.primaryEntityId
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
              console.log('✅ Created organization membership:', {
                membershipId: membership.membershipId,
                entityId: targetEntityId,
                entityType: entityType,
                roleId: invitation.roleId
              });
            } catch (err) {
              const membershipError = err as Error & { code?: string };
              // If membership already exists (race condition), that's okay
              if (membershipError.code === '23505') { // PostgreSQL unique constraint violation
                console.log('ℹ️ Membership already exists (race condition), skipping duplicate');
                orgAssignmentsToPublish.push({ entityId: targetEntityId, isPrimary: true });
              } else {
                console.error('❌ Failed to create membership:', (membershipError as Error).message);
                throw membershipError;
              }
            }
          }

          // Ensure role assignment exists (check before creating)
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
                console.log('✅ Assigned role to user:', {
                  userId: newUser.userId,
                  roleId: invitation.roleId,
                  assignedBy: invitation.invitedBy
                });
              } catch (err) {
                const roleError = err as Error & { code?: string };
                // If role assignment already exists, that's okay
                if (roleError.code !== '23505') { // PostgreSQL unique constraint violation
                  console.warn('⚠️ Failed to assign role:', roleError.message);
                } else {
                  console.log('ℹ️ Role already assigned, skipping duplicate');
                }
              }
            } else {
              console.log('ℹ️ Role assignment already exists, skipping duplicate');
              roleAssignmentsToPublish.push(existingRoleAssignment);
            }
          }

          // Update user's primary organization
          await db
            .update(tenantUsers)
            .set({
              primaryOrganizationId: targetEntityId,
              updatedAt: new Date()
            } as any)
            .where(eq(tenantUsers.userId, newUser.userId));
          
          console.log('✅ Set primary organization to:', targetEntityId);
        } else {
          console.warn('⚠️ No target entity found for single-entity invitation');
        }
      }

      // Publish role_assigned to other apps so invited user has the role in CRM, Ops, Accounting, etc.
      if (roleAssignmentsToPublish.length > 0) {
        try {
          const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
          for (const a of roleAssignmentsToPublish) {
            await snsSqsPublisher.publishRoleEventToSuite('role_assigned', invitation.tenantId, a.roleId, {
              assignmentId: a.id,
              userId: newUser.userId,
              roleId: a.roleId,
              assignedAt: a.assignedAt ? (typeof a.assignedAt === 'string' ? a.assignedAt : a.assignedAt.toISOString()) : new Date().toISOString(),
              assignedBy: invitation.invitedBy,
              expiresAt: (a as { expiresAt?: Date | string }).expiresAt,
              entityId: (a as { organizationId?: string }).organizationId
            });
          }
          console.log('📡 Published role_assigned events for invitation acceptance:', roleAssignmentsToPublish.length);
        } catch (publishError) {
          console.warn('⚠️ Failed to publish role assignment events (invitation accept):', (publishError as Error).message);
        }
      }

      // Publish organization.assignment.created so FA creates wrapper_employee_org_assignments
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
          console.log('📡 Published organization.assignment.created events for invitation acceptance:', orgAssignmentsToPublish.length);
        } catch (publishError) {
          console.warn('⚠️ Failed to publish organization assignment events (invitation accept):', (publishError as Error).message);
        }
      }

      // Keep auth middleware caches coherent after invitation acceptance mutations.
      invalidateRoleCache(newUser.userId);
      if (newUser.kindeUserId) {
        invalidateUserCache(newUser.kindeUserId);
      }

      // Atomically mark invitation as accepted — if this fails, the handler
      // returns 500 and the user can retry. Without the transaction, earlier
      // writes (user creation, memberships) would be committed but the invitation
      // would stay 'pending', causing duplicate acceptance on retry.
      await db.transaction(async (tx) => {
        await tx
          .update(tenantInvitations)
          .set({
            status: 'accepted',
            acceptedAt: new Date()
          } as any)
          .where(and(
            eq(tenantInvitations.invitationId, invitation.invitationId),
            eq(tenantInvitations.status, 'pending') // guard against double-accept
          ));
      });

      console.log('✅ Invitation accepted successfully by token:', {
        userId: newUser.userId,
        email: newUser.email,
        tenantId: newUser.tenantId,
        kindeUserId: newUser.kindeUserId,
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
    } catch (err) {
      const error = err as Error;
      console.error('❌ Error accepting invitation by token:', error);
      return reply.code(500).send({
        error: 'Failed to accept invitation',
        message: error.message
      });
    }
  });
} 