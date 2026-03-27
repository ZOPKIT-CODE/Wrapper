import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../../notifications/services/notification-service.js';
import { NotificationTemplateService } from '../../notifications/services/notification-template-service.js';
import { TenantFilterService } from '../../../services/tenant-filter-service.js';
import { TenantService } from '../../../services/tenant-service.js';
import { contentGenerationService } from '../../notifications/services/ai/content-generation-service.js';
import { personalizationService } from '../../notifications/services/ai/personalization-service.js';
import { smartTargetingService } from '../../notifications/services/ai/smart-targeting-service.js';
import { sentimentService } from '../../notifications/services/ai/sentiment-service.js';
import { notificationAnalyticsService } from '../../notifications/services/notification-analytics-service.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, notifications } from '../../../db/schema/index.js';
import { eq, and, inArray, sql, desc, count, gte, lte, or, like } from 'drizzle-orm';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../../../db/schema/notifications/notifications.js';
import { broadcastToTenant } from '../../../utils/websocket-server.js';

const templateService = new NotificationTemplateService();
const filterService = new TenantFilterService();
const notificationService = new NotificationService();

/**
 * Admin Notification Routes
 * Handles sending curated notifications to tenants from admin dashboard
 */
export default async function adminNotificationRoutes(fastify: FastifyInstance, _options?: object): Promise<void> {
  
  /**
   * POST /api/admin/notifications/send
   * Send notification to a single tenant
   */
  fastify.post('/', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_SEND)],
    schema: {
      description: 'Send notification to a single tenant'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const { tenantId, ...notificationData } = body;
      const adminUserId = (request as any).userContext?.userId ?? '';

      const tenantIdStr = String(tenantId ?? '');
      // Verify tenant exists
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantIdStr))
        .limit(1);

      if (!tenant) {
        return reply.code(404).send({
          success: false,
          error: 'Tenant not found'
        });
      }

      // Create notification
      const notification = await notificationService.createNotification({
        tenantId: tenantIdStr,
        ...(notificationData as any),
        type: (notificationData as any)?.type || NOTIFICATION_TYPES.SYSTEM_UPDATE,
        priority: (notificationData as any)?.priority || NOTIFICATION_PRIORITIES.MEDIUM
      });

      // Log to admin notification history (will be created in schema)
      // For now, we'll log it in the notification metadata
      await db
        .update(notifications)
        .set({
          metadata: {
            ...(((notification as any).metadata as object) || {}),
            sentByAdmin: true,
            adminUserId,
            sentAt: new Date().toISOString()
          } as any
        })
        .where(eq(notifications.notificationId, (notification as any).notificationId));

      // Broadcast notification via WebSocket
      try {
        broadcastToTenant(tenantIdStr, notification);
      } catch (wsError) {
        request.log.warn(wsError, 'WebSocket broadcast failed:');
        // Don't fail the request if WebSocket fails
      }

      reply.send({
        success: true,
        data: notification,
        message: 'Notification sent successfully'
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error sending notification:');
      reply.code(500).send({
        success: false,
        error: 'Failed to send notification',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/bulk-send
   * Send notification to multiple tenants
   */
  fastify.post('/bulk', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_SEND)],
    schema: {
      description: 'Send notification to multiple tenants'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const { tenantIds, filters, templateId, ...notificationData } = body;
      const adminUserId = (request as any).userContext?.userId ?? '';
      
      // If templateId is provided, render template first
      let baseNotificationData = { ...notificationData };
      if (templateId) {
        try {
          const template = await templateService.getTemplate(String(templateId)) as any;
          baseNotificationData = {
            ...baseNotificationData,
            type: baseNotificationData.type || template.type,
            priority: baseNotificationData.priority || template.priority,
            title: baseNotificationData.title || template.title,
            message: baseNotificationData.message || template.message,
            actionUrl: baseNotificationData.actionUrl || template.actionUrl,
            actionLabel: baseNotificationData.actionLabel || template.actionLabel
          };
        } catch (err: unknown) {
          request.log.warn(err, 'Failed to load template, using provided data:');
        }
      }

      let targetTenantIds: string[] = [];

      // If tenantIds provided, use them
      if (tenantIds && Array.isArray(tenantIds) && tenantIds.length > 0) {
        targetTenantIds = (tenantIds as string[]).map(String);
      } else if (filters && typeof filters === 'object') {
        // Apply filters to get tenant IDs
        const whereConditions: ReturnType<typeof eq>[] = [];
        const f = filters as Record<string, unknown>;

        if (f.status && String(f.status) !== 'all') {
          if (f.status === 'active') {
            whereConditions.push(eq(tenants.isActive, true));
          } else if (f.status === 'inactive') {
            whereConditions.push(eq(tenants.isActive, false));
          } else if (f.status === 'trial') {
            whereConditions.push(sql`${tenants.trialEndsAt} > now()`);
          } else if (f.status === 'paid') {
            whereConditions.push(sql`${tenants.trialEndsAt} is null or ${tenants.trialEndsAt} < now()`);
          }
        }

        if (f.industry) {
          whereConditions.push(like(tenants.industry, `%${String(f.industry)}%`));
        }

        if (f.createdAfter) {
          whereConditions.push(gte(tenants.createdAt, new Date(String(f.createdAfter))));
        }

        if (f.createdBefore) {
          whereConditions.push(lte(tenants.createdAt, new Date(String(f.createdBefore))));
        }

        const filteredTenants = await db
          .select({ tenantId: tenants.tenantId })
          .from(tenants)
          .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

        targetTenantIds = filteredTenants.map(t => t.tenantId);

        // Apply credit filters if specified
        if (f.minCredits !== undefined || f.maxCredits !== undefined) {
          const { credits } = await import('../../../db/schema/index.js');
          const creditQuery = db
            .select({ tenantId: credits.tenantId })
            .from(credits)
            .where(eq(credits.isActive, true))
            .groupBy(credits.tenantId);

          if (f.minCredits !== undefined) {
            (creditQuery as any).having(sql`sum(${credits.availableCredits}::numeric) >= ${f.minCredits}`);
          }
          if (f.maxCredits !== undefined) {
            (creditQuery as any).having(sql`sum(${credits.availableCredits}::numeric) <= ${f.maxCredits}`);
          }

          const tenantsWithCredits = await creditQuery;
          const creditTenantIds = tenantsWithCredits.map(t => t.tenantId);
          targetTenantIds = targetTenantIds.filter(id => creditTenantIds.includes(id));
        }
      } else {
        return reply.code(400).send({
          success: false,
          error: 'Either tenantIds or filters must be provided'
        });
      }

      if (targetTenantIds.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'No tenants match the specified criteria'
        });
      }

      // Helper function to replace variables in text
      const replaceVariables = (text: string | undefined, variables: Record<string, string>) => {
        if (!text) return text ?? '';
        let result = text;
        Object.keys(variables).forEach(key => {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          result = result.replace(regex, (variables[key] ?? `{{${key}}}`) as string);
        });
        return result;
      };

      // Helper function to build tenant variables
      const buildTenantVariables = (tenant: Record<string, unknown>) => {
        return {
          tenantName: String(tenant.companyName ?? ''),
          companyName: String(tenant.companyName ?? ''),
          legalCompanyName: String(tenant.legalCompanyName ?? tenant.companyName ?? ''),
          subdomain: String(tenant.subdomain ?? ''),
          industry: String(tenant.industry ?? ''),
          organizationSize: String(tenant.organizationSize ?? ''),
          website: String(tenant.website ?? ''),
          adminEmail: String(tenant.adminEmail ?? ''),
          billingEmail: String(tenant.billingEmail ?? ''),
          supportEmail: String(tenant.supportEmail ?? '')
        };
      };

      // Fetch tenant details for personalization
      const tenantDetailsList = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          legalCompanyName: tenants.legalCompanyName,
          subdomain: tenants.subdomain,
          industry: tenants.industry,
          organizationSize: tenants.organizationSize,
          website: tenants.website,
          adminEmail: tenants.adminEmail,
          billingEmail: tenants.billingEmail,
          supportEmail: tenants.supportEmail
        })
        .from(tenants)
        .where(inArray(tenants.tenantId, targetTenantIds));

      // Create a map for quick lookup
      const tenantDetailsMap = new Map(
        tenantDetailsList.map(t => [t.tenantId, t])
      );

      const baseData = baseNotificationData as Record<string, unknown>;
      const notificationsToCreate = targetTenantIds.map(tenantId => {
        const tenantDetails = tenantDetailsMap.get(tenantId);
        const variables = tenantDetails ? buildTenantVariables(tenantDetails as any) : {};
        
        const personalizedTitle = replaceVariables(baseData.title as string, variables);
        const personalizedMessage = replaceVariables(baseData.message as string, variables);
        const personalizedActionUrl = replaceVariables(String(baseData.actionUrl ?? ''), variables);
        const personalizedActionLabel = replaceVariables(String(baseData.actionLabel ?? ''), variables);

        return {
          tenantId,
          ...(typeof baseData === 'object' && baseData !== null ? baseData : {}),
          title: personalizedTitle,
          message: personalizedMessage,
          actionUrl: personalizedActionUrl || baseData.actionUrl,
          actionLabel: personalizedActionLabel || baseData.actionLabel,
          type: baseData.type || NOTIFICATION_TYPES.SYSTEM_UPDATE,
          priority: baseData.priority || NOTIFICATION_PRIORITIES.MEDIUM,
          metadata: {
            ...((baseData.metadata as object) || {}),
            sentByAdmin: true,
            adminUserId,
            sentAt: new Date().toISOString(),
            bulkSend: true,
            totalRecipients: targetTenantIds.length,
            personalized: true,
            tenantVariables: variables,
            ...(templateId ? { templateId } : {})
          }
        };
      });

      const createdNotifications = await notificationService.bulkCreateNotifications(notificationsToCreate as any);

      // Broadcast notifications via WebSocket
      try {
        const { broadcastToTenants } = await import('../../../utils/websocket-server.js');
        createdNotifications.forEach((notification: any) => {
            try {
            broadcastToTenant(notification.tenantId, notification);
          } catch (wsError) {
            request.log.warn(wsError, `WebSocket broadcast failed for tenant ${notification.tenantId}:`);
          }
        });
      } catch (wsError) {
        request.log.warn(wsError, 'WebSocket broadcasting failed:');
        // Don't fail the request if WebSocket fails
      }

      reply.send({
        success: true,
        data: {
          sentCount: createdNotifications.length,
          totalTenants: targetTenantIds.length,
          notifications: createdNotifications.slice(0, 10) // Return first 10 for preview
        },
        message: `Notification sent to ${createdNotifications.length} tenants successfully`
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error bulk sending notifications:');
      reply.code(500).send({
        success: false,
        error: 'Failed to bulk send notifications',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * GET /api/admin/notifications/sent
   * Get sent notifications history
   */
  fastify.get('/sent', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_VIEW)],
    schema: {
      description: 'Get sent notifications history'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const tenantId = query.tenantId;
      const startDate = query.startDate;
      const endDate = query.endDate;
      const type = query.type;
      const offset = (page - 1) * limit;

      const whereConditions = [
        sql`${notifications.metadata}->>'sentByAdmin' = 'true'`
      ];

      if (tenantId) {
        whereConditions.push(eq(notifications.tenantId, tenantId));
      }

      if (startDate) {
        whereConditions.push(gte(notifications.createdAt, new Date(startDate)));
      }

      if (endDate) {
        whereConditions.push(lte(notifications.createdAt, new Date(endDate)));
      }

      if (type) {
        whereConditions.push(eq(notifications.type, type));
      }

      const [notificationsList, totalResult] = await Promise.all([
        db
          .select({
            notificationId: notifications.notificationId,
            tenantId: notifications.tenantId,
            companyName: tenants.companyName,
            type: notifications.type,
            priority: notifications.priority,
            title: notifications.title,
            message: notifications.message,
            createdAt: notifications.createdAt,
            metadata: notifications.metadata
          })
          .from(notifications)
          .leftJoin(tenants, eq(notifications.tenantId, tenants.tenantId))
          .where(and(...whereConditions))
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql`count(*)` })
          .from(notifications)
          .where(and(...whereConditions))
      ]);

      const total = parseInt(String((totalResult[0] as any)?.count ?? 0), 10);

      reply.send({
        success: true,
        data: {
          notifications: notificationsList,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching sent notifications:');
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch sent notifications',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * GET /api/admin/notifications/stats
   * Get notification statistics
   */
  fastify.get('/stats', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_VIEW)],
    schema: {
      description: 'Get notification statistics'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const filters = {
        startDate: query.startDate,
        endDate: query.endDate,
        tenantId: query.tenantId,
        adminUserId: (request as any).userContext?.userId ?? ''
      };

      const stats = await notificationAnalyticsService.getStats(filters as any);

      reply.send({
        success: true,
        data: stats
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching notification stats:');
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch notification stats',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/preview
   * Preview notification before sending
   */
  fastify.post('/preview', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_SEND)],
    schema: {
      description: 'Preview notification before sending'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const previewData = {
        ...body,
        notificationId: 'preview-' + Date.now(),
        tenantId: 'preview-tenant',
        isRead: false,
        isDismissed: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      reply.send({
        success: true,
        data: previewData,
        message: 'Preview generated successfully'
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error generating preview:');
      reply.code(500).send({
        success: false,
        error: 'Failed to generate preview',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * GET /api/admin/notifications/templates
   * Get all notification templates
   */
  fastify.get('/templates', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_VIEW)],
    schema: {
      description: 'Get all notification templates'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      // Normalize query parameters
      const queryParams: Record<string, unknown> = { ...query };
      
      // Handle includeInactive parameter (frontend sends this)
      if (queryParams.includeInactive !== undefined) {
        // Convert string to boolean if needed
        const includeInactive = queryParams.includeInactive === 'true' || queryParams.includeInactive === true;
        // If includeInactive=true, show all (isActive=undefined)
        // If includeInactive=false, show only active (isActive=true)
        queryParams.isActive = includeInactive ? undefined : true;
        delete queryParams.includeInactive;
      } else if (queryParams.isActive === undefined) {
        // Default behavior: if neither isActive nor includeInactive is provided, show only active
        queryParams.isActive = true;
      }
      
      // Convert string booleans to actual booleans (if isActive was explicitly set)
      if (queryParams.isActive !== undefined && typeof queryParams.isActive === 'string') {
        queryParams.isActive = queryParams.isActive === 'true';
      }
      
      // Convert string numbers to integers
      if (queryParams.limit !== undefined && typeof queryParams.limit === 'string') {
        queryParams.limit = parseInt(queryParams.limit, 10);
      }
      if (queryParams.offset !== undefined && typeof queryParams.offset === 'string') {
        queryParams.offset = parseInt(queryParams.offset, 10);
      }
      
      const templates = await templateService.getTemplates(queryParams as any);
      
      reply.send({
        success: true,
        data: templates
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching templates:');
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch templates',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/templates
   * Create a notification template
   */
  fastify.post('/templates', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_MANAGE)],
    schema: {
      description: 'Create a notification template'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const template = await templateService.createTemplate({
        ...body,
        createdBy: (request as any).userContext?.internalUserId
      } as any);
      
      reply.code(201).send({
        success: true,
        data: template,
        message: 'Template created successfully'
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error creating template:');
      reply.code(500).send({
        success: false,
        error: 'Failed to create template',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * PUT /api/admin/notifications/templates/:templateId
   * Update a notification template
   */
  fastify.put('/templates/:templateId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_MANAGE)],
    schema: {
      description: 'Update a notification template'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const template = await templateService.updateTemplate(
        params.templateId ?? '',
        body
      ) as any;
      
      reply.send({
        success: true,
        data: template,
        message: 'Template updated successfully'
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error updating template:');
      reply.code(400).send({
        success: false,
        error: 'Failed to update template',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * DELETE /api/admin/notifications/templates/:templateId
   * Delete a notification template
   */
  fastify.delete('/templates/:templateId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_MANAGE)],
    schema: {
      description: 'Delete a notification template'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      await templateService.deleteTemplate(params.templateId ?? '');
      
      reply.code(204).send({ success: true });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error deleting template:');
      reply.code(400).send({
        success: false,
        error: 'Failed to delete template',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * GET /api/admin/notifications/templates/categories
   * Get template categories
   */
  fastify.get('/templates/categories', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_VIEW)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const categories = templateService.getCategories();
      reply.send({
        success: true,
        data: Object.values(categories)
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching template categories:');
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch template categories',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * GET /api/admin/notifications/templates/:templateId
   * Get a specific template
   */
  fastify.get('/templates/:templateId', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_VIEW)],
    schema: {
      description: 'Get a specific template'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const template = await templateService.getTemplate(params.templateId ?? '');
      
      reply.send({
        success: true,
        data: template
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching template:');
      reply.code(404).send({
        success: false,
        error: 'Template not found',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/templates/:templateId/render
   * Render a template with variables
   */
  fastify.post('/templates/:templateId/render', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_SEND)],
    schema: {
      description: 'Render a template with variables'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const variables = body.variables;
      const rendered = await templateService.renderTemplate(
        params.templateId ?? '',
        (typeof variables === 'object' && variables !== null ? variables as Record<string, string> : {})
      ) as any;
      
      reply.send({
        success: true,
        data: rendered
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error rendering template:');
      reply.code(500).send({
        success: false,
        error: 'Failed to render template',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/ai/generate
   * Generate notification content using AI
   */
  fastify.post('/ai/generate', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_SEND)],
    schema: {
      description: 'Generate notification content using AI'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const { prompt, variantCount, ...options } = body;

      if (Number(variantCount) > 1) {
        const variants = await contentGenerationService.generateVariants(String(prompt ?? ''), Number(variantCount), options as any);
        return reply.send({
          success: true,
          data: { variants }
        });
      } else {
        const result = await contentGenerationService.generateContent(String(prompt ?? ''), options as any);
        return reply.send({
          success: true,
          data: result
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error generating AI content:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate content',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/ai/personalize
   * Personalize notification content for a tenant
   */
  fastify.post('/ai/personalize', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_SEND)],
    schema: {
      description: 'Personalize notification content for a tenant'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const { tenantId, content } = body;
      const personalized = await personalizationService.personalizeContent(String(tenantId ?? ''), content as any);
      return reply.send({
        success: true,
        data: personalized
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error personalizing content:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to personalize content',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/ai/suggest-targets
   * Suggest target tenants using AI
   */
  fastify.post('/ai/suggest-targets', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_SEND)],
    schema: {
      description: 'Suggest target tenants using AI'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const { content, maxSuggestions } = body;
      const suggestions = await smartTargetingService.suggestTargets(content as any, { maxSuggestions: maxSuggestions as number } as any);
      return reply.send({
        success: true,
        data: suggestions
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error suggesting targets:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to suggest targets',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/ai/analyze-sentiment
   * Analyze notification content sentiment
   */
  fastify.post('/ai/analyze-sentiment', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_SEND)],
    schema: {
      description: 'Analyze notification content sentiment'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const { content, includeSuggestions } = body;
      const analysis = await sentimentService.analyzeSentiment(content as any, { includeSuggestions } as any);
      return reply.send({
        success: true,
        data: analysis
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error analyzing sentiment:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to analyze sentiment',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * POST /api/admin/notifications/templates/ai-generate
   * Generate template using AI
   */
  fastify.post('/templates/ai-generate', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_MANAGE)],
    schema: {
      description: 'Generate template using AI'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const { description, category, type, priority } = body;
      const adminUserId = (request as any).userContext?.internalUserId ?? '';

      // Generate content using AI
      const prompt = `Create a notification template based on this description: ${String(description ?? '')}`;
      const generated = await contentGenerationService.generateContent(prompt, {
        tone: 'professional',
        length: 'medium'
      }) as any;

      // Create template
      const template = await templateService.createTemplate({
        name: `AI Generated: ${String(description).substring(0, 50)}`,
        category: String(category ?? 'custom'),
        type: String(type ?? 'system_update'),
        priority: String(priority ?? 'medium'),
        title: generated?.title,
        message: generated?.message,
        createdBy: adminUserId
      } as any);

      return reply.send({
        success: true,
        data: template,
        message: 'Template generated successfully'
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error generating template with AI:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate template',
        message: error?.message ?? ''
      });
    }
  });

  /**
   * GET /api/admin/notifications/analytics
   * Get comprehensive analytics dashboard data
   */
  fastify.get('/analytics', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_NOTIFICATIONS_VIEW)],
    schema: {
      description: 'Get comprehensive analytics dashboard data'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const filters = {
        startDate: query.startDate,
        endDate: query.endDate,
        tenantId: query.tenantId
      };

      const dashboardData = await notificationAnalyticsService.getDashboardData(filters as any);

      return reply.send({
        success: true,
        data: dashboardData
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching analytics:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch analytics',
        message: error?.message ?? ''
      });
    }
  });
}

