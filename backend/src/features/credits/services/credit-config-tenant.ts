import { db, systemDbConnection } from '../../../db/index.js';
import { creditConfigurations } from '../../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';
import { getModulePermissions } from './credit-core.js';
import { getGlobalOperationConfigs, getGlobalModuleConfigs, getGlobalAppConfigs } from './credit-config-global.js';

const DEFAULT_CREDIT_EVENT_TARGET_APPS = ['crm', 'accounting', 'ops'];

function getCreditEventTargetApps(): string[] {
  const fromEnv = process.env.BUSINESS_SUITE_TARGET_APPS
    ?.split(',')
    .map((app) => app.trim().toLowerCase())
    .filter(Boolean) ?? [];

  const normalized = (fromEnv.length > 0 ? fromEnv : DEFAULT_CREDIT_EVENT_TARGET_APPS).map((app) =>
    app === 'operations' ? 'ops' : app
  );

  if (!normalized.includes('ops')) normalized.push('ops');
  return Array.from(new Set(normalized));
}

async function publishCreditConfigEventToSuite(
  tenantId: string,
  eventPayload: Record<string, unknown>
): Promise<void> {
  const targetApps = getCreditEventTargetApps();
  const eventType = 'credit_config_updated';
  const changeType = String(eventPayload.changeType ?? 'unknown');
  const operationCode = eventPayload.operationCode ? String(eventPayload.operationCode) : undefined;

  console.log('📣 Publishing credit config event', {
    eventType,
    changeType,
    tenantId,
    operationCode,
    targetApps,
  });

  for (const app of targetApps) {
    try {
      await snsSqsPublisher.publishCreditEvent(app, eventType, tenantId, eventPayload);
      console.log(`✅ Published ${eventType} to ${app} for tenant ${tenantId}`);
    } catch (streamErr: unknown) {
      const streamError = streamErr as Error;
      console.warn(`⚠️ Failed to publish credit config change event to ${app}:`, streamError.message);
    }
  }
}

/**
 * Get all credit configurations for a tenant (tenant-specific + global fallback)
 */
