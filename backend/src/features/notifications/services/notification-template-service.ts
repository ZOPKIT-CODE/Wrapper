import { db } from '../../../db/index.js';
import { notificationTemplates, TEMPLATE_CATEGORIES } from '../../../db/schema/notifications/notification-templates.js';
import { eq, and, desc, like, or } from 'drizzle-orm';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../../../db/schema/notifications/notifications.js';
import { notificationCacheService } from './notification-cache-service.js';
import Logger from '../../../utils/logger.js';

export interface CreateTemplateData {
  name: string;
  category?: string;
  description?: string;
  type?: string;
  priority?: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  isSystem?: boolean;
  version?: string;
  createdBy?: string;
}

class NotificationTemplateService {
  /**
   * Create a notification template
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(templateData: CreateTemplateData | Record<string, unknown>) {
    try {
      const {
        name,
        category = TEMPLATE_CATEGORIES.CUSTOM,
        description,
        type = NOTIFICATION_TYPES.SYSTEM_UPDATE,
        priority = NOTIFICATION_PRIORITIES.MEDIUM,
        title,
        message,
        actionUrl,
        actionLabel,
        variables = {},
        metadata = {},
        isActive = true,
        isSystem = false,
        version = '1.0.0',
        createdBy
      } = templateData;

      // Validate createdBy is a valid UUID if provided
      const createdByStr = createdBy != null ? String(createdBy) : undefined;
      if (createdByStr && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdByStr)) {
        throw new Error(`Invalid createdBy UUID format: ${createdByStr}`);
      }

      const [template] = await db
        .insert(notificationTemplates)
        // Cast for insert: destructured templateData may have unknown types
        .values({
          name: String(name ?? ''),
          category: (category as string) ?? TEMPLATE_CATEGORIES.CUSTOM,
          description: description as string | undefined,
          type: (type as string) ?? NOTIFICATION_TYPES.SYSTEM_UPDATE,
          priority: (priority as string) ?? NOTIFICATION_PRIORITIES.MEDIUM,
          title: String(title ?? ''),
          message: String(message ?? ''),
          actionUrl: actionUrl as string | undefined,
          actionLabel: actionLabel as string | undefined,
          variables: (variables as Record<string, unknown>) ?? {},
          metadata: (metadata as Record<string, unknown>) ?? {},
          isActive: isActive ?? true,
          isSystem: isSystem ?? false,
          version: (version as string) ?? '1.0.0',
          createdBy: createdByStr ?? null
        } as typeof notificationTemplates.$inferInsert)
        .returning();

      Logger.log('info', 'general', 'createTemplate', 'Created notification template', { name });
      return template;
    } catch (error) {
      Logger.log('error', 'general', 'createTemplate', 'Error creating notification template', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get all templates
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Templates
   */
  async getTemplates(options: {
    category?: string;
    type?: string;
    isActive?: boolean | string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<unknown[]> {
    try {
      // Check cache first
      const cacheKey: Record<string, unknown> = { ...options };
      const cached = await notificationCacheService.getTemplateList(cacheKey);
      if (cached) {
        return cached as unknown[];
      }

      const {
        category,
        type,
        isActive, // Don't default - allow undefined to show all
        search,
        limit = 100,
        offset = 0
      } = options;

      const whereConditions = [];

      // Only filter by isActive if explicitly provided
      // undefined means show all (both active and inactive)
      if (isActive !== undefined && isActive !== null) {
        const activeValue = typeof isActive === 'string' ? isActive === 'true' : isActive;
        whereConditions.push(eq(notificationTemplates.isActive, activeValue));
      }

      if (category) {
        whereConditions.push(eq(notificationTemplates.category, category));
      }

      if (type) {
        whereConditions.push(eq(notificationTemplates.type, type));
      }

      if (search) {
        whereConditions.push(
          or(
            like(notificationTemplates.name, `%${search}%`),
            like(notificationTemplates.title, `%${search}%`),
            like(notificationTemplates.description, `%${search}%`)
          )
        );
      }

      const templates = await db
        .select()
        .from(notificationTemplates)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(notificationTemplates.createdAt))
        .limit(limit)
        .offset(offset);

      // Cache results
      await notificationCacheService.cacheTemplateList(cacheKey, templates);

      return templates;
    } catch (error) {
      Logger.log('error', 'general', 'getTemplates', 'Error getting templates', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Template
   */
  async getTemplate(templateId: string) {
    try {
      // Check cache first
      const cached = await notificationCacheService.getTemplate(templateId);
      if (cached) {
        return cached;
      }

      const [template] = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.templateId, templateId))
        .limit(1);

      if (!template) {
        throw new Error('Template not found');
      }

      // Cache template
      await notificationCacheService.cacheTemplate(templateId, template);

      return template;
    } catch (error) {
      Logger.log('error', 'general', 'getTemplate', 'Error getting template', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update template
   * @param {string} templateId - Template ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplate(templateId: string, updateData: Record<string, unknown>) {
    try {
      // Check if template exists and is not a system template
      const [existing] = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.templateId, templateId))
        .limit(1);

      if (!existing) {
        throw new Error('Template not found');
      }

      if (existing.isSystem && updateData.isSystem === false) {
        throw new Error('Cannot modify system template');
      }

      const [template] = await db
        .update(notificationTemplates)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(notificationTemplates.templateId, templateId))
        .returning();

      Logger.log('info', 'general', 'updateTemplate', 'Updated notification template', { templateId });

      // Invalidate cache
      await notificationCacheService.invalidateTemplate(templateId);

      return template;
    } catch (error) {
      Logger.log('error', 'general', 'updateTemplate', 'Error updating template', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Delete template
   * @param {string} templateId - Template ID
   * @returns {Promise<boolean>} Success
   */
  async deleteTemplate(templateId: string) {
    try {
      // Check if template is system template
      const [existing] = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.templateId, templateId))
        .limit(1);

      if (!existing) {
        throw new Error('Template not found');
      }

      if (existing.isSystem) {
        throw new Error('Cannot delete system template');
      }

      await db
        .delete(notificationTemplates)
        .where(eq(notificationTemplates.templateId, templateId));

      Logger.log('info', 'general', 'deleteTemplate', 'Deleted notification template', { templateId });

      // Invalidate cache
      await notificationCacheService.invalidateTemplate(templateId);

      return true;
    } catch (error) {
      Logger.log('error', 'general', 'deleteTemplate', 'Error deleting template', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Render template with variables
   * @param {string} templateId - Template ID
   * @param {Object} variables - Variables to substitute
   * @returns {Promise<Object>} Rendered notification data
   */
  async renderTemplate(templateId: string, variables: Record<string, string> = {}): Promise<Record<string, unknown>> {
    try {
      const template = await this.getTemplate(templateId) as {
        title: string;
        message: string;
        actionUrl?: string | null;
        actionLabel?: string | null;
        type: string;
        priority: string;
        metadata?: Record<string, unknown> | null;
        templateId: string;
        name: string;
      };

      // Simple variable substitution
      let title = template.title;
      let message = template.message;
      let actionUrl = template.actionUrl ?? undefined;
      let actionLabel = template.actionLabel ?? undefined;

      // Replace variables in title and message
      Object.keys(variables).forEach(key => {
        const value = variables[key];
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        title = title.replace(regex, value);
        message = message.replace(regex, value);
        if (actionUrl) {
          actionUrl = actionUrl.replace(regex, value);
        }
        if (actionLabel) {
          actionLabel = actionLabel.replace(regex, value);
        }
      });

      // Update last used timestamp
      await db
        .update(notificationTemplates)
        .set({
          lastUsedAt: new Date()
        })
        .where(eq(notificationTemplates.templateId, templateId));

      return {
        type: template.type,
        priority: template.priority,
        title,
        message,
        actionUrl,
        actionLabel,
        metadata: {
          ...(template.metadata ?? {}),
          templateId: template.templateId,
          templateName: template.name,
          variables
        }
      };
    } catch (error) {
      Logger.log('error', 'general', 'renderTemplate', 'Error rendering template', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get template categories
   * @returns {Object} Categories
   */
  getCategories() {
    return TEMPLATE_CATEGORIES;
  }
}

export { NotificationTemplateService };
export default NotificationTemplateService;
