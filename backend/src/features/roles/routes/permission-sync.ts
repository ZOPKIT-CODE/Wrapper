/**
 * 🚀 **PERMISSION SYNC API ROUTES**
 * API endpoints for automatic permission sync and management
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import AutoPermissionSyncService from '../services/permission-sync-service.js';
import { customRoleService as CustomRoleService } from '../index.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import Logger from '../../../utils/logger.js';

export default async function permissionSyncRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  /**
   * 🔄 **FULL PERMISSION SYNC WITH AUTO-UPDATES**
   * Syncs permissions and automatically updates all organizations
   */
  fastify.post('/sync', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.SYSTEM_ADMIN_MANAGE)]
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'permission-sync', 'Starting full permission sync with auto-updates');
      
      const result = await AutoPermissionSyncService.syncPermissionsWithAutoUpdate();
      
      return reply.send({
        success: true,
        message: 'Permission sync completed successfully',
        data: result
      });
      
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'permission-sync', 'Permission sync failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Permission sync failed',
        details: error.message
      });
    }
  });
  
  /**
   * 🔄 **UPDATE ORGANIZATION ACCESS**
   * Update a specific organization's access based on subscription tier
   */
  fastify.post('/update-organization-access', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.SYSTEM_ADMIN_MANAGE)]
  }, (async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const { tenantId, subscriptionTier } = request.body as Record<string, unknown>;
      
      if (!tenantId || !subscriptionTier) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required fields: tenantId, subscriptionTier'
        });
      }
      
      Logger.log('info', 'general', 'update-organization-access', 'Updating organization access', { tenantId, subscriptionTier });
      
      await CustomRoleService.updateOrganizationAccess(tenantId as string, subscriptionTier as string);
      
      return reply.send({
        success: true,
        message: `Organization access updated to ${subscriptionTier} tier`,
        data: { tenantId, subscriptionTier }
      });
      
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'update-organization-access', 'Organization access update failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to update organization access',
        details: error.message
      });
    }
  }) as any);
  
  /**
   * 🔄 **HANDLE SUBSCRIPTION TIER CHANGE**
   * Called when an organization's subscription tier changes
   */
  fastify.post('/subscription-tier-change', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.SYSTEM_ADMIN_MANAGE)]
  }, (async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const { tenantId, newTier, oldTier } = request.body as Record<string, unknown>;
      
      if (!tenantId || !newTier) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required fields: tenantId, newTier'
        });
      }
      
      Logger.log('info', 'general', 'subscription-tier-change', 'Handling subscription tier change', { tenantId, oldTier, newTier });
      
      const result = await AutoPermissionSyncService.handleSubscriptionTierChange(
        tenantId as string,
        newTier as string,
        (oldTier as string) ?? ''
      );
      
      return reply.send({
        success: true,
        message: `Subscription tier updated from ${oldTier} to ${newTier}`,
        data: result
      });
      
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'subscription-tier-change', 'Subscription tier change failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to handle subscription tier change',
        details: error.message
      });
    }
  }) as any);
  
  /**
   * 📊 **GET PERMISSION TIER CONFIGURATION**
   * Returns the current permission tier configuration
   */
  fastify.get('/tier-configuration', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.SYSTEM_ADMIN_MANAGE)]
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { PERMISSION_TIERS } = await import('../../../config/permission-tiers.js');
      
      return reply.send({
        success: true,
        message: 'Permission tier configuration retrieved',
        data: {
          tiers: PERMISSION_TIERS,
          totalTiers: Object.keys(PERMISSION_TIERS).length
        }
      });
      
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'tier-configuration', 'Failed to get tier configuration', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to get tier configuration',
        details: error.message
      });
    }
  });
  
  /**
   * 🔍 **CHECK MODULE ACCESSIBILITY**
   * Check if a module is accessible for a given subscription tier
   */
  fastify.get('/check-module-access', {
    preHandler: [authenticateToken]
  }, (async (request: FastifyRequest<{ Querystring: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const { appCode, moduleCode, subscriptionTier } = request.query as Record<string, unknown>;
      
      if (!appCode || !moduleCode || !subscriptionTier) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required query parameters: appCode, moduleCode, subscriptionTier'
        });
      }
      
      const { isModuleAccessible } = await import('../../../config/permission-tiers.js');
      type TierKey = 'custom' | 'starter' | 'professional' | 'enterprise' | 'free';
      const isAccessible = isModuleAccessible(appCode as string, moduleCode as string, subscriptionTier as TierKey);
      
      return reply.send({
        success: true,
        message: 'Module accessibility checked',
        data: {
          appCode,
          moduleCode,
          subscriptionTier,
          isAccessible,
          accessLevel: isAccessible ? 'allowed' : 'denied'
        }
      });
      
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'check-module-access', 'Module access check failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to check module access',
        details: error.message
      });
    }
  }) as any);
  
  /**
   * 🧹 **CLEAR PERMISSION CACHES**
   * Clear permission-related caches
   */
  fastify.post('/clear-caches', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.SYSTEM_ADMIN_MANAGE)]
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      Logger.log('info', 'general', 'clear-caches', 'Clearing permission caches');
      
      const result = await AutoPermissionSyncService.clearPermissionCaches();
      
      return {
        success: true,
        message: 'Permission caches cleared successfully',
        data: result
      };
      
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'clear-caches', 'Cache clearing failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to clear caches',
        details: error.message
      });
    }
  });
  
  /**
   * ⏰ **RUN SCHEDULED SYNC**
   * Endpoint for scheduled permission sync (cron jobs)
   */
  fastify.post('/scheduled-sync', {
    // No auth required for scheduled jobs - should be called internally or with API key
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const apiKey = request.headers['apikey'] ?? request.headers['x-api-key'];
      
      // Simple API key check (in production, use proper authentication)
      if (apiKey !== process.env.SYNC_API_KEY) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid API key for scheduled sync'
        });
      }
      
      Logger.log('info', 'general', 'scheduled-sync', 'Running scheduled permission sync');
      
      const result = await AutoPermissionSyncService.runScheduledSync();
      
      return {
        success: true,
        message: 'Scheduled permission sync completed',
        data: result
      };
      
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'scheduled-sync', 'Scheduled sync failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Scheduled sync failed',
        details: error.message
      });
    }
  });
}
