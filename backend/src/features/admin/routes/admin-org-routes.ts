import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, dbManager } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments, entities, tenantInvitations } from '../../../db/schema/index.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import EmailService from '../../../utils/email.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { checkUserLimit } from '../../../middleware/restrictions/planRestrictions.js';
import Logger from '../../../utils/logger.js';
import { shouldLogVerbose } from '../../../utils/verbose-log.js';

/**
 * Flatten hierarchical permissions object {app: {module: [ops]}} into
 * an array of dotted strings like ["app.module.op", ...].
 * Also handles the legacy {app: {operations: [...], level: "..."}} shape.
 */
function flattenHierarchicalPermissions(perms: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [app, appVal] of Object.entries(perms)) {
    if (app === 'metadata' || app === 'inheritance' || app === 'restrictions') continue;
    if (!appVal || typeof appVal !== 'object') continue;

    const appObj = appVal as Record<string, unknown>;

    // Legacy shape: {operations: string[], level: string}
    if (Array.isArray(appObj.operations)) {
      (appObj.operations as string[]).forEach(op => out.push(op));
      continue;
    }

    // Hierarchical shape: {module: [operations]}
    for (const [mod, modVal] of Object.entries(appObj)) {
      if (Array.isArray(modVal)) {
        (modVal as string[]).forEach(op => out.push(`${app}.${mod}.${op}`));
      }
    }
  }
  return out;
}

type ReqWithUser = FastifyRequest & { userContext?: Record<string, unknown> };

