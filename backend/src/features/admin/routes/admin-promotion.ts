import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AdminPromotionService } from '../services/admin-promotion-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { db } from '../../../db/index.js';
import { tenantUsers, auditLogs, tenants } from '../../../db/schema/index.js';
import { eq, and, desc, or, sql } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';

/**
 * Admin promotion routes for single System Administrator system
 */
export default async function adminPromotionRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  
  // Get current System Administrator
  fastify.get('/current-admin', {
    preHandler: [authenticateToken, requirePermission([PERMISSIONS.ADMIN_USERS_VIEW])],
    schema: {
      summary: 'Get current System Administrator',
      description: 'Returns the current System Administrator for the tenant',
      tags: ['System Admin']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'get-current-system-admin', 'Getting current System Administrator');
      
      const tenantId = (request.userContext as { tenantId: string }).tenantId;
      
      const currentAdmin = await AdminPromotionService.getCurrentSystemAdmin(tenantId);
      
      return reply.send({
        success: true,
        data: {
          currentAdmin: currentAdmin ? {
            userId: currentAdmin.userId ?? '',
            userName: [currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || '',
            userEmail: currentAdmin.email ?? ''
          } : null
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-current-system-admin', 'Failed to get current System Administrator', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to get current System Administrator',
        message: error.message
      });
    }
  });

  // Get eligible users for System Administrator promotion
  fastify.get('/eligible-users', {
    preHandler: [authenticateToken, requirePermission([PERMISSIONS.ADMIN_USERS_VIEW])],
    schema: {
      summary: 'Get eligible users for System Administrator promotion',
      description: 'Returns users who can be promoted to System Administrator',
      tags: ['System Admin']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'get-eligible-users', 'Getting eligible users for System Administrator promotion');
      
      const tenantId = (request.userContext as { tenantId: string }).tenantId;
      const currentAdminId = (request.userContext as { internalUserId: string | null }).internalUserId;
      
      if (!(request.userContext as { isTenantAdmin?: boolean }).isTenantAdmin) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied',
          message: 'Only System Administrators can view eligible users'
        });
      }

      const [eligibleUsers, currentAdmin] = await Promise.all([
        AdminPromotionService.getEligibleUsers(tenantId, currentAdminId ?? ''),
        AdminPromotionService.getCurrentSystemAdmin(tenantId)
      ]);

      return reply.send({
        success: true,
        data: {
          eligibleUsers,
          currentAdmin: currentAdmin ? {
            userId: currentAdmin.userId ?? '',
            userName: [currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || '',
            userEmail: currentAdmin.email ?? ''
          } : null,
          totalEligible: eligibleUsers.length
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-eligible-users', 'Failed to get eligible users', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to get eligible users',
        message: error.message
      });
    }
  });

  // Preview System Administrator promotion impact
  fastify.post('/preview', {
    preHandler: [authenticateToken, requirePermission([PERMISSIONS.ADMIN_USERS_PROMOTE])],
    schema: {
      summary: 'Preview System Administrator promotion impact',
      description: 'Shows what will happen when promoting a user to System Administrator',
      tags: ['System Admin']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'preview-promotion', 'Previewing System Administrator promotion impact');
      
      const body = request.body as Record<string, unknown>;
      const targetUserId = body.targetUserId as string;
      const tenantId = (request.userContext as { tenantId: string }).tenantId;
      
      if (!(request.userContext as { isTenantAdmin?: boolean }).isTenantAdmin) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied',
          message: 'Only System Administrators can preview promotions'
        });
      }

      // Get target user details
      const [targetUser] = await db
        .select({
          userId: tenantUsers.userId,
          name: sql<string>`COALESCE(NULLIF(TRIM(COALESCE(${tenantUsers.firstName}, '') || ' ' || COALESCE(${tenantUsers.lastName}, '')), ''), ${tenantUsers.email}, '')`.as('name'),
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName
        })
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, targetUserId),
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.isActive, true)
        ))
        .limit(1);

      if (!targetUser) {
        return reply.code(404).send({
          success: false,
          error: 'User not found',
          message: 'Target user not found or inactive'
        });
      }

      // Get current System Administrator
      const currentAdmin = await AdminPromotionService.getCurrentSystemAdmin(tenantId);

      // Check if target user is already System Administrator
      if (currentAdmin && currentAdmin.userId === targetUserId) {
        return reply.code(400).send({
          success: false,
          error: 'Already System Administrator',
          message: 'User is already the System Administrator'
        });
      }

      return reply.send({
        success: true,
        data: {
          impact: {
            newAdmin: {
              userId: targetUser.userId,
              name: targetUser.name,
              email: targetUser.email,
              willReceiveRole: 'System Administrator'
            },
            currentAdmin: currentAdmin ? {
              userId: currentAdmin.userId ?? '',
              name: [currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || '',
              email: currentAdmin.email,
              willLoseRole: 'System Administrator'
            } : null,
            willDemoteCurrentAdmin: !!currentAdmin,
            systemAdminRole: {
              name: 'System Administrator',
              description: 'Single system administrator with complete organizational control',
              permissions: 'All permissions across all modules'
            },
            warnings: currentAdmin ? [
              `${[currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || ''} will lose System Administrator privileges`,
              'Only one System Administrator can exist at a time',
              'This action cannot be undone easily'
            ] : [
              'No current System Administrator - this will be the first admin'
            ]
          }
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'preview-promotion', 'Failed to preview promotion impact', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to preview promotion impact',
        message: error.message
      });
    }
  });

  // Promote user to System Administrator (Enhanced Version)
  fastify.post('/promote-system-admin', {
    preHandler: [authenticateToken, requirePermission([PERMISSIONS.ADMIN_USERS_PROMOTE])],
    schema: {
      summary: 'Promote user to System Administrator (Enhanced)',
      description: 'Promotes a user to System Administrator with comprehensive validation and single-admin enforcement',
      tags: ['System Admin']
    }
  },
  async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = `enhanced-sys-admin-promote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      Logger.log('info', 'general', requestId, 'Enhanced System Administrator promotion requested');
      
      const body = request.body as Record<string, unknown>;
      const targetUserId = body.targetUserId as string;
      const reason = body.reason as string;
      const forceTransfer = (body.forceTransfer as boolean) ?? false;
      const confirmationCode = body.confirmationCode as string | undefined;
      const tenantId = (request.userContext as { tenantId: string }).tenantId;
      const currentRequestorId = (request.userContext as { internalUserId: string | null }).internalUserId;
      
      // Validation 1: Only current admins can promote users
      if (!(request.userContext as { isTenantAdmin?: boolean }).isTenantAdmin) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied',
          message: 'Only System Administrators can promote users',
          requestId,
          processingTime: Date.now() - startTime
        });
      }

      // Validation 2: Get current System Administrator
      const currentAdmin = await AdminPromotionService.getCurrentSystemAdmin(tenantId);
      Logger.log('info', 'general', requestId, 'Current System Administrator retrieved', { hasCurrentAdmin: !!currentAdmin, currentAdminId: currentAdmin?.userId ?? null });

      // Validation 3: Check if target user exists and is eligible
      const [targetUser] = await db
        .select({
          userId: tenantUsers.userId,
          name: sql<string>`COALESCE(NULLIF(TRIM(COALESCE(${tenantUsers.firstName}, '') || ' ' || COALESCE(${tenantUsers.lastName}, '')), ''), ${tenantUsers.email}, '')`.as('name'),
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          isActive: tenantUsers.isActive,
          isTenantAdmin: tenantUsers.isTenantAdmin
        })
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, targetUserId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .limit(1);

      if (!targetUser) {
        return reply.code(404).send({
          success: false,
          error: 'User not found',
          message: 'Target user not found in this organization',
          requestId,
          processingTime: Date.now() - startTime
        });
      }

      if (!targetUser.isActive) {
        return reply.code(400).send({
          success: false,
          error: 'User inactive',
          message: 'Cannot promote inactive user to System Administrator',
          requestId,
          processingTime: Date.now() - startTime
        });
      }

      // Validation 4: Check if user is already System Administrator
      if (currentAdmin && (currentAdmin.userId ?? null) === targetUserId) {
        return reply.code(400).send({
          success: false,
          error: 'Already System Administrator',
          message: 'User is already the System Administrator',
          requestId,
          processingTime: Date.now() - startTime
        });
      }

      // Validation 5: Handle existing System Administrator
      if (currentAdmin && !forceTransfer) {
        return reply.code(409).send({
          success: false,
          error: 'Existing System Administrator',
          message: 'Another user is already System Administrator. Use forceTransfer=true to replace them.',
          requiresConfirmation: true,
          currentAdmin: {
            userId: currentAdmin.userId,
            name: [currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || '',
            email: currentAdmin.email,
            assignedAt: currentAdmin.assignedAt
          },
          targetUser: {
            userId: targetUser.userId,
            name: targetUser.name,
            email: targetUser.email
          },
          requestId,
          processingTime: Date.now() - startTime
        });
      }

      // Validation 6: Validate confirmation code for forced transfers
      if (currentAdmin && forceTransfer) {
        const currentAdminId = currentAdmin.userId ?? '';
        const expectedCode = `TRANSFER_${currentAdminId.slice(-8).toUpperCase()}_TO_${targetUserId.slice(-8).toUpperCase()}`;
        
        if (!confirmationCode || confirmationCode !== expectedCode) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid confirmation code',
            message: 'Invalid or missing confirmation code for System Administrator transfer',
            requiredConfirmationCode: expectedCode,
            instructions: 'Use the exact confirmation code provided to complete this high-risk operation',
            requestId,
            processingTime: Date.now() - startTime
          });
        }
      }

      // Get organization info for context
      const [orgInfo] = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          kindeOrgId: tenants.kindeOrgId
        })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      // Execute the promotion
      Logger.log('info', 'general', requestId, 'Executing System Administrator promotion');
      
      const result = await AdminPromotionService.promoteToSystemAdmin(
        tenantId,
        currentRequestorId ?? '',
        targetUserId,
        reason,
        {
          forceTransfer,
          previousAdmin: currentAdmin ? {
            userId: currentAdmin.userId ?? '',
            userName: [currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || '',
            userEmail: currentAdmin.email ?? ''
          } : undefined
        }
      );

      Logger.log('info', 'general', requestId, 'System Administrator promotion completed successfully');

      const resultData = result.data as Record<string, unknown>;
      return reply.send({
        success: true,
        data: {
          ...resultData,
          organizationInfo: {
            name: orgInfo?.companyName,
            kindeOrgId: orgInfo?.kindeOrgId
          },
          promotionDetails: {
            wasForced: forceTransfer,
            hadPreviousAdmin: !!currentAdmin,
            promotedBy: {
              userId: currentRequestorId,
              isSelfPromotion: currentRequestorId === targetUserId
            }
          }
        },
        requestId,
        processingTime: Date.now() - startTime
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', requestId, 'Enhanced System Administrator promotion failed', { error: error.message });
      
      return reply.code(500).send({
        success: false,
        error: 'System Administrator promotion failed',
        message: error.message,
        requestId,
        processingTime: Date.now() - startTime
      });
    }
  });

  // Promote user to System Administrator (Original - for backward compatibility)
  fastify.post('/promote', {
    preHandler: [authenticateToken, requirePermission([PERMISSIONS.ADMIN_USERS_PROMOTE])],
    schema: {
      summary: 'Promote user to System Administrator (Legacy)',
      description: 'Legacy endpoint for System Administrator promotion with confirmation',
      tags: ['System Admin']
    }
  },
  async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = `legacy-sys-admin-promote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      Logger.log('info', 'general', requestId, 'Legacy System Administrator promotion requested');
      
      const body = request.body as Record<string, unknown>;
      const targetUserId = body.targetUserId as string;
      const reason = body.reason as string;
      const confirmationCode = body.confirmationCode as string | undefined;
      const tenantId = (request.userContext as { tenantId: string }).tenantId;
      const currentAdminId = (request.userContext as { internalUserId: string | null }).internalUserId;
      
      if (!(request.userContext as { isTenantAdmin?: boolean }).isTenantAdmin) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied',
          message: 'Only System Administrators can promote users',
          requestId,
          processingTime: Date.now() - startTime
        });
      }

      // Check if there's a current admin (requiring confirmation)
      const currentAdmin = await AdminPromotionService.getCurrentSystemAdmin(tenantId);
      if (currentAdmin && !confirmationCode) {
        return reply.code(400).send({
          success: false,
          error: 'Confirmation required',
          message: 'Confirmation code required when demoting existing System Administrator',
          requiresConfirmation: true,
          currentAdmin: {
            name: [currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || '',
            email: currentAdmin.email
          },
          requestId,
          processingTime: Date.now() - startTime
        });
      }

      // Validate confirmation code if provided
      if (currentAdmin && (confirmationCode ?? '') !== 'TRANSFER_ADMIN_ROLE') {
        return reply.code(400).send({
          success: false,
          error: 'Invalid confirmation code',
          message: 'Invalid confirmation code for System Administrator transfer',
          requestId,
          processingTime: Date.now() - startTime
        });
      }

      // Perform the promotion using enhanced method with legacy compatibility
      const result = await AdminPromotionService.promoteToSystemAdmin(
        tenantId,
        currentAdminId ?? '',
        targetUserId,
        reason,
        {
          forceTransfer: !!currentAdmin,
          previousAdmin: currentAdmin ? {
            userId: currentAdmin.userId ?? '',
            userName: [currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || '',
            userEmail: currentAdmin.email ?? ''
          } : undefined
        }
      );

      Logger.log('info', 'general', requestId, 'Legacy System Administrator promotion completed successfully');

      return reply.send({
        success: true,
        data: result.data,
        requestId,
        processingTime: Date.now() - startTime
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', requestId, 'Legacy System Administrator promotion failed', { error: error.message });
      
      return reply.code(500).send({
        success: false,
        error: 'System Administrator promotion failed',
        message: error.message,
        requestId,
        processingTime: Date.now() - startTime
      });
    }
  });

  // Get System Administrator status and promotion options
  fastify.get('/admin-status', {
    preHandler: [authenticateToken, requirePermission([PERMISSIONS.ADMIN_USERS_VIEW])],
    schema: {
      summary: 'Get System Administrator status and options',
      description: 'Returns current admin status and available promotion options',
      tags: ['System Admin']
    }
  },
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'get-admin-status', 'Getting comprehensive System Administrator status');
      
      const tenantId = (request.userContext as { tenantId: string }).tenantId;
      const requestorId = (request.userContext as { internalUserId: string | null }).internalUserId;
      
      // Get current System Administrator
      const currentAdmin = await AdminPromotionService.getCurrentSystemAdmin(tenantId);
      
      // Get eligible users
      const eligibleUsers = await AdminPromotionService.getEligibleUsers(tenantId, requestorId ?? '');
      
      // Get organization info
      const [orgInfo] = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          kindeOrgId: tenants.kindeOrgId
        })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      // Determine if current user can promote others
      const canPromote = (request.userContext as { isTenantAdmin?: boolean }).isTenantAdmin;
      const userMap = eligibleUsers as Array<Record<string, unknown>>;

      return reply.send({
        success: true,
        data: {
          currentAdmin: currentAdmin ? {
            userId: currentAdmin.userId ?? '',
            userName: [currentAdmin.firstName, currentAdmin.lastName].filter(Boolean).join(' ') || currentAdmin.email || '',
            userEmail: currentAdmin.email ?? ''
          } : null,
          eligibleUsers: userMap.map(user => ({
            userId: user.userId,
            name: user.name,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt
          })),
          canPromote,
          organizationInfo: {
            name: orgInfo?.companyName,
            kindeOrgId: orgInfo?.kindeOrgId,
            totalEligibleUsers: eligibleUsers.length
          },
          policies: {
            singleAdminOnly: true,
            requiresConfirmationForTransfer: true,
            cannotDeleteOnlyAdmin: true
          }
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-admin-status', 'Failed to get System Administrator status', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to get System Administrator status',
        message: error.message
      });
    }
  });

  // Get System Administrator promotion history
  fastify.get('/history', {
    preHandler: [authenticateToken, requirePermission([PERMISSIONS.ADMIN_AUDIT_VIEW])],
    schema: {
      summary: 'Get System Administrator promotion history',
      description: 'Returns history of System Administrator promotions and demotions',
      tags: ['System Admin']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'get-promotion-history', 'Getting System Administrator promotion history');
      
      const tenantId = (request.userContext as { tenantId: string }).tenantId;
      const q = request.query as Record<string, string | number | undefined>;
      const limit = Number(q.limit) || 50;
      const offset = Number(q.offset) || 0;
      
      if (!(request.userContext as { isTenantAdmin?: boolean }).isTenantAdmin) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied',
          message: 'Only System Administrators can view promotion history'
        });
      }

      // Get promotion/demotion history from audit logs
      const history = await db
        .select({
          logId: auditLogs.logId,
          action: auditLogs.action,
          details: auditLogs.details,
          createdAt: auditLogs.createdAt,
          userId: auditLogs.userId
        })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId),
          or(
            eq(auditLogs.action, 'system_admin_promotion'),
            eq(auditLogs.action, 'system_admin_demotion')
          )
        ))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({
        success: true,
        data: {
          history,
          pagination: {
            limit,
            offset,
            total: history.length
          }
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-promotion-history', 'Failed to get promotion history', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to get promotion history',
        message: error.message
      });
    }
  });

  // Emergency System Administrator recovery
  fastify.post('/emergency-recovery', {
    preHandler: [authenticateToken],
    schema: {
      summary: 'Emergency System Administrator recovery',
      description: 'Emergency endpoint to recover System Administrator access when none exists',
      tags: ['System Admin']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('warning', 'general', 'emergency-recovery', 'Emergency System Administrator recovery requested');
      
      const body = request.body as Record<string, unknown>;
      const emergencyCode = body.emergencyCode as string;
      const newAdminId = body.newAdminId as string;
      const reason = body.reason as string | undefined;
      const tenantId = (request.userContext as { tenantId: string }).tenantId;
      
      // Validate emergency code
      if (emergencyCode !== process.env.EMERGENCY_ADMIN_CODE) {
        return reply.code(403).send({
          success: false,
          error: 'Invalid emergency code',
          message: 'Emergency recovery requires valid authorization'
        });
      }

      // Validate that the target user belongs to this tenant
      const [validUser] = await db
        .select({ userId: tenantUsers.userId })
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, newAdminId),
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.isActive, true)
        ))
        .limit(1);

      if (!validUser) {
        return reply.code(404).send({
          success: false,
          error: 'User not found',
          message: 'Target user not found in this organization'
        });
      }

      // Check if there are any existing System Administrators
      const existingAdmin = await AdminPromotionService.getCurrentSystemAdmin(tenantId);

      if (existingAdmin) {
        return reply.code(400).send({
          success: false,
          error: 'System Administrator exists',
          message: 'Emergency recovery not needed - active System Administrator exists',
          currentAdmin: {
            name: [existingAdmin.firstName, existingAdmin.lastName].filter(Boolean).join(' ') || existingAdmin.email || '',
            email: existingAdmin.email
          }
        });
      }

      // Perform emergency promotion (no current admin - pass empty string)
      const result = await AdminPromotionService.promoteToSystemAdmin(
        tenantId,
        '', // No current admin
        newAdminId,
        reason || 'Emergency System Administrator recovery'
      );

      // Log emergency recovery
      await db.insert(auditLogs).values({
        tenantId,
        userId: newAdminId,
        action: 'emergency_system_admin_recovery',
        resourceType: 'user',
        resourceId: newAdminId,
        details: {
          reason,
          emergencyCode: 'REDACTED',
          recoveredBy: (request.userContext as { email?: string }).email,
          timestamp: new Date().toISOString()
        }
      });

      return reply.send({
        success: true,
        data: result.data,
        message: 'Emergency System Administrator recovery completed'
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'emergency-recovery', 'Emergency System Administrator recovery failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Emergency recovery failed',
        message: error.message
      });
    }
  });
} 