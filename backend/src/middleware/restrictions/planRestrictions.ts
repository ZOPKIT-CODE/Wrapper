import type { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionService } from '../../features/subscriptions/index.js';
import { db } from '../../db/index.js';
import { eq, count } from 'drizzle-orm';
import { tenantUsers, customRoles } from '../../db/schema/index.js';
import {
  getPlanApplications,
  getPlanModules,
  getPlanLimits as getPlanLimitsData,
  getMinimumPlanForApp,
  getMinimumPlanForModule,
} from '../../data/plans.js';
import Logger from '../../utils/logger.js';

// Middleware to check application access
export const checkApplicationAccess = (requiredApplication: string) => {
  return async (req: { user?: { tenantId?: string }; subscription?: unknown }, res: { status: (n: number) => { json: (o: unknown) => void } }, next: () => void) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get current subscription
      const subscription = await SubscriptionService.getCurrentSubscription(tenantId);

      if (!subscription) {
        return res.status(403).json({
          success: false,
          error: 'No active subscription found'
        });
      }

      // Check if application is allowed for current plan
      const planApplications = getPlanApplications(subscription.plan as string);

      if (!planApplications.includes(requiredApplication)) {
        return res.status(403).json({
          success: false,
          error: `Access to ${requiredApplication.toUpperCase()} application requires ${getMinimumPlanForApp(requiredApplication)} plan or higher`,
          currentPlan: subscription.plan,
          requiredApplication,
          upgradeRequired: true
        });
      }

      // Add subscription info to request for further use
      req.subscription = subscription;
      next();
    } catch (error) {
      Logger.log('error', 'restrictions', 'check-application-access', 'Application access check error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to verify application access'
      });
    }
  };
};

// Middleware to check specific module access within an application  
export const checkModuleAccess = (requiredApplication: string, requiredModule: string) => {
  return async (req: { user?: { tenantId?: string }; subscription?: unknown }, res: { status: (n: number) => { json: (o: unknown) => void } }, next: () => void) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get current subscription
      const subscription = await SubscriptionService.getCurrentSubscription(tenantId);

      if (!subscription) {
        return res.status(403).json({
          success: false,
          error: 'No active subscription found'
        });
      }

      const planApplications = getPlanApplications(subscription.plan as string);
      const planModules = getPlanModules(subscription.plan as string);

      // First check if application is allowed
      if (!planApplications.includes(requiredApplication)) {
        return res.status(403).json({
          success: false,
          error: `Access to ${requiredApplication.toUpperCase()} application requires upgrade`,
          currentPlan: subscription.plan,
          requiredApplication,
          upgradeRequired: true
        });
      }

      // Then check if specific module is allowed within the application
      const allowedModules = planModules[requiredApplication] ?? [];

      // Check for wildcard access (enterprise plan)
      if (allowedModules !== '*' && !(allowedModules as string[]).includes(requiredModule)) {
        return res.status(403).json({
          success: false,
          error: `Access to ${requiredModule} module in ${requiredApplication.toUpperCase()} requires ${getMinimumPlanForModule(requiredApplication, requiredModule)} plan or higher`,
          currentPlan: subscription.plan,
          requiredApplication,
          requiredModule,
          upgradeRequired: true
        });
      }

      // Add subscription info to request for further use
      req.subscription = subscription;
      next();
    } catch (error) {
      Logger.log('error', 'restrictions', 'check-module-access', 'Module access check error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to verify module access'
      });
    }
  };
};