export default async function adminOrgRoutes(fastify: FastifyInstance): Promise<void> {
  // Debug auth status endpoint
  fastify.get('/auth-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const req = request as ReqWithUser;
    try {
      console.log('🔍 Admin Auth Status Check');
      console.log('📋 Request User Context:', {
        isAuthenticated: req.userContext?.isAuthenticated,
        userId: req.userContext?.userId,
        internalUserId: req.userContext?.internalUserId,
        tenantId: req.userContext?.tenantId,
        email: req.userContext?.email,
        isTenantAdmin: req.userContext?.isTenantAdmin
      });

      // If user is not authenticated, return basic status
      if (!req.userContext?.isAuthenticated) {
        console.log('❌ User not authenticated, returning basic status');
        return {
          success: true,
          authStatus: {
            isAuthenticated: false
          }
        };
      }

      // Get user permissions and roles
      let userPermissions: any[] = [];
      let userRoles: any[] = [];
      let legacyPermissions: any[] = []; // Simple permission names - declare at proper scope

      console.log('🔍 Fetching user permissions for:', {
        internalUserId: req.userContext?.internalUserId,
        tenantId: req.userContext?.tenantId
      });

      if (req.userContext?.internalUserId && req.userContext?.tenantId) {
        try {
          // Get user roles
          const roles = await db
            .select({
              roleId: customRoles.roleId,
              roleName: customRoles.roleName,
              description: customRoles.description,
              permissions: customRoles.permissions,
              isSystemRole: customRoles.isSystemRole
            })
            .from(userRoleAssignments)
            .leftJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
            .where(eq(userRoleAssignments.userId, req.userContext.internalUserId));

          userRoles = roles;
          console.log('📝 User roles found:', userRoles.map(r => ({
            roleId: r.roleId,
            roleName: r.roleName,
            isSystemRole: r.isSystemRole,
            hasPermissions: !!r.permissions
          })));

          // Aggregate permissions from all roles

          for (const role of roles) {
            console.log(`🔍 Processing role: ${role.roleName} (${role.roleId})`);

            if (role.permissions) {
              let rolePermissions;
              try {
                // Handle both object and string data types
                if (typeof role.permissions === 'object' && role.permissions !== null) {
                  rolePermissions = role.permissions;
                } else if (typeof role.permissions === 'string' && role.permissions) {
                  rolePermissions = JSON.parse(role.permissions);
                } else {
                  rolePermissions = {};
                }

                // Ensure rolePermissions is always an object
                if (!rolePermissions || typeof rolePermissions !== 'object') {
                  rolePermissions = {};
                }

                console.log(`📋 Raw permissions for role ${role.roleName}:`, Object.keys(rolePermissions || {}));
              } catch (parseErr: unknown) {
                const parseError = parseErr as Error;
                console.error(`❌ Failed to parse permissions for role ${role.roleName}:`, parseError);
                continue;
              }

              // Merge permissions - ensure rolePermissions is an object
              if (rolePermissions && typeof rolePermissions === 'object') {
                // Flatten hierarchical permissions: {app: {module: [operations]}}
                const flattenedOps = flattenHierarchicalPermissions(rolePermissions);

                if (shouldLogVerbose()) {
                  console.log(`🔍 Flattened ${flattenedOps.length} operations from role ${role.roleName}`);
                }

                flattenedOps.forEach((operation: string) => {
                  const permissionExists = userPermissions.find(p => p.name === operation);
                  if (!permissionExists) {
                    const parts = operation.split('.');
                    const [app, mod, action] = parts.length >= 3 ? parts : [parts[0], parts[1] ?? '', parts[2] ?? ''];
                    userPermissions.push({
                      id: operation,
                      name: operation,
                      description: `${action} access to ${mod} in ${app}`,
                      resource: mod || app,
                      level: 'granted',
                      app,
                      module: mod,
                      action
                    });
                  }

                  const simplePermName = operation.split('.').pop();
                  if (simplePermName && !legacyPermissions.includes(simplePermName)) {
                    legacyPermissions.push(simplePermName);
                  }
                });
              }
            }
          }

          console.log(`📊 Total permissions aggregated: ${userPermissions.length}`);
          console.log(`📊 Legacy permissions: ${legacyPermissions.length}`);

        } catch (permissionError: unknown) {
          console.error('❌ Error fetching user permissions:', permissionError);
        }
      }

      // Check if user is invited and get onboarding state from DB (source of truth)
      let isInvitedUser = false;
      let userType = 'REGULAR_USER';
      let needsOnboarding = req.userContext?.needsOnboarding ?? true;
      let onboardingCompleted = req.userContext?.onboardingCompleted ?? false;

      if (req.userContext?.internalUserId && req.userContext?.tenantId) {
        try {
          const [user] = await db
            .select()
            .from(tenantUsers)
            .where(eq(tenantUsers.userId, req.userContext!.internalUserId))
            .limit(1);

          if (user) {
            const u = user as Record<string, unknown>;
            const prefs = u.preferences as Record<string, unknown> | undefined;
            isInvitedUser = prefs?.userType === 'INVITED_USER' ||
                          prefs?.isInvitedUser === true ||
                          (u.invitedBy as unknown) !== null ||
                          (u.invitedAt as unknown) !== null;

            if (isInvitedUser && !user.isTenantAdmin) {
              userType = 'INVITED_USER';
            } else if (user.onboardingCompleted) {
              userType = 'EXISTING_USER';
            }
            // Use DB as source of truth so auth-status matches onboarding state
            onboardingCompleted = user.onboardingCompleted === true;
            needsOnboarding = !onboardingCompleted;
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.error('Error checking invited user status:', error);
        }
      }

      return {
        success: true,
        authStatus: {
          isAuthenticated: true,
          userId: req.userContext?.userId,
          internalUserId: req.userContext?.internalUserId,
          tenantId: req.userContext?.tenantId,
          email: req.userContext?.email,
          isTenantAdmin: req.userContext?.isTenantAdmin,
          needsOnboarding,
          onboardingCompleted,
          isInvitedUser: isInvitedUser && !req.userContext?.isTenantAdmin,
          userType: userType,
          userPermissions,
          userRoles,
          legacyPermissions
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error in auth status check:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get auth status',
        message: error.message
      });
    }
  });

  // Get user's accessible tenants
  fastify.get('/user-tenants', async (request, reply) => {
    try {
      console.log('🏢 Getting user tenants for:', request.userContext?.email);

      if (!request.userContext?.isAuthenticated) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get all tenants the user has access to
      const userTenants = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          isActive: tenants.isActive
        })
        .from(tenants)
        .innerJoin(tenantUsers, eq(tenants.tenantId, tenantUsers.tenantId))
        .where(and(
          eq(tenantUsers.kindeUserId, (request as ReqWithUser).userContext!.userId),
          eq(tenants.isActive, true)
        ))
        .orderBy(tenants.createdAt);

      console.log('✅ Found user tenants:', userTenants.length);

      return {
        success: true,
        tenants: userTenants,
        total: userTenants.length
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error getting user tenants:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get user tenants',
        message: error.message
      });
    }
  });

  // Get all organizations for tenant (flat list, no hierarchy filtering)
  fastify.get('/organizations/all', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.USERS_MANAGEMENT_VIEW)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = Logger.generateRequestId('all-organizations');
    const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

    try {
      console.log(`🔍 [${requestId}] Getting all organizations for tenant: ${tenantId}`);

      const allOrganizations = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          entityLevel: entities.entityLevel,
          hierarchyPath: entities.hierarchyPath,
          fullHierarchyPath: entities.fullHierarchyPath,
          parentEntityId: entities.parentEntityId,
          organizationType: entities.entityType,
          description: entities.description,
          isActive: entities.isActive,
          createdAt: entities.createdAt,
          updatedAt: entities.updatedAt
        })
        .from(entities)
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.entityType, 'organization'),
          eq(entities.isActive, true)
        ))
        .orderBy(entities.entityLevel, entities.entityName);

      console.log(`✅ [${requestId}] Found ${allOrganizations.length} organizations`);

      return {
        success: true,
        data: allOrganizations,
        count: allOrganizations.length,
        requestId
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Failed to get all organizations:`, error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get all organizations',
        message: error.message,
        requestId
      });
    }
  });

  // Organizations nested routes
  fastify.register(async function organizationRoutes(fastify) {
    // Current organization routes
    fastify.register(async function currentOrgRoutes(fastify) {

      // Invite user to current organization (frontend expects this path)
      fastify.post('/invite-user', {
        preHandler: [authenticateToken, checkUserLimit]
      }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
        const startTime = Date.now();
        const requestId = Logger.generateRequestId('user-invite-org');

        try {
          console.log('\n👤 ================ USER INVITATION (ORG PATH) STARTED ================');
          console.log(`📋 Request ID: ${requestId}`);
          console.log(`⏰ Timestamp: ${Logger.getTimestamp()}`);
          console.log(`👤 Inviting user by: ${(request as ReqWithUser).userContext?.email}`);

          const email = (body.email ?? '') as string; const name = (body.name ?? '') as string; const roleIds = body.roleIds as string[] | undefined; const rawEntities = body.entities; const primaryEntityId = body.primaryEntityId as string | undefined; const message = body.message as string | undefined;
          const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

          console.log(`📧 [${requestId}] Invitation Data:`, {
            email,
            name,
            roleIds,
            entities: rawEntities,
            primaryEntityId,
            tenantId
          });

          console.log(`📧 [${requestId}] Validation: Validating input data`);

          if (!email) {
            return reply.code(400).send({
              success: false,
              error: 'Missing required fields',
              message: 'Email is required'
            });
          }

          if (!tenantId) {
            return reply.code(400).send({
              success: false,
              error: 'No tenant context',
              message: 'Unable to determine tenant for invitation'
            });
          }

          // Get tenant details
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
              success: false,
              error: 'Organization not found',
              message: 'Current user\'s organization not found'
            });
          }

          // Check if invitation already exists
          const [existingInvitation] = await db
            .select()
            .from(tenantInvitations)
            .where(and(
              eq(tenantInvitations.tenantId, tenantId),
              eq(tenantInvitations.email, email),
              eq(tenantInvitations.status, 'pending')
            ))
            .limit(1);

          if (existingInvitation) {
            return reply.code(409).send({
              success: false,
              error: 'Invitation already exists',
              message: `An invitation for ${email} already exists in this organization`
            });
          }

          // Check if user already exists and is active
          const [existingUser] = await db
            .select()
            .from(tenantUsers)
            .where(and(
              eq(tenantUsers.tenantId, tenantId),
              eq(tenantUsers.email, email),
              eq(tenantUsers.isActive, true)
            ))
            .limit(1);

          if (existingUser) {
            return reply.code(409).send({
              success: false,
              error: 'User already exists',
              message: 'This user is already an active member of your organization'
            });
          }

          console.log(`✅ [${requestId}] Input validation successful`);

          // Process entities - handle both single entity and multi-entity invitations
          const targetEntities = Array.isArray(rawEntities) ? rawEntities : rawEntities ? [rawEntities] : [];

          // If no entities provided but we have roleIds, create a default entity entry
          if (targetEntities.length === 0 && roleIds && roleIds.length > 0) {
            // Find the primary entity (use primaryEntityId or find root organization)
            let defaultEntityId = primaryEntityId;
            if (!defaultEntityId) {
              const [rootEntity] = await db
                .select({ entityId: entities.entityId })
                .from(entities)
                .where(and(
                  eq(entities.tenantId, tenantId),
                  eq(entities.entityType, 'organization'),
                  isNull(entities.parentEntityId)
                ))
                .limit(1);
              if (rootEntity) {
                defaultEntityId = rootEntity.entityId;
              }
            }

            if (defaultEntityId) {
              // Use the first roleId for the default entity
              targetEntities.push({
                entityId: defaultEntityId,
                roleId: roleIds[0],
                entityType: 'organization',
                membershipType: 'direct'
              });
            }
          }

          // Validate entities - roleId is optional; role can be assigned after invitation is accepted
          const validatedEntities = [];
          for (const entity of targetEntities) {
            if (!entity.entityId) {
              return reply.code(400).send({
                success: false,
                error: 'Invalid entity specification',
                message: 'Each entity must have entityId'
              });
            }

            // Verify entity exists and belongs to the tenant
            const [entityRecord] = await db
              .select()
              .from(entities)
              .where(and(
                eq(entities.entityId, entity.entityId),
                eq(entities.tenantId, tenantId)
              ))
              .limit(1);

            if (!entityRecord) {
              return reply.code(404).send({
                success: false,
                error: 'Entity not found',
                message: `Entity ${entity.entityId} not found in this tenant`
              });
            }

            // Verify role exists only if roleId is provided and non-empty
            const roleId = (entity.roleId && String(entity.roleId).trim()) ? entity.roleId : null;
            if (roleId) {
              const [roleRecord] = await db
                .select()
                .from(customRoles)
                .where(eq(customRoles.roleId, roleId))
                .limit(1);

              if (!roleRecord) {
                return reply.code(404).send({
                  success: false,
                  error: 'Role not found',
                  message: `Role ${roleId} not found`
                });
              }
            }

            validatedEntities.push({
              entityId: entity.entityId,
              roleId: roleId,
              entityType: entityRecord.entityType,
              membershipType: entity.membershipType || 'direct'
            });
          }

          if (validatedEntities.length === 0) {
            return reply.code(400).send({
              success: false,
              error: 'No valid entities',
              message: 'At least one valid entity must be specified'
            });
          }

          // Determine primary entity
          const finalPrimaryEntityId = primaryEntityId || validatedEntities[0]?.entityId;

          // Generate invitation token and URL
          const invitationToken = uuidv4();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

          // Generate invitation URL using the same logic as invitations route
          const isDevelopment = process.env.NODE_ENV !== 'production';
          let invitationUrl;

          // Priority 1: In development, check request origin first (most reliable for local testing)
          if (isDevelopment && request) {
            const origin = request?.headers?.origin || request?.headers?.referer;
            if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
              try {
                const url = new URL(origin);
                invitationUrl = `${url.protocol}//${url.host}/invite/accept?token=${invitationToken}`;
                console.log(`🔗 [${requestId}] Using request origin for URL: ${invitationUrl}`);
              } catch (_e) {
                console.warn(`⚠️ [${requestId}] Invalid origin URL, using default: ${origin}`);
                invitationUrl = `http://localhost:3000/invite/accept?token=${invitationToken}`;
              }
            } else {
              // Fallback to localhost:3000 (frontend port)
              invitationUrl = `http://localhost:3000/invite/accept?token=${invitationToken}`;
              console.log(`🔗 [${requestId}] Using default localhost URL: ${invitationUrl}`);
            }
          } else {
            // Production: use tenant subdomain or env vars
            let baseUrl = process.env.INVITATION_BASE_URL || process.env.FRONTEND_URL;
            if (!baseUrl) {
              baseUrl = process.env.BASE_URL || 'https://zopkit.com';
            }
            invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;
            console.log(`🔗 [${requestId}] Using production URL: ${invitationUrl.substring(0, 50)}...`);
          }

          console.log(`🔗 [${requestId}] Generated invitation URL:`, invitationUrl.substring(0, 80) + '...');

          // Create invitation in tenantInvitations table
          const dbConnection = dbManager.getAppConnection();
          const escapedInvitationUrl = invitationUrl.replace(/'/g, "''").replace(/\\/g, '\\\\');

          // Insert invitation
          const insertQuery = `
            INSERT INTO tenant_invitations (
              tenant_id, email, invitation_scope, primary_entity_id,
              invited_by, invitation_token, invitation_url, status, expires_at, updated_at
            ) VALUES (
              '${tenant.tenantId}', '${email}', 'multi-entity',
              '${finalPrimaryEntityId}', '${(request as ReqWithUser).userContext?.internalUserId}', '${invitationToken}',
              '${escapedInvitationUrl}', 'pending', '${expiresAt.toISOString()}', '${new Date().toISOString()}'
            )
            RETURNING invitation_id, invitation_url
          `;

          const insertResult = await dbConnection.unsafe(insertQuery);
          const invitationId = insertResult[0].invitation_id;
          const storedUrl = insertResult[0].invitation_url;

          console.log(`✅ [${requestId}] Invitation created in database:`, {
            invitationId,
            urlStored: !!storedUrl
          });

          // Update with JSONB target entities
          const targetEntitiesJson = JSON.stringify(validatedEntities).replace(/'/g, "''").replace(/\\/g, '\\\\');
          const updateQuery = `
            UPDATE tenant_invitations
            SET target_entities = '${targetEntitiesJson}'::jsonb
            WHERE invitation_id = '${invitationId}'
            RETURNING *
          `;

          const updateResult = await dbConnection.unsafe(updateQuery);
          const newInvitation = updateResult[0];

          // Verify URL was stored
          if (!newInvitation.invitation_url) {
            console.warn(`⚠️ [${requestId}] URL not stored, updating...`);
            const urlUpdateQuery = `
              UPDATE tenant_invitations
              SET invitation_url = '${escapedInvitationUrl}'
              WHERE invitation_id = '${invitationId}'
            `;
            await dbConnection.unsafe(urlUpdateQuery);
          }

          // Prepare email data
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

            if (entityRecord) {
              if (entityRecord.entityType === 'organization') {
                organizations.push(entityRecord.entityName);
              } else if (entityRecord.entityType === 'location') {
                locations.push(entityRecord.entityName);
              }
              // Add role name only if role was specified
              if (entity.roleId) {
                const [roleRecord] = await db
                  .select({ roleName: customRoles.roleName })
                  .from(customRoles)
                  .where(eq(customRoles.roleId, entity.roleId))
                  .limit(1);
                if (roleRecord) {
                  roleNames.push(roleRecord.roleName);
                }
              }
            }
          }

          const primaryRoleName = roleNames.length > 0
            ? (roleNames.length === 1 ? roleNames[0] : `${roleNames[0]} (${roleNames.length} roles)`)
            : 'Team Member';

          const emailOrganizations = organizations.length > 0 ? organizations : [tenant.companyName];

          // Send invitation email
          console.log(`📧 [${requestId}] Sending invitation email to: ${email}`);
          try {
            await EmailService.sendUserInvitation({
              email,
              tenantName: tenant.companyName,
              roleName: primaryRoleName,
              invitationToken: invitationUrl, // Pass full URL
              invitedByName: (request as ReqWithUser).userContext?.name || (request as ReqWithUser).userContext?.email,
              message: message || `You've been invited to join ${tenant.companyName} as a ${primaryRoleName}.`,
              organizations: emailOrganizations,
              locations: locations.length > 0 ? locations : undefined,
              invitedDate: new Date(),
              expiryDate: expiresAt
            });

            console.log(`✅ [${requestId}] Invitation email sent successfully`);
          } catch (emailErr: unknown) {
            const emailError = emailErr as Error;
            console.error(`❌ [${requestId}] Failed to send invitation email:`, emailError.message);
            // Don't fail the invitation creation if email fails
          }

          console.log(`🎉 [${requestId}] USER INVITATION (ORG PATH) COMPLETED SUCCESSFULLY!`);
          console.log(`⏱️ [${requestId}] Total processing time: ${Logger.getDuration(startTime)}`);
          console.log('👤 ================ USER INVITATION (ORG PATH) ENDED ================\n');

          return {
            success: true,
            message: 'User invitation created successfully',
            invitation: {
              invitationId: newInvitation.invitation_id,
              email: newInvitation.email,
              token: newInvitation.invitation_token,
              url: newInvitation.invitation_url || invitationUrl,
              expiresAt: newInvitation.expires_at,
              targetEntities: validatedEntities.length
            },
            requestId,
            duration: Logger.getDuration(startTime)
          };

        } catch (err: unknown) {
      const error = err as Error;
          console.error(`❌ [${requestId}] Error sending invitation:`, error);
          return reply.code(500).send({
            success: false,
            error: 'Failed to send invitation',
            message: error.message,
            requestId,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          });
        }
      });

      // Get organization users with status
      fastify.get('/users', {
        preHandler: [authenticateToken]
      }, async (request: FastifyRequest, reply: FastifyReply) => {
        const requestId = Logger.generateRequestId('org-users');
        const tenantId = ((request as ReqWithUser).userContext?.tenantId ?? '') as string;

        try {
          console.log(`👥 [${requestId}] Getting organization users for tenant: ${tenantId}`);

          const users = await db
            .select({
              userId: tenantUsers.userId,
              email: tenantUsers.email,
              name: sql<string>`COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, '')`,
              isActive: tenantUsers.isActive,
              isTenantAdmin: tenantUsers.isTenantAdmin,
              invitedAt: tenantUsers.invitedAt,
              invitationAcceptedAt: (tenantUsers as any).invitationAcceptedAt,
              lastActiveAt: tenantUsers.lastActiveAt,
              createdAt: tenantUsers.createdAt
            })
            .from(tenantUsers)
            .where(eq(tenantUsers.tenantId, tenantId))
            .orderBy(tenantUsers.createdAt);

          const activeUsers = users.filter(u => u.isActive);
          const pendingUsers = users.filter(u => !u.isActive);

          console.log(`✅ [${requestId}] Found ${users.length} total users (${activeUsers.length} active, ${pendingUsers.length} pending)`);

          return {
            success: true,
            data: {
              users,
              summary: {
                total: users.length,
                active: activeUsers.length,
                pending: pendingUsers.length
              }
            },
            requestId
          };
        } catch (err: unknown) {
      const error = err as Error;
          console.error(`❌ [${requestId}] Failed to get organization users:`, error);
          return reply.code(500).send({
            success: false,
            error: 'Failed to get organization users',
            message: error.message,
            requestId
          });
        }
      });

    }, { prefix: '/current' });
  }, { prefix: '/organizations' });
}
