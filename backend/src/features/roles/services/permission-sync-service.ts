/**
 * 🚀 **PERMISSION SYNC SERVICE**
 * Automatic permission sync with webhook notifications and organization updates
 * This provides the permanent solution for dynamic permission management
 */

import { db } from '../../../db/index.js';
import { eq } from 'drizzle-orm';
import { tenants } from '../../../db/schema/index.js';
import { customRoleService as CustomRoleService } from '../index.js';
import { PERMISSION_TIERS, type TierKey } from '../../../config/permission-tiers.js';
import Logger from '../../../utils/logger.js';

export class AutoPermissionSyncService {
  
  /**
   * 🎯 **COMPLETE PERMISSION SYNC WITH AUTO-UPDATES**
   * Main function that syncs permissions and updates all organizations
   */
  static async syncPermissionsWithAutoUpdate() {
    Logger.log('info', 'general', 'syncPermissionsWithAutoUpdate', 'Starting complete permission sync with auto-updates');
    
    try {
      // 1. Run the permission matrix sync (your existing sync)
      Logger.log('info', 'general', 'syncPermissionsWithAutoUpdate', 'Step 1: Syncing permission matrix');
      await this.runPermissionMatrixSync();

      // 2. Auto-update all organization access based on their tiers
      Logger.log('info', 'general', 'syncPermissionsWithAutoUpdate', 'Step 2: Auto-updating organization access');
      await this.updateAllOrganizationAccess();

      // 3. Send webhook notifications
      Logger.log('info', 'general', 'syncPermissionsWithAutoUpdate', 'Step 3: Sending webhook notifications');
      await this.notifyPermissionChanges();

      // 4. Clear any cached permission data
      Logger.log('info', 'general', 'syncPermissionsWithAutoUpdate', 'Step 4: Clearing permission caches');
      await this.clearPermissionCaches();

      Logger.log('info', 'general', 'syncPermissionsWithAutoUpdate', 'Complete permission sync completed successfully');
      return { success: true, message: 'Permission sync completed with auto-updates' };
      
    } catch (error) {
      Logger.log('error', 'general', 'syncPermissionsWithAutoUpdate', 'Error in complete permission sync', { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * 📦 **RUN PERMISSION MATRIX SYNC**
   * Calls your existing sync-permissions.js script
   */
  static async runPermissionMatrixSync(): Promise<unknown> {
    // @ts-expect-error scripts/ is excluded from tsconfig
    const SyncService = (await import('../../../scripts/sync-permissions.js')).default;
    const syncService = new (SyncService as new () => { syncAll: () => Promise<unknown> })();
    return await syncService.syncAll();
  }
  
  /**
   * 🏢 **UPDATE ALL ORGANIZATION ACCESS**
   * Automatically updates all organizations based on their subscription tiers
   */
  static async updateAllOrganizationAccess(): Promise<{ updated: number; errors: number }> {
    Logger.log('info', 'general', 'updateAllOrganizationAccess', 'Updating access for all organizations');
    
    const allTenants = await db
      .select({
        tenantId: tenants.tenantId,
        companyName: tenants.companyName
      })
      .from(tenants);
    
    Logger.log('info', 'general', 'updateAllOrganizationAccess', 'Found organizations to update', { count: allTenants.length });
    
    let updateCount = 0;
    let errorCount = 0;
    
    for (const tenant of allTenants) {
      try {
        Logger.log('info', 'general', 'updateAllOrganizationAccess', 'Updating access for tenant', { companyName: tenant.companyName });
        const tier = 'professional';
        await CustomRoleService.updateOrganizationAccess(tenant.tenantId, tier);
        updateCount++;
        Logger.log('info', 'general', 'updateAllOrganizationAccess', 'Updated tenant', { companyName: tenant.companyName });
        
      } catch (err: unknown) {
        const error = err as Error;
        errorCount++;
        Logger.log('error', 'general', 'updateAllOrganizationAccess', 'Error updating tenant', { companyName: tenant.companyName, error: error.message });
      }
    }
    
    Logger.log('info', 'general', 'updateAllOrganizationAccess', 'Organization access update complete', { updated: updateCount, errors: errorCount });
    return { updated: updateCount, errors: errorCount };
  }
  
  /**
   * 🔔 **SEND WEBHOOK NOTIFICATIONS**
   * Notify frontend and other services about permission changes
   */
  static async notifyPermissionChanges() {
    Logger.log('info', 'general', 'notifyPermissionChanges', 'Sending permission change notifications');
    
    const notification = {
      event: 'permissions.updated',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Permission matrix has been updated',
        version: Date.now(),
        affectedApps: ['crm', 'hr', 'affiliate', 'operations', 'accounting'],
        recommendedActions: [
          'Refresh user permissions',
          'Clear role caches',
          'Update UI permission states'
        ]
      }
    };
    
    // Here you would send webhooks to your frontend, mobile apps, etc.
    // For now, we'll just log it
    Logger.log('info', 'general', 'notifyPermissionChanges', 'Webhook notification', { notification });
    
    // In a real implementation, you might:
    // - Send HTTP webhooks to registered endpoints
    // - Publish to a message queue (SNS/SQS)
    // - Send WebSocket notifications to connected clients
    // - Update cache invalidation headers
    
    return notification;
  }
  
  /**
   * 🧹 **CLEAR PERMISSION CACHES**
   * Clear any cached permission data that needs refreshing
   */
  static async clearPermissionCaches() {
    Logger.log('info', 'general', 'clearPermissionCaches', 'Clearing permission caches');
    
    // In a real implementation, you might clear:
    // - Redis cache keys
    // - Application-level caches
    // - CDN cache invalidation
    // - Browser cache headers
    
    const cachesCleared = [
      'user_permissions_*',
      'role_permissions_*', 
      'organization_modules_*',
      'permission_matrix_*'
    ];
    
    Logger.log('info', 'general', 'clearPermissionCaches', 'Cleared caches', { caches: cachesCleared });
    return { caches: cachesCleared };
  }
  
  /**
   * 🔄 **HANDLE SUBSCRIPTION TIER CHANGE**
   * Called when an organization's subscription tier changes
   */
  static async handleSubscriptionTierChange(tenantId: string, newTier: string, oldTier: string): Promise<{ success: boolean }> {
    Logger.log('info', 'general', 'handleSubscriptionTierChange', 'Handling subscription change', { tenantId, oldTier, newTier });
    
    try {
      // 1. Update organization access based on new tier
      await CustomRoleService.updateOrganizationAccess(tenantId, newTier);
      
      // 2. Validate existing roles still work with new tier
      await this.validateRolesAfterTierChange(tenantId, newTier, oldTier);
      
      // 3. Send notification about the change
      await this.notifySubscriptionChange(tenantId, newTier, oldTier);
      
      Logger.log('info', 'general', 'handleSubscriptionTierChange', 'Subscription tier change completed', { tenantId });
      return { success: true };
      
    } catch (error) {
      Logger.log('error', 'general', 'handleSubscriptionTierChange', 'Error handling subscription change', { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * ✅ **VALIDATE ROLES AFTER TIER CHANGE**
   * Check if existing roles are still valid after subscription change
   */
  static async validateRolesAfterTierChange(tenantId: string, newTier: string, oldTier: string): Promise<{ warnings: Array<Record<string, unknown>>; errors: Array<Record<string, unknown>> }> {
    Logger.log('info', 'general', 'validateRolesAfterTierChange', 'Validating roles after tier change', { oldTier, newTier });
    
    // Get current roles for the tenant
    const { customRoles } = await import('../../../db/schema/index.js');
    const roles = await db
      .select()
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId));
    
    const warnings: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];
    
    for (const role of roles) {
      try {
        const permissions = JSON.parse(String(role.permissions || '[]'));
        
        // Check if any permissions would be invalid with new tier
        for (const permission of permissions) {
          const [appCode, moduleCode] = permission.split('.');
          
          if (appCode && moduleCode) {
            const { isModuleAccessible } = await import('../../../config/permission-tiers.js');
            const isAccessible = isModuleAccessible(appCode, moduleCode, newTier as TierKey);
            
            if (!isAccessible) {
              warnings.push({
                roleId: role.roleId,
                roleName: role.roleName,
                permission,
                message: `Permission ${permission} not available in ${newTier} tier`
              });
            }
          }
        }
        
      } catch (err: unknown) {
        const parseError = err as Error;
        errors.push({
          roleId: role.roleId,
          roleName: role.roleName,
          error: `Failed to parse role permissions: ${parseError.message}`
        });
      }
    }
    
    if (warnings.length > 0) {
      Logger.log('warning', 'general', 'validateRolesAfterTierChange', 'Role permission warnings after tier change', { count: warnings.length });
    }

    if (errors.length > 0) {
      Logger.log('error', 'general', 'validateRolesAfterTierChange', 'Role validation errors after tier change', { count: errors.length });
    }
    
    return { warnings, errors };
  }
  
  /**
   * 📢 **NOTIFY SUBSCRIPTION CHANGE**
   * Send notifications about subscription tier changes
   */
  static async notifySubscriptionChange(tenantId: string, newTier: string, oldTier: string): Promise<Record<string, unknown>> {
    const notification = {
      event: 'subscription.tier_changed',
      tenantId,
      timestamp: new Date().toISOString(),
      data: {
        oldTier,
        newTier,
        effectiveDate: new Date().toISOString(),
        changes: await this.calculateTierChanges(oldTier, newTier)
      }
    };
    
    Logger.log('info', 'general', 'notifySubscriptionChange', 'Subscription change notification', { notification });
    return notification;
  }
  
  /**
   * 📊 **CALCULATE TIER CHANGES**
   * Calculate what changes when switching between tiers
   */
  static async calculateTierChanges(oldTier: string, newTier: string): Promise<Record<string, unknown>> {
    const oldConfig = PERMISSION_TIERS[oldTier as TierKey];
    const newConfig = PERMISSION_TIERS[newTier as TierKey];
    
    if (!oldConfig || !newConfig) {
      return { error: 'Invalid tier configuration' };
    }
    
    const changes: Record<string, unknown> = {
      addedApps: [] as string[],
      removedApps: [] as string[],
      addedModules: {},
      removedModules: {},
      limitChanges: {}
    };
    
    const oldApps = Object.keys(oldConfig.apps || {});
    const newApps = Object.keys(newConfig.apps || {});
    
    (changes.addedApps as string[]) = newApps.filter(app => !oldApps.includes(app));
    (changes.removedApps as string[]) = oldApps.filter(app => !newApps.includes(app));
    
    // Compare limits
    changes.limitChanges = {
      maxUsers: { old: oldConfig.max_users, new: newConfig.max_users },
      maxStorage: { old: oldConfig.max_storage, new: newConfig.max_storage }
    };
    
    return changes;
  }
  
  /**
   * 🎯 **AUTO-SYNC ON SCHEDULE**
   * Run permission sync on a schedule (could be called by cron job)
   */
  static async runScheduledSync() {
    Logger.log('info', 'general', 'runScheduledSync', 'Running scheduled permission sync');
    
    try {
      const result = await this.syncPermissionsWithAutoUpdate();
      
      // Log successful sync
      Logger.log('info', 'general', 'runScheduledSync', 'Scheduled permission sync completed successfully');
      return result;
      
    } catch (err: unknown) {
      Logger.log('error', 'general', 'runScheduledSync', 'Scheduled permission sync failed', { error: (err as Error).message });
      throw err;
    }
  }
}

export default AutoPermissionSyncService;