export async function getTenantConfigurations(tenantId: string): Promise<Record<string, unknown>> {
  try {
    console.log('🔍 Getting tenant configurations for:', tenantId);

    // Get tenant-specific configurations with error handling
    const [tenantOperations, tenantModules, tenantApps] = await Promise.all([
      getTenantOperationConfigs(tenantId).catch(() => []),
      Promise.resolve([]), // Module configs removed for MVP simplicity
      Promise.resolve([])  // App configs removed for MVP simplicity
    ]);

    // Get global configurations as fallback with error handling
    const [globalOperations, globalModules, globalApps] = await Promise.all([
      getGlobalOperationConfigs().catch(() => []),
      getGlobalModuleConfigs().catch(() => []),
      getGlobalAppConfigs().catch(() => [])
    ]);

    return {
      tenantId,
      configurations: {
        operations: tenantOperations,
        modules: tenantModules,
        apps: tenantApps
      },
      globalConfigs: {
        operations: globalOperations,
        modules: globalModules,
        apps: globalApps
      }
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error getting tenant configurations:', error);
    // Return empty configuration structure if tables don't exist
    return {
      tenantId,
      configurations: {
        operations: [],
        modules: [],
        apps: []
      },
      globalConfigs: {
        operations: [],
        modules: [],
        apps: []
      }
    };
  }
}

/**
 * Get tenant-specific operation configurations
 */
export async function getTenantOperationConfigs(tenantId: string): Promise<Record<string, unknown>[]> {
  try {
    // Use system database connection for admin operations (bypasses RLS)
    const configs = await systemDbConnection
      .select()
      .from(creditConfigurations)
      .where(and(
        eq(creditConfigurations.tenantId, tenantId),
        eq(creditConfigurations.isGlobal, false)
      ))
      .orderBy(creditConfigurations.operationCode);

    return configs.map(config => ({
      configId: config.configId,
      operationCode: config.operationCode,
      creditCost: parseFloat(String(config.creditCost)),
      unit: config.unit,
      unitMultiplier: parseFloat(String(config.unitMultiplier ?? 1)),
      freeAllowance: config.freeAllowance,
      freeAllowancePeriod: config.freeAllowancePeriod,
      volumeTiers: config.volumeTiers ?? [],
      allowOverage: config.allowOverage,
      overageLimit: config.overageLimit,
      overagePeriod: config.overagePeriod,
      overageCost: config.overageCost ? parseFloat(String(config.overageCost)) : null,
      isActive: config.isActive,
      isCustomized: (config as Record<string, unknown>).isCustomized ?? false,
      priority: config.priority,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }));
  } catch (err: unknown) {
    const error = err as Error;
    if ((error as Error & { code?: string }).code === '42P01' || error.message.includes('does not exist')) {
      return [];
    }
    console.error('Error getting tenant operation configs:', error);
    throw error;
  }
}

/**
 * Set tenant-specific operation configuration
 */
export async function setTenantOperationConfig(operationCode: string, configData: Record<string, unknown>, userId: string, tenantId: string): Promise<Record<string, unknown>> {
  try {
    console.log('⚙️ Setting tenant operation config:', { operationCode, tenantId });

    // Validate required fields
    if (!operationCode || !configData) {
      throw new Error('Operation code and configuration data are required');
    }

    // Validate creditCost is provided and valid
    if (configData.creditCost == null || isNaN(parseFloat(String(configData.creditCost)))) {
      throw new Error('Valid credit cost is required');
    }

    // Check if configuration already exists
    const existing = await db
      .select()
      .from(creditConfigurations)
      .where(and(
        eq(creditConfigurations.operationCode, operationCode),
        eq(creditConfigurations.tenantId, tenantId),
        eq(creditConfigurations.isGlobal, false)
      ));

    const configPayload: Record<string, unknown> = {
      operationCode,
      tenantId,
      isGlobal: false,
      creditCost: configData.creditCost ? String(configData.creditCost) : '1.0000',
      unit: (configData.unit as string) || 'operation',
      unitMultiplier: configData.unitMultiplier ? String(configData.unitMultiplier) : '1.0000',
      freeAllowance: configData.freeAllowance ?? null,
      freeAllowancePeriod: (configData.freeAllowancePeriod as string) ?? null,
      volumeTiers: configData.volumeTiers ? JSON.stringify(configData.volumeTiers) : null,
      allowOverage: configData.allowOverage ?? false,
      overageLimit: configData.overageLimit ?? null,
      overagePeriod: (configData.overagePeriod as string) ?? null,
      overageCost: configData.overageCost != null ? String(configData.overageCost) : null,
      scope: 'tenant',
      priority: 100,
      isActive: configData.isActive ?? true,
      updatedBy: userId,
      updatedAt: new Date()
    };

    let result: { configId: string; operationCode: string; creditCost: string; unit: string | null; unitMultiplier: string | null; freeAllowance: number | null; freeAllowancePeriod: string | null; volumeTiers: string | null; allowOverage: boolean | null; overageLimit: number | null; overagePeriod: string | null; overageCost: string | null; isActive: boolean | null; updatedBy: string | null; updatedAt: Date | null }[];
    if (existing.length > 0) {
      const { operationCode: _oc, tenantId: _tid, isGlobal: _ig, ...updatePayload } = configPayload;
      result = await db
        .update(creditConfigurations)
        .set(updatePayload as any)
        .where(eq(creditConfigurations.configId, existing[0].configId))
        .returning();
    } else {
      const insertPayload = { ...configPayload, createdBy: userId, createdAt: new Date() };
      result = await db
        .insert(creditConfigurations)
        .values(insertPayload as any)
        .returning();
    }

    // Log configuration change (no-op: configurationChangeHistory table removed)
    await logConfigurationChange({
      configType: 'operation',
      configId: result[0].configId,
      operationCode,
      entityType: 'tenant',
      entityId: tenantId,
      changeType: existing.length > 0 ? 'update' : 'create',
      oldValues: existing.length > 0 ? existing[0] : null,
      newValues: result[0],
      changedBy: userId
    });

    const r0 = result[0];
    const configEventPayload = {
      configId: r0.configId,
      operationCode: r0.operationCode,
      creditCost: parseFloat(String(r0.creditCost)),
      unit: r0.unit,
      unitMultiplier: parseFloat(String(r0.unitMultiplier ?? 1)),
      freeAllowance: r0.freeAllowance,
      freeAllowancePeriod: r0.freeAllowancePeriod,
      volumeTiers: r0.volumeTiers,
      allowOverage: r0.allowOverage,
      overageLimit: r0.overageLimit,
      overagePeriod: r0.overagePeriod,
      overageCost: r0.overageCost ? parseFloat(String(r0.overageCost)) : null,
      isActive: r0.isActive,
      updatedBy: r0.updatedBy,
      entityId: r0.configId,
      updatedAt: r0.updatedAt,
      changeType: existing.length > 0 ? 'updated' : 'created',
      previousConfig: existing.length > 0 ? {
        creditCost: parseFloat(String(existing[0].creditCost)),
        unit: existing[0].unit,
        isActive: existing[0].isActive
      } : null
    };
    await publishCreditConfigEventToSuite(tenantId, configEventPayload);

    return {
      success: true,
      config: result[0],
      action: existing.length > 0 ? 'updated' : 'created'
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error setting tenant operation config:', error);
    throw error;
  }
}

/**
 * Set tenant-specific module configuration
 */
export async function setTenantModuleConfig(moduleCode: string, configData: Record<string, unknown>, userId: string, tenantId: string): Promise<Record<string, unknown>> {
  try {
    console.log('⚙️ Setting tenant module config:', { moduleCode, tenantId });

    // Get real permissions from the application modules table
    const moduleOperations = await getModulePermissions(moduleCode);

    const results = [];

    // Create or update configurations for each operation in the module
    for (const operationCode of moduleOperations) {
      try {
        // Check if configuration already exists
        const existing = await systemDbConnection
          .select()
          .from(creditConfigurations)
          .where(and(
            eq(creditConfigurations.operationCode, operationCode),
            eq(creditConfigurations.tenantId, tenantId),
            eq(creditConfigurations.isGlobal, false)
          ));

        const configPayload = {
          operationCode,
          tenantId,
          isGlobal: false,
          creditCost: configData.defaultCreditCost?.toString() || '1.0',
          unit: configData.defaultUnit || 'operation',
          unitMultiplier: '1',
          freeAllowance: configData.maxOperationsPerPeriod || 1000,
          freeAllowancePeriod: configData.periodType || 'monthly',
          volumeTiers: [],
          allowOverage: configData.allowOverBudget || false,
          overageLimit: null,
          overagePeriod: null,
          overageCost: null,
          isActive: configData.isActive ?? true,
          updatedBy: userId,
          updatedAt: new Date()
        };

        let result: { configId: string }[];
        if (existing.length > 0) {
          result = await systemDbConnection
            .update(creditConfigurations)
            .set(configPayload as any)
            .where(eq(creditConfigurations.configId, existing[0].configId))
            .returning();
        } else {
          (configPayload as Record<string, unknown>).createdBy = userId;
          (configPayload as Record<string, unknown>).createdAt = new Date();
          result = await systemDbConnection
            .insert(creditConfigurations)
            .values(configPayload as any)
            .returning();
        }

        results.push(result[0]);
      } catch (opErr: unknown) {
        const opError = opErr as Error;
        console.warn(`Failed to set config for operation ${operationCode}:`, opError);
      }
    }

    console.log('✅ Tenant module config set successfully for', results.length, 'operations');
    if (results.length > 0) {
      await publishCreditConfigEventToSuite(tenantId, {
        changeType: 'module_updated',
        configType: 'module',
        moduleCode,
        operationsConfigured: results.length,
        operationCodes: moduleOperations,
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      configs: results,
      operationsConfigured: results.length,
      action: 'bulk_created_updated'
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error setting tenant module config:', error);
    throw error;
  }
}

/**
 * Set tenant-specific app configuration
 */
export async function setTenantAppConfig(appCode: string, configData: Record<string, unknown>, userId: string, tenantId: string): Promise<Record<string, unknown>> {
  try {
    console.log('⚙️ Setting tenant app config:', { appCode, tenantId });

    // Create system-level operations for the app
    const appOperations = [
      `${appCode}.system.access`,
      `${appCode}.system.admin`,
      `${appCode}.system.configure`,
      `${appCode}.system.integrate`,
      `${appCode}.system.report`,
      `${appCode}.system.export`
    ];

    const results = [];

    // Create or update configurations for each operation in the app
    for (const operationCode of appOperations) {
      try {
        // Check if configuration already exists
        const existing = await systemDbConnection
          .select()
          .from(creditConfigurations)
          .where(and(
            eq(creditConfigurations.operationCode, operationCode),
            eq(creditConfigurations.tenantId, tenantId),
            eq(creditConfigurations.isGlobal, false)
          ));

        const configPayload: Record<string, unknown> = {
          operationCode,
          tenantId,
          isGlobal: false,
          creditCost: configData.defaultCreditCost != null ? String(configData.defaultCreditCost) : '2.0',
          unit: (configData.defaultUnit as string) || 'operation',
          unitMultiplier: '1',
          freeAllowance: (configData.maxMonthlyOperations as number) || 5000,
          freeAllowancePeriod: 'monthly',
          volumeTiers: [],
          allowOverage: configData.allowOverBudget !== false,
          overageLimit: configData.maxMonthlyOperations ? (configData.maxMonthlyOperations as number) * 2 : null,
          overagePeriod: 'monthly',
          overageCost: (parseFloat(String(configData.defaultCreditCost ?? '2.0')) * 1.5).toString(),
          isActive: configData.isActive ?? true,
          updatedBy: userId,
          updatedAt: new Date()
        };

        let result: { configId: string }[];
        if (existing.length > 0) {
          result = await systemDbConnection
            .update(creditConfigurations)
            .set(configPayload as any)
            .where(eq(creditConfigurations.configId, existing[0].configId))
            .returning();
        } else {
          (configPayload as Record<string, unknown>).createdBy = userId;
          (configPayload as Record<string, unknown>).createdAt = new Date();
          result = await systemDbConnection
            .insert(creditConfigurations)
            .values(configPayload as any)
            .returning();
        }

        results.push(result[0]);
      } catch (opErr: unknown) {
        const opError = opErr as Error;
        console.warn(`Failed to set config for operation ${operationCode}:`, opError);
        // Continue with other operations
      }
    }

    console.log('✅ Tenant app config set successfully for', results.length, 'operations');
    if (results.length > 0) {
      await publishCreditConfigEventToSuite(tenantId, {
        changeType: 'app_updated',
        configType: 'app',
        appCode,
        operationsConfigured: results.length,
        operationCodes: appOperations,
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      configs: results,
      operationsConfigured: results.length,
      action: 'bulk_created_updated'
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error setting tenant app config:', error);
    throw error;
  }
}

/**
 * Reset tenant configuration to global default
 */
export async function resetTenantConfiguration(tenantId: string, configType: string, configCode: string, userId: string): Promise<Record<string, unknown>> {
  try {
    console.log('🔄 Resetting tenant config:', { tenantId, configType, configCode });

    let result;

    if (configType === 'operation') {
      // For operations, delete the specific operation configuration
      const existing = await systemDbConnection
        .select()
        .from(creditConfigurations)
        .where(and(
          eq(creditConfigurations.operationCode, configCode),
          eq(creditConfigurations.tenantId, tenantId),
          eq(creditConfigurations.isGlobal, false)
        ));

      if (existing.length > 0) {
        result = await systemDbConnection
          .delete(creditConfigurations)
          .where(eq(creditConfigurations.configId, existing[0].configId))
          .returning();
      }
    } else if (configType === 'module') {
      // For modules, delete all operation configurations within this module
      const moduleOperations = [
        `${configCode}.create`,
        `${configCode}.read`,
        `${configCode}.read_all`,
        `${configCode}.update`,
        `${configCode}.delete`,
        `${configCode}.export`,
        `${configCode}.import`
      ];

      const deletePromises = moduleOperations.map(operationCode =>
        systemDbConnection
          .delete(creditConfigurations)
          .where(and(
            eq(creditConfigurations.operationCode, operationCode),
            eq(creditConfigurations.tenantId, tenantId),
            eq(creditConfigurations.isGlobal, false)
          ))
          .returning()
      );

      const results = await Promise.all(deletePromises);
      result = results.flat();
    } else if (configType === 'app') {
      // For apps, delete all operation configurations within this app
      const appOperations = [
        `${configCode}.system.create`,
        `${configCode}.system.read`,
        `${configCode}.system.update`,
        `${configCode}.system.delete`,
        `${configCode}.system.export`,
        `${configCode}.system.import`,
        `${configCode}.system.admin`
      ];

      const deletePromises = appOperations.map(operationCode =>
        systemDbConnection
          .delete(creditConfigurations)
          .where(and(
            eq(creditConfigurations.operationCode, operationCode),
            eq(creditConfigurations.tenantId, tenantId),
            eq(creditConfigurations.isGlobal, false),
          ))
          .returning()
      );

      const results = await Promise.all(deletePromises);
      result = results.flat();
    } else {
      throw new Error(`Invalid config type: ${configType}`);
    }

    if (result && result.length > 0) {
      await publishCreditConfigEventToSuite(tenantId, {
        changeType: 'deleted',
        configType,
        configCode,
        deletedCount: result.length,
        operationCodes: result.map((row: { operationCode?: string }) => row.operationCode).filter(Boolean),
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });

      // Log configuration change for each deleted config
      for (const deletedConfig of result) {
        await logConfigurationChange({
          configType,
          configId: deletedConfig.configId,
          operationCode: deletedConfig.operationCode,
          entityType: 'tenant',
          entityId: tenantId,
          changeType: 'delete',
          oldValues: deletedConfig,
          newValues: null,
          changedBy: userId
        });
      }

      return {
        success: true,
        message: `${configType} configuration reset to global default`,
        deletedCount: result.length,
        deleted: result
      };
    } else {
      return {
        success: true,
        message: `No tenant-specific ${configType} configuration found to reset`
      };
    }
  } catch (error) {
    console.error('Error resetting tenant configuration:', error);
    throw error;
  }
}

/**
 * Bulk update multiple tenant configurations
 */
export async function bulkUpdateTenantConfigurations(tenantId: string, configs: Record<string, unknown>[], userId: string): Promise<Record<string, unknown>> {
  try {
    console.log('📦 Bulk updating tenant configurations:', { tenantId, updateCount: configs.length });

    const results = [];

    for (const update of configs) {
      const { configType, configCode, configData } = update as { configType: string; configCode: string; configData: Record<string, unknown> };

      try {
        let result: unknown;
        switch (configType) {
          case 'operation':
            result = await setTenantOperationConfig(configCode, configData, userId, tenantId);
            break;
          case 'module':
            result = await setTenantModuleConfig(configCode, configData, userId, tenantId);
            break;
          case 'app':
            result = await setTenantAppConfig(configCode, configData, userId, tenantId);
            break;
          default:
            throw new Error(`Invalid config type: ${configType}`);
        }

        results.push({
          configType,
          configCode,
          success: true,
          result
        });
      } catch (err: unknown) {
        const error = err as Error;
        console.error(`Error updating ${configType} ${configCode}:`, error);
        results.push({
          configType,
          configCode,
          success: false,
          error: error.message
        });
      }
    }

    const summary = {
      success: true,
      totalUpdates: configs.length,
      successfulUpdates: results.filter((r: { success: boolean }) => r.success).length,
      failedUpdates: results.filter((r: { success: boolean }) => !r.success).length,
      results
    };

    await publishCreditConfigEventToSuite(tenantId, {
      changeType: 'bulk_updated',
      configType: 'bulk',
      totalUpdates: summary.totalUpdates,
      successfulUpdates: summary.successfulUpdates,
      failedUpdates: summary.failedUpdates,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    });

    return summary;
  } catch (error) {
    console.error('Error in bulk update:', error);
    throw error;
  }
}

/**
 * Get configuration templates (creditConfigurationTemplates table removed - return empty)
 */
export async function getConfigurationTemplates(): Promise<Record<string, unknown>[]> {
  return [];
}

/**
 * Apply configuration template to tenant (creditConfigurationTemplates removed - not supported)
 */
export async function applyConfigurationTemplate(_tenantId: string, _templateId: string, _userId: string): Promise<Record<string, unknown>> {
  throw new Error('Configuration templates are not supported. Use setTenantOperationConfig / setTenantModuleConfig / setTenantAppConfig instead.');
}

/**
 * Log configuration changes for audit trail (configurationChangeHistory table removed - no-op)
 */
export async function logConfigurationChange(changeData: Record<string, unknown>): Promise<void> {
  void changeData;
  // No-op: configurationChangeHistory table removed for MVP
}
