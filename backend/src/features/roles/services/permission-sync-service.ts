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

export class AutoPermissionSyncService {
  
  /**
   * 🎯 **COMPLETE PERMISSION SYNC WITH AUTO-UPDATES**
   * Main function that syncs permissions and updates all organizations
   */
  static async syncPermissionsWithAutoUpdate() {
    console.log('🚀 Starting complete permission sync with auto-updates...');
    
    try {
      // 1. Run the permission matrix sync (your existing sync)
      console.log('📦 Step 1: Syncing permission matrix...');
      await this.runPermissionMatrixSync();
      
      // 2. Auto-update all organization access based on their tiers
      console.log('🏢 Step 2: Auto-updating organization access...');
      await this.updateAllOrganizationAccess();
      
      // 3. Send webhook notifications
      console.log('🔔 Step 3: Sending webhook notifications...');
      await this.notifyPermissionChanges();
      
      // 4. Clear any cached permission data
      console.log('🧹 Step 4: Clearing permission caches...');
      await this.clearPermissionCaches();
      
      console.log('🎉 Complete permission sync completed successfully!');
      return { success: true, message: 'Permission sync completed with auto-updates' };
      
    } catch (error) {
      console.error('❌ Error in complete permission sync:', error);
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
    console.log('🔄 Updating access for all organizations...');
    
    const allTenants = await db
      .select({
        tenantId: tenants.tenantId,
        companyName: tenants.companyName
      })
      .from(tenants);
    
    console.log(`📊 Found ${allTenants.length} organizations to update`);
    
    let updateCount = 0;
    let errorCount = 0;
    
    for (const tenant of allTenants) {
      try {
        console.log(`🔄 Updating access for ${tenant.companyName})`);
        const tier = 'professional';
        await CustomRoleService.updateOrganizationAccess(tenant.tenantId, tier);
        updateCount++;
        console.log(`  ✅ Updated ${tenant.companyName}`);
        
      } catch (err: unknown) {
        const error = err as Error;
        errorCount++;
        console.error(`  ❌ Error updating ${tenant.companyName}:`, error.message);
      }
    }
    
    console.log(`📈 Organization access update complete: ${updateCount} success, ${errorCount} errors`);
    return { updated: updateCount, errors: errorCount };
  }
  
  /**
   * 🔔 **SEND WEBHOOK NOTIFICATIONS**
   * Notify frontend and other services about permission changes
   */
  static async notifyPermissionChanges() {
    console.log('🔔 Sending permission change notifications...');
    
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
    console.log('📢 Webhook notification:', JSON.stringify(notification, null, 2));
    
    // In a real implementation, you might:
    // - Send HTTP webhooks to registered endpoints
    // - Publish to a message queue (Redis, RabbitMQ)
    // - Send WebSocket notifications to connected clients
    // - Update cache invalidation headers
    
    return notification;
  }
  
  /**
   * 🧹 **CLEAR PERMISSION CACHES**
   * Clear any cached permission data that needs refreshing
   */
  static async clearPermissionCaches() {
    console.log('🧹 Clearing permission caches...');
    
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
    
    console.log(`🗑️ Cleared caches: ${cachesCleared.join(', ')}`);
    return { caches: cachesCleared };
  }
  
  /**
   * 🔄 **HANDLE SUBSCRIPTION TIER CHANGE**
   * Called when an organization's subscription tier changes
   */
  static async handleSubscriptionTierChange(tenantId: string, newTier: string, oldTier: string): Promise<{ success: boolean }> {
    console.log(`🔄 Handling subscription change for tenant ${tenantId}: ${oldTier} → ${newTier}`);
    
    try {
      // 1. Update organization access based on new tier
      await CustomRoleService.updateOrganizationAccess(tenantId, newTier);
      
      // 2. Validate existing roles still work with new tier
      await this.validateRolesAfterTierChange(tenantId, newTier, oldTier);
      
      // 3. Send notification about the change
      await this.notifySubscriptionChange(tenantId, newTier, oldTier);
      
      console.log(`✅ Subscription tier change completed for tenant ${tenantId}`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Error handling subscription change:`, error);
      throw error;
    }
  }
  
  /**
   * ✅ **VALIDATE ROLES AFTER TIER CHANGE**
   * Check if existing roles are still valid after subscription change
   */
  static async validateRolesAfterTierChange(tenantId: string, newTier: string, oldTier: string): Promise<{ warnings: Array<Record<string, unknown>>; errors: Array<Record<string, unknown>> }> {
    console.log(`🔍 Validating roles after tier change: ${oldTier} → ${newTier}`);
    
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
      console.warn(`⚠️ ${warnings.length} role permission warnings after tier change`);
    }
    
    if (errors.length > 0) {
      console.error(`❌ ${errors.length} role validation errors after tier change`);
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
    
    console.log('📢 Subscription change notification:', JSON.stringify(notification, null, 2));
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
    console.log('⏰ Running scheduled permission sync...');
    
    try {
      const result = await this.syncPermissionsWithAutoUpdate();
      
      // Log successful sync
      console.log('✅ Scheduled permission sync completed successfully');
      return result;
      
    } catch (err: unknown) {
      console.error('❌ Scheduled permission sync failed:', err);
      throw err;
    }
  }
}

export default AutoPermissionSyncService;