// Middleware to check user limit before creating users
export const checkUserLimit = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = request.userContext?.tenantId;

    if (!tenantId) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get current subscription
    const subscription = await SubscriptionService.getCurrentSubscription(tenantId);

    if (!subscription) {
      return reply.code(403).send({
        success: false,
        error: 'No active subscription found'
      });
    }

    const planLimits = getPlanLimitsData(subscription.plan as string);

    // Check if plan has unlimited users
    if (planLimits.users === -1) {
      request.subscription = { ...subscription, plan: (subscription as Record<string, unknown>).plan as string } as { plan: string; [k: string]: unknown };
      return;
    }

    // Count current users
    const [userCount] = await db
      .select({ count: count() })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, tenantId));

    if (userCount.count >= planLimits.users) {
      return reply.code(403).send({
        success: false,
        error: `Your ${subscription.plan} plan allows maximum ${planLimits.users} users. Current: ${userCount.count}`,
        currentPlan: subscription.plan,
        currentUsers: userCount.count,
        maxUsers: planLimits.users,
        upgradeRequired: true
      });
    }

    request.subscription = { ...subscription, plan: (subscription as Record<string, unknown>).plan as string } as { plan: string; [k: string]: unknown };
  } catch (error) {
    Logger.log('error', 'restrictions', 'check-user-limit', 'User limit check error', { error });
    return reply.code(500).send({
      success: false,
      error: 'Failed to verify user limits'
    });
  }
};

// Middleware to check role limit before creating roles
export const checkRoleLimit = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = request.userContext?.tenantId;

    if (!tenantId) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get current subscription
    const subscription = await SubscriptionService.getCurrentSubscription(tenantId);

    if (!subscription) {
      return reply.code(403).send({
        success: false,
        error: 'No active subscription found'
      });
    }

    const planLimits = getPlanLimitsData(subscription.plan as string);

    // Check if plan has unlimited roles
    if (planLimits.roles === -1) {
      request.subscription = { ...subscription, plan: (subscription as Record<string, unknown>).plan as string } as { plan: string; [k: string]: unknown };
      return;
    }

    // Count current roles (excluding default admin role)
    const [roleCount] = await db
      .select({ count: count() })
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId));

    // Account for default admin role - subtract 1 from limit comparison
    const customRolesCount = Math.max(0, roleCount.count - 1);
    const allowedCustomRoles = Math.max(0, planLimits.roles - 1);

    if (customRolesCount >= allowedCustomRoles) {
      return reply.code(403).send({
        success: false,
        error: `Your ${subscription.plan} plan allows maximum ${planLimits.roles} roles (including admin). Current custom roles: ${customRolesCount}`,
        currentPlan: subscription.plan,
        currentRoles: roleCount.count,
        maxRoles: planLimits.roles,
        upgradeRequired: true
      });
    }

    request.subscription = { ...subscription, plan: (subscription as Record<string, unknown>).plan as string } as { plan: string; [k: string]: unknown };
  } catch (error) {
    Logger.log('error', 'restrictions', 'check-role-limit', 'Role limit check error', { error });
    return reply.code(500).send({
      success: false,
      error: 'Failed to verify role limits'
    });
  }
};

// Utility function to get plan limits for frontend
export const getPlanLimits = async (req: { user?: { tenantId?: string } }, res: { status: (n: number) => { json: (o: unknown) => void }; json: (o: unknown) => void }) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const subscription = await SubscriptionService.getCurrentSubscription(tenantId);

    if (!subscription) {
      return res.status(403).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Get current usage
    const [userCount] = await db
      .select({ count: count() })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, tenantId));

    const [roleCount] = await db
      .select({ count: count() })
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId));

    const planLimits = getPlanLimitsData(subscription.plan as string);
    const planApplications = getPlanApplications(subscription.plan as string);
    const planModules = getPlanModules(subscription.plan as string);

    res.json({
      success: true,
      data: {
        currentPlan: subscription.plan,
        limits: planLimits,
        allowedApplications: planApplications,
        allowedModules: planModules,
        currentUsage: {
          users: userCount.count,
          roles: roleCount.count
        },
        restrictions: {
          canCreateUsers: planLimits.users === -1 || userCount.count < planLimits.users,
          canCreateRoles: planLimits.roles === -1 || roleCount.count < planLimits.roles,
          availableUserSlots: planLimits.users === -1 ? -1 : Math.max(0, planLimits.users - userCount.count),
          availableRoleSlots: planLimits.roles === -1 ? -1 : Math.max(0, planLimits.roles - roleCount.count)
        }
      }
    });
  } catch (error) {
    Logger.log('error', 'restrictions', 'get-plan-limits', 'Error getting plan limits', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get plan limits'
    });
  }
};

export default {
  checkApplicationAccess,
  checkModuleAccess,
  checkUserLimit,
  checkRoleLimit,
  getPlanLimits
}; 