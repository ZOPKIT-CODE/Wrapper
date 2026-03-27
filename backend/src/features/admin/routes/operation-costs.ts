import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../../db/index.js';
import { 
  creditConfigurations
} from '../../../db/schema/index.js';
import { eq, sql, count, avg, desc, and } from 'drizzle-orm';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { requirePlatformPermission } from '../../../middleware/auth/platform-permission-middleware.js';
import { amazonMQPublisher } from '../../messaging/utils/amazon-mq-publisher.js';

/**
 * Admin Operation Cost Management Routes
 * Handles global operation cost configuration and analytics
 */

export default async function operationCostRoutes(fastify: FastifyInstance, _options?: object): Promise<void> {
  const publishCreditConfigToTargets = async (
    config: Record<string, unknown>,
    changeType: 'created' | 'updated' | 'deleted',
    actor: string
  ): Promise<void> => {
    try {
      const operationCode = String(config.operationCode ?? '');
      const parts = operationCode.split('.');
      const moduleName = parts.length > 1 ? parts[1] : null;
      const permissionName = parts.length > 2 ? parts.slice(2).join('.') : null;
      const isGlobal = config.isGlobal === true || config.tenantId == null;
      const configId = String(config.configId ?? '');
      const tenantIdForMessage = String(config.tenantId ?? 'global');

      if (!operationCode || !configId) {
        return;
      }

      const payload = {
        configId,
        tenantId: config.tenantId ?? null,
        configName: String(config.operationName ?? operationCode),
        operationCode,
        description: null,
        creditCost: Number(config.creditCost ?? 0),
        unit: String(config.unit ?? 'operation'),
        isGlobal,
        source: isGlobal ? 'global' : 'tenant',
        moduleName,
        permissionName,
        syncSource: 'wrapper',
        changeType,
      };

      // Keep FA behavior and extend to Ops for global/operation-cost updates.
      for (const targetApp of ['accounting', 'operations']) {
        try {
          await amazonMQPublisher.publishCreditEvent(
            targetApp,
            'credit.config.updated',
            tenantIdForMessage,
            payload,
            actor || 'system'
          );
        } catch (publishErr: unknown) {
          const error = publishErr as Error;
          fastify.log.warn(
            { err: error, targetApp, configId: config.configId, operationCode: config.operationCode },
            'Failed to publish credit config update event'
          );
        }
      }
    } catch (publishErr: unknown) {
      const error = publishErr as Error;
      fastify.log.warn(
        { err: error, configId: config.configId, operationCode: config.operationCode },
        'Failed to publish credit config update event'
      );
    }
  };

  // All routes require authentication and admin permissions
  fastify.addHook('preHandler', authenticateToken);

  /**
   * GET /api/admin/operation-costs/global
   * Get global operation cost configurations only
   */
  fastify.get('/global', {
    schema: {
      description: 'Get global operation cost configurations only',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const queryParams = request.query as Record<string, string>;
    try {
      const search = queryParams.search;
      const category = queryParams.category;
      const isActive = queryParams.isActive;

      // Build where conditions - specifically for global configurations
      let conditions = [
        eq(creditConfigurations.isGlobal, true),
        sql`${creditConfigurations.tenantId} IS NULL`
      ];

      if (search) {
        conditions.push(sql`${creditConfigurations.operationCode} ILIKE ${`%${search}%`}`);
      }

      if (category) {
        conditions.push(sql`split_part(${creditConfigurations.operationCode}, '.', 1) = ${category}`);
      }

      if (isActive !== undefined) {
        conditions.push(eq(creditConfigurations.isActive, isActive === 'true'));
      }

      // Base query for global configurations only
      const dbQuery = db
        .select({
          configId: creditConfigurations.configId,
          operationCode: creditConfigurations.operationCode,
          creditCost: creditConfigurations.creditCost,
          unit: creditConfigurations.unit,
          unitMultiplier: creditConfigurations.unitMultiplier,
          isGlobal: creditConfigurations.isGlobal,
          isActive: creditConfigurations.isActive,
          createdAt: creditConfigurations.createdAt,
          updatedAt: creditConfigurations.updatedAt,
          category: sql`split_part(${creditConfigurations.operationCode}, '.', 1)`,
          priority: sql`100`
        })
        .from(creditConfigurations)
        .where(and(...conditions));

      const operations = await dbQuery.orderBy(creditConfigurations.operationCode) as any[];

      // Transform operations to include calculated fields
      const operationsWithDetails = operations.map((op: any) => ({
        ...op,
        operationName: op.operationCode.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim(),
        category: getCategoryDisplayName(String(op.category ?? '')),
        priority: op.priority || 100,
        isCustomized: false // Global configs are never customized
      }));

      return reply.send({
        success: true,
        data: {
          operations: operationsWithDetails,
          type: 'global',
          totalCount: operationsWithDetails.length
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching global operation costs:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch global operation costs'
      });
    }
  });

  /**
   * GET /api/admin/operation-costs/tenant/:tenantId
   * Get tenant-specific operation cost configurations only
   */
  fastify.get('/tenant/:tenantId', {
    schema: {
      description: 'Get tenant-specific operation cost configurations only',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const queryParams = request.query as Record<string, string>;
    try {
      const tenantId = params.tenantId ?? '';
      const search = queryParams.search;
      const category = queryParams.category;
      const isActive = queryParams.isActive;

      // Verify tenant access
      const userContext = (request as any).userContext;
      if (!userContext?.isSuperAdmin && !request.platformStaff && userContext?.tenantId !== tenantId) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied to this tenant\'s operation costs'
        });
      }

      // Build where conditions - specifically for tenant-specific configurations
      let conditions = [
        eq(creditConfigurations.isGlobal, false),
        eq(creditConfigurations.tenantId, tenantId)
      ];

      if (search) {
        conditions.push(sql`${creditConfigurations.operationCode} ILIKE ${`%${search}%`}`);
      }

      if (category) {
        conditions.push(sql`split_part(${creditConfigurations.operationCode}, '.', 1) = ${category}`);
      }

      if (isActive !== undefined) {
        conditions.push(eq(creditConfigurations.isActive, isActive === 'true'));
      }

      // Base query for tenant-specific configurations only
      let tenantQuery = db
        .select({
          configId: creditConfigurations.configId,
          operationCode: creditConfigurations.operationCode,
          creditCost: creditConfigurations.creditCost,
          unit: creditConfigurations.unit,
          unitMultiplier: creditConfigurations.unitMultiplier,
          isGlobal: creditConfigurations.isGlobal,
          isActive: creditConfigurations.isActive,
          createdAt: creditConfigurations.createdAt,
          updatedAt: creditConfigurations.updatedAt,
          category: sql`split_part(${creditConfigurations.operationCode}, '.', 1)`,
          priority: sql`100`
        })
        .from(creditConfigurations)
        .where(and(...conditions));

      const operations = await tenantQuery.orderBy(creditConfigurations.operationCode) as any[];

      // Transform operations to include calculated fields
      const operationsWithDetails = operations.map((op: any) => ({
        ...op,
        operationName: op.operationCode.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim(),
        category: getCategoryDisplayName(String(op.category ?? '')),
        priority: op.priority || 100,
        isCustomized: true // Tenant-specific configs are always customized
      }));

      return reply.send({
        success: true,
        data: {
          operations: operationsWithDetails,
          type: 'tenant',
          tenantId: tenantId,
          totalCount: operationsWithDetails.length
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching tenant operation costs:');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenant operation costs'
      });
    }
  });

  /**
   * POST /api/admin/operation-costs
   * Create a new operation cost configuration (global or tenant-specific)
   */
  fastify.post('/', {
    schema: {
      description: 'Create a new operation cost configuration (global or tenant-specific)',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const operationCode = body.operationCode;
      const operationName = body.operationName;
      const creditCost = body.creditCost;
      const unit = (body.unit as string) ?? 'operation';
      const unitMultiplier = Number(body.unitMultiplier) ?? 1;
      const category = body.category;
      const isActive = body.isActive !== false;
      const priority = Number(body.priority) ?? 100;
      const isGlobal = body.isGlobal !== false;
      const tenantId = body.tenantId;
      const userId = (request as any).userContext?.internalUserId ?? '';

      console.log('📝 Creating operation cost:', {
        operationCode,
        operationName,
        creditCost,
        unit,
        unitMultiplier,
        category,
        isActive,
        priority,
        isGlobal,
        tenantId,
        userId
      });

      // Validate operation code format
      if (!operationCode || typeof operationCode !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Invalid operation code: must be a non-empty string'
        });
      }

      if (!operationCode.includes('.') || operationCode.split('.').length < 3) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid operation code format: must be in format "app.module.operation" (e.g., "crm.leads.create")'
        });
      }

      // Validate credit cost
      const costNum = Number(creditCost);
      if (typeof costNum !== 'number' || isNaN(costNum) || costNum < 0) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid credit cost: must be a positive number'
        });
      }

      // Check if configuration already exists for this operation (global or tenant-specific)
      // Use more robust duplicate checking to handle null tenant_id properly
      let existingConditions = [eq(creditConfigurations.operationCode, operationCode)];

      if (isGlobal) {
        // For global configurations: check where tenant_id IS NULL
        existingConditions.push(sql`${creditConfigurations.tenantId} IS NULL`);
        existingConditions.push(eq(creditConfigurations.isGlobal, true));
      } else if (tenantId) {
        // For tenant-specific configurations: check specific tenant_id
        existingConditions.push(eq(creditConfigurations.tenantId, String(tenantId)));
        existingConditions.push(eq(creditConfigurations.isGlobal, false));
      }

      const existing = await (db as any)
        .select()
        .from(creditConfigurations)
        .where(and(...existingConditions))
        .limit(1);

      console.log('🔍 Duplicate check result:', {
        operationCode,
        isGlobal,
        tenantId,
        existingCount: existing.length,
        existingConfig: existing.length > 0 ? {
          configId: existing[0].configId,
          tenantId: existing[0].tenantId,
          isGlobal: existing[0].isGlobal
        } : null
      });

      if (existing.length > 0) {
        // Update existing configuration instead of throwing error
        console.log('⚙️ Updating existing operation cost configuration');

        const updateData: Record<string, unknown> = {
          creditCost: String(costNum),
          unit,
          unitMultiplier: String(unitMultiplier),
          isActive,
          updatedBy: userId,
          updatedAt: new Date()
        };

        if (operationName !== undefined) updateData.operationName = operationName;
        if (category !== undefined) updateData.category = category;
        if (priority !== undefined) updateData.priority = priority;

        const updatedConfig = await db
          .update(creditConfigurations)
          .set(updateData as any)
          .where(eq(creditConfigurations.configId, existing[0].configId))
          .returning() as any;

        await publishCreditConfigToTargets(updatedConfig[0] as Record<string, unknown>, 'updated', userId);

        console.log('✅ Operation cost configuration updated successfully:', updatedConfig[0]);
        return {
          success: true,
          data: {
            configuration: updatedConfig[0],
            action: 'updated'
          }
        };
      }

      // Validate user exists
      const { tenantUsers } = await import('../../../db/schema/index.js');
      const userExists = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, userId))
        .limit(1);

      if (userExists.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid user ID'
        });
      }

      // Prepare configuration data for global or tenant-specific configuration
      const configData: Record<string, unknown> = {
        operationCode: String(operationCode),
        operationName,
        creditCost: String(costNum),
        unit,
        unitMultiplier: String(unitMultiplier),
        category,
        isGlobal,
        isActive,
        priority,
        scope: isGlobal ? 'global' : 'tenant',
        createdBy: userId,
        updatedBy: userId
      };

      if (!isGlobal && tenantId) {
        configData.tenantId = tenantId;
      }

      // Create configuration
      console.log('📝 Inserting configuration data:', configData);
      
      const newConfig = await db
        .insert(creditConfigurations)
        .values(configData as any)
        .returning();

      await publishCreditConfigToTargets(newConfig[0] as Record<string, unknown>, 'created', userId);
        
      const configType = isGlobal ? 'Global' : 'Tenant-specific';
      console.log(`✅ Successfully created ${configType.toLowerCase()} configuration:`, newConfig[0]);

      return reply.code(201).send({
        success: true,
        message: `${configType} operation cost created successfully`,
        data: {
          operation: newConfig[0],
          action: 'created'
        }
      });
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      console.error('❌ Error creating operation cost:', err);
      request.log.error(error, 'Error creating operation cost:');
      
      let errorMessage = 'Failed to create operation cost';
      if (error.code === '23505') {
        errorMessage = 'Operation cost configuration already exists. Please try updating instead.';
      } else if (error.code === '23503') {
        errorMessage = 'Invalid user ID or foreign key constraint violation';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      return reply.code(500).send({ 
        success: false, 
        error: errorMessage,
        details: error?.message ?? '' 
      });
    }
  });

  /**
   * PUT /api/admin/operation-costs/:configId
   * Update an operation cost configuration
   */
  fastify.put('/:configId', {
    schema: {
      description: 'Update an operation cost configuration',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    try {
      const configId = params.configId ?? '';
      const updateData = body;
      const userId = (request as any).userContext?.internalUserId ?? '';

      console.log('🔄 Updating operation cost:', { configId, updateData, userId });

      // Verify configuration exists
      const existing = await db
        .select()
        .from(creditConfigurations)
        .where(eq(creditConfigurations.configId, configId))
        .limit(1);

      if (existing.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Operation cost configuration not found'
        });
      }

      console.log('📋 Existing config:', existing[0]);

      const validFields = ['operationCode', 'creditCost', 'unit', 'unitMultiplier', 'isGlobal', 'isActive'];
      const filteredUpdateData: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(updateData)) {
        if (validFields.includes(key)) {
          filteredUpdateData[key] = value;
        }
      }

      console.log('📝 Filtered update data:', filteredUpdateData);

      const processedUpdateData = { ...filteredUpdateData };
      if (processedUpdateData.creditCost !== undefined) {
        processedUpdateData.creditCost = String(processedUpdateData.creditCost);
      }
      if (processedUpdateData.unitMultiplier !== undefined) {
        processedUpdateData.unitMultiplier = String(processedUpdateData.unitMultiplier);
      }

      const updated = await db
        .update(creditConfigurations)
        .set({
          ...processedUpdateData,
          updatedBy: userId,
          updatedAt: new Date()
        } as any)
        .where(eq(creditConfigurations.configId, configId))
        .returning();

      await publishCreditConfigToTargets(updated[0] as Record<string, unknown>, 'updated', userId);

      return reply.send({
        success: true,
        data: {
          operation: updated[0]
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error updating operation cost:');
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to update operation cost' 
      });
    }
  });

  /**
   * DELETE /api/admin/operation-costs/:configId
   * Delete an operation cost configuration
   */
  fastify.delete('/:configId', {
    schema: {
      description: 'Delete an operation cost configuration',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const configId = params.configId ?? '';

      const existing = await db
        .select()
        .from(creditConfigurations)
        .where(eq(creditConfigurations.configId, configId))
        .limit(1);

      if (existing.length === 0) {
        return reply.code(404).send({ 
          success: false, 
          error: 'Operation cost configuration not found' 
        });
      }

      await db
        .delete(creditConfigurations)
        .where(eq(creditConfigurations.configId, configId));

      await publishCreditConfigToTargets(existing[0] as Record<string, unknown>, 'deleted', 'system');

      return reply.code(204).send({ success: true });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error deleting operation cost:');
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to delete operation cost' 
      });
    }
  });

  /**
   * GET /api/admin/operation-costs/analytics
   * Get operation cost analytics and insights
   */
  fastify.get('/analytics', {
    schema: {
      description: 'Get operation cost analytics',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get basic stats
      const totalOps = await db
        .select({ count: count() })
        .from(creditConfigurations)
        .where(eq(creditConfigurations.isActive, true));

      const avgCost = await db
        .select({ avg: avg(creditConfigurations.creditCost) })
        .from(creditConfigurations)
        .where(eq(creditConfigurations.isActive, true));

      const mostExpensive = await db
        .select()
        .from(creditConfigurations)
        .where(eq(creditConfigurations.isActive, true))
        .orderBy(desc(creditConfigurations.creditCost))
        .limit(1);

      const leastExpensive = await db
        .select()
        .from(creditConfigurations)
        .where(eq(creditConfigurations.isActive, true))
        .orderBy(creditConfigurations.creditCost)
        .limit(1);

      // Get category costs
      const categoryCosts = await db
        .select({
          category: sql`split_part(${creditConfigurations.operationCode}, '.', 1)`,
          operationCount: count(),
          averageCost: avg(creditConfigurations.creditCost),
          totalUsage: sql`0` // Placeholder - would come from usage tables
        })
        .from(creditConfigurations)
        .where(eq(creditConfigurations.isActive, true))
        .groupBy(sql`split_part(${creditConfigurations.operationCode}, '.', 1)`);

      const transformedCategoryCosts = categoryCosts.map((cat: any) => ({
        category: getCategoryDisplayName(String(cat.category ?? '')),
        operationCount: parseInt(String(cat.operationCount ?? 0), 10),
        averageCost: parseFloat(String(cat.averageCost ?? 0)),
        totalUsage: parseInt(String(cat.totalUsage ?? 0), 10)
      }));

      return reply.send({
        success: true,
        data: {
          totalOperations: (totalOps[0] as any)?.count ?? 0,
          averageCost: parseFloat(String((avgCost[0] as any)?.avg ?? 0)),
          mostExpensive: mostExpensive[0] || null,
          leastExpensive: leastExpensive[0] || null,
          categoryCosts: transformedCategoryCosts
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching operation cost analytics:');
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to fetch operation cost analytics' 
      });
    }
  });

  /**
   * GET /api/admin/operation-costs/templates
   * Get cost configuration templates
   */
  fastify.get('/templates', {
    schema: {
      description: 'Get cost configuration templates',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const templates = [
        {
          templateId: 'basic-crm',
          templateName: 'Basic CRM Operations',
          templateCode: 'basic_crm',
          description: 'Standard cost configuration for CRM operations',
          category: 'CRM',
          isDefault: true,
          version: '1.0',
          usageCount: 15,
          operations: [
            { operationCode: 'crm.leads.create', creditCost: 0.5 },
            { operationCode: 'crm.contacts.create', creditCost: 0.3 },
            { operationCode: 'crm.deals.create', creditCost: 1.0 },
            { operationCode: 'crm.activities.create', creditCost: 0.2 }
          ]
        },
        {
          templateId: 'basic-hr',
          templateName: 'Basic HR Operations',
          templateCode: 'basic_hr',
          description: 'Standard cost configuration for HR operations',
          category: 'HR',
          isDefault: false,
          version: '1.0',
          usageCount: 8,
          operations: [
            { operationCode: 'hr.employees.create', creditCost: 2.0 },
            { operationCode: 'hr.payroll.process', creditCost: 5.0 },
            { operationCode: 'hr.attendance.track', creditCost: 0.1 },
            { operationCode: 'hr.performance.review', creditCost: 3.0 }
          ]
        },
        {
          templateId: 'premium-suite',
          templateName: 'Premium Suite Operations',
          templateCode: 'premium_suite',
          description: 'Comprehensive cost configuration for all applications',
          category: 'Suite',
          isDefault: false,
          version: '1.0',
          usageCount: 3,
          operations: [
            { operationCode: 'crm.leads.create', creditCost: 0.3 },
            { operationCode: 'hr.employees.create', creditCost: 1.5 },
            { operationCode: 'accounting.invoices.create', creditCost: 1.0 },
            { operationCode: 'inventory.items.create', creditCost: 0.5 }
          ]
        }
      ];

      return reply.send({
        success: true,
        data: {
          templates
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching templates:');
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to fetch templates' 
      });
    }
  });

  /**
   * POST /api/admin/operation-costs/apply-template
   * Apply a cost configuration template
   */
  fastify.post('/apply-template', {
    schema: {
      description: 'Apply a cost configuration template',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:write')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const templateId = body.templateId as string;
      const userId = (request as any).userContext?.internalUserId ?? '';

      // Get template (this would normally come from a database)
      const templates = {
        'basic-crm': [
          { operationCode: 'crm.leads.create', creditCost: 0.5, unit: 'operation' },
          { operationCode: 'crm.contacts.create', creditCost: 0.3, unit: 'operation' },
          { operationCode: 'crm.deals.create', creditCost: 1.0, unit: 'operation' },
          { operationCode: 'crm.activities.create', creditCost: 0.2, unit: 'operation' }
        ],
        'basic-hr': [
          { operationCode: 'hr.employees.create', creditCost: 2.0, unit: 'operation' },
          { operationCode: 'hr.payroll.process', creditCost: 5.0, unit: 'operation' },
          { operationCode: 'hr.attendance.track', creditCost: 0.1, unit: 'operation' },
          { operationCode: 'hr.performance.review', creditCost: 3.0, unit: 'operation' }
        ]
      };

      const templateOperations = (templates as Record<string, any[]>)[templateId];
      if (!templateOperations) {
        return reply.code(404).send({ 
          success: false, 
          error: 'Template not found' 
        });
      }

      // Apply template operations
      const created = [];
      const skipped = [];
      const updated = [];

      for (const operation of templateOperations) {
        // Check if global operation already exists (tenant_id IS NULL)
        const existing = await db
          .select()
          .from(creditConfigurations)
          .where(and(
            eq(creditConfigurations.operationCode, operation.operationCode),
            sql`${creditConfigurations.tenantId} IS NULL`,
            eq(creditConfigurations.isGlobal, true)
          ))
          .limit(1);

        if (existing.length === 0) {
          // Create new configuration
          const newConfig = await db
            .insert(creditConfigurations)
            .values({
              operationCode: operation.operationCode,
              creditCost: operation.creditCost.toString(),
              unit: operation.unit || 'operation',
              unitMultiplier: '1.0000',
              isGlobal: true,
              isActive: true,
              createdBy: userId,
              updatedBy: userId
            })
            .returning();

          await publishCreditConfigToTargets(newConfig[0] as Record<string, unknown>, 'created', userId);
          created.push(newConfig[0]);
        } else {
          // Update existing configuration if credit cost is different
          if (existing[0].creditCost !== operation.creditCost.toString()) {
            const updatedConfig = await db
              .update(creditConfigurations)
              .set({
                creditCost: operation.creditCost.toString(),
                unit: operation.unit || 'operation',
                unitMultiplier: '1.0000',
                updatedBy: userId,
                updatedAt: new Date()
              })
              .where(eq(creditConfigurations.configId, existing[0].configId))
              .returning();

            await publishCreditConfigToTargets(updatedConfig[0] as Record<string, unknown>, 'updated', userId);
            updated.push(updatedConfig[0]);
          } else {
            skipped.push(operation.operationCode);
          }
        }
      }

      return reply.send({
        success: true,
        data: {
          message: `Applied template: ${templateId}`,
          created: created.length,
          updated: updated.length,
          skipped: skipped.length,
          totalProcessed: templateOperations.length,
          operations: {
            created: created.map((op: any) => op.operationCode),
            updated: updated.map((op: any) => op.operationCode),
            skipped: skipped
          }
        }
      });
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error applying template:');
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to apply template' 
      });
    }
  });

  /**
   * GET /api/admin/operation-costs/export
   * Export operation costs as CSV
   */
  fastify.get('/export', {
    schema: {
      description: 'Export operation costs as CSV',
      tags: ['Admin', 'Operation Costs']
    },
    preHandler: requirePlatformPermission('credit_config:read')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const operations = await db
        .select()
        .from(creditConfigurations)
        .orderBy(creditConfigurations.operationCode) as any[];

      const csvHeader = 'Operation Code,Credit Cost,Unit,Unit Multiplier,Is Global,Is Active,Created At\n';
      const csvRows = operations.map((op: any) => 
        `"${op.operationCode}",${op.creditCost},"${op.unit}",${op.unitMultiplier},${op.isGlobal},${op.isActive},"${op.createdAt}"`
      ).join('\n');

      const csv = csvHeader + csvRows;

      reply.type('text/csv');
      reply.header('Content-Disposition', 'attachment; filename="operation-costs.csv"');
      return csv;
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error exporting operation costs:');
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to export operation costs' 
      });
    }
  });
}

function getCategoryDisplayName(category: string): string {
  const categoryMap = {
    'crm': 'CRM Operations',
    'hr': 'HR Operations',
    'accounting': 'Accounting Operations',
    'inventory': 'Inventory Operations',
    'affiliate': 'Affiliate Operations',
    'data': 'Data Processing',
    'comm': 'Communication',
    'analytics': 'Analytics',
    'file': 'File Operations',
    'integration': 'Integration',
    'security': 'Security',
    'admin': 'Administration'
  };

  return (categoryMap as Record<string, string>)[category] || 'Other';
}
