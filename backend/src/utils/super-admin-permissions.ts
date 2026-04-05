// 🔧 **SUPER ADMINISTRATOR PERMISSION GENERATOR**
// Utility to generate comprehensive permissions for Super Administrator roles based on their plan

import { PLAN_ACCESS_MATRIX, PermissionMatrixUtils } from '../data/permission-matrix.js';

type PlanIdKey = keyof typeof PLAN_ACCESS_MATRIX;

/**
 * Generate comprehensive Super Administrator permissions for a plan
 * @param {string} planId - The subscription plan (trial, starter, professional, enterprise)
 * @returns {object} Comprehensive permissions object
 */
export function generateSuperAdminPermissions(planId: string): Record<string, unknown> {
  const planAccess = PLAN_ACCESS_MATRIX[planId as PlanIdKey];
  if (!planAccess) {
    throw new Error(`Plan ${planId} not found in PLAN_ACCESS_MATRIX`);
  }

  const permissions: Record<string, unknown> = {};
  
  // Process each application in the plan
  planAccess.applications.forEach((appCode: string) => {
    const appModules = (planAccess.modules as Record<string, string[] | string>)[appCode];
    (permissions as Record<string, Record<string, string[]>>)[appCode] = {};
    
    if (appModules === '*') {
      // All modules for this application
      const allModules = PermissionMatrixUtils.getApplicationModules(appCode);
      const appPerms = (permissions as Record<string, Record<string, string[]>>)[appCode];

      allModules.forEach((module: { moduleCode: string }) => {
        const modulePermissions = PermissionMatrixUtils.getModulePermissions(appCode, module.moduleCode);
        appPerms[module.moduleCode] = modulePermissions.map((p: { code: string }) => p.code);
      });

    } else if (Array.isArray(appModules)) {
      // Specific modules
      const appPerms = (permissions as Record<string, Record<string, string[]>>)[appCode];
      appModules.forEach((moduleCode: string) => {
        const modulePermissions = PermissionMatrixUtils.getModulePermissions(appCode, moduleCode);
        appPerms[moduleCode] = modulePermissions.map((p: { code: string }) => p.code);
      });
    }
  });
  
  // Add system-level permissions - Super Admin gets ALL system privileges
  (permissions as Record<string, unknown>).system = {
    users: ['read', 'read_all', 'create', 'update', 'delete', 'invite', 'change_role', 'change_status'],
    roles: ['read', 'read_all', 'create', 'update', 'delete', 'assign'],
    
    // 🔍 COMPREHENSIVE AUDIT PERMISSIONS
    audit: [
      'read', 'read_all', 'export', 'view_details', 
      'filter_by_user', 'filter_by_action', 'filter_by_date_range',
      'filter_by_module', 'filter_by_status', 'generate_reports',
      'archive_logs', 'purge_old_logs', 'audit_trail_export'
    ],
    
    // 📊 ACTIVITY LOGS PERMISSIONS
    activity_logs: [
      'read', 'read_all', 'export', 'view_details',
      'filter_by_user', 'filter_by_action', 'filter_by_date_range', 
      'filter_by_module', 'filter_by_status', 'generate_reports',
      'archive_logs', 'purge_old_logs', 'audit_trail_export'
    ],
    
    // 👤 USER ACTIVITY TRACKING
    user_activity: [
      'read', 'read_all', 'export', 'view_details',
      'track_login_logout', 'track_page_views', 'track_actions',
      'track_data_changes', 'generate_user_reports',
      'filter_by_user', 'filter_by_date_range'
    ],
    
    // 🔄 DATA CHANGE TRACKING
    data_changes: [
      'read', 'read_all', 'export', 'view_details',
      'track_creates', 'track_updates', 'track_deletes',
      'track_field_changes', 'track_relationship_changes',
      'generate_change_reports', 'filter_by_table',
      'filter_by_user', 'filter_by_date_range'
    ],
    
    dashboard: ['view', 'customize', 'export'],
    settings: ['read', 'update', 'manage'],
    billing: ['read', 'update', 'manage_subscription', 'view_invoices'],
    integrations: ['read', 'create', 'update', 'delete', 'manage']
  };
  
  return permissions;
}

/**
 * Generate flat array of granular permissions in module.operation format
 * @param {string} planId - The subscription plan 
 * @returns {Array} Array of permission strings in format "app.module.operation"
 */
export function generateFlatPermissionArray(planId: string): string[] {
  const permissions = generateSuperAdminPermissions(planId);
  const flatPermissions: string[] = [];
  
  Object.keys(permissions).forEach(appCode => {
    const appPermissions = (permissions as Record<string, Record<string, string[]>>)[appCode];
    if (!appPermissions) return;

    Object.keys(appPermissions).forEach(moduleCode => {
      const modulePermissions = appPermissions[moduleCode];

      if (Array.isArray(modulePermissions)) {
        modulePermissions.forEach(permissionCode => {
          flatPermissions.push(`${appCode}.${moduleCode}.${permissionCode}`);
        });
      }
    });
  });
  
  return flatPermissions;
}

/**
 * Count total permissions for a plan
 * @param {string} planId - The subscription plan
 * @returns {object} Permission counts
 */
export function getPermissionCounts(planId: string): { totalPermissions: number; totalModules: number; totalApplications: number; flatPermissions: string[] } {
  const permissions = generateSuperAdminPermissions(planId);
  let totalPermissions = 0;
  let totalModules = 0;
  let totalApplications = 0;

  Object.keys(permissions).forEach(appCode => {
    totalApplications++;
    const appPermissions = (permissions as Record<string, Record<string, string[]>>)[appCode];
    if (!appPermissions) return;

    Object.keys(appPermissions).forEach(moduleCode => {
      totalModules++;
      const modulePermissions = appPermissions[moduleCode];
      if (Array.isArray(modulePermissions)) {
        totalPermissions += modulePermissions.length;
      }
    });
  });
  
  return {
    totalPermissions,
    totalModules,
    totalApplications,
    flatPermissions: generateFlatPermissionArray(planId)
  };
}

/**
 * Get description text for Super Administrator role based on plan
 * @param {string} planId - The subscription plan
 * @returns {string} Role description
 */
export function getSuperAdminDescription(planId: string): string {
  const planNames: Record<string, string> = {
    trial: 'Trial Administrator - Full access to trial features',
    starter: 'Super Administrator - Complete organizational control (Starter Plan)',
    professional: 'Super Administrator - Complete organizational control (Professional Plan)',
    enterprise: 'Super Administrator - Complete organizational control (Enterprise Plan)'
  };
  
  return planNames[planId] || 'Super Administrator - Complete organizational control';
}

/**
 * Get restrictions for Super Administrator role based on plan
 * @param {string} planId - The subscription plan
 * @returns {object} Role restrictions
 */
export function getSuperAdminRestrictions(planId: string): Record<string, unknown> {
  const planAccess = PLAN_ACCESS_MATRIX[planId as PlanIdKey] as { limitations?: Record<string, unknown> } | undefined;
  if (!planAccess || !planAccess.limitations) {
    return {};
  }

  const limitations = planAccess.limitations;
  const restrictions: Record<string, unknown> = {
    planType: planId
  };

  // Add limitations based on plan
  if (limitations.users !== -1) {
    restrictions.maxUsers = limitations.users;
  }

  if (limitations.roles !== -1) {
    restrictions.maxRoles = limitations.roles;
  }

  // Special handling for trial
  if (planId === 'trial') {
    restrictions.limitedFeatures = true;
    restrictions.isTrialAccount = true;
  }

  return restrictions;
}

/**
 * Create complete Super Administrator role configuration
 * @param {string} planId - The subscription plan
 * @param {string} tenantId - The tenant ID
 * @param {string} createdBy - User ID who created the role
 * @returns {object} Complete role configuration for database insertion
 */
export function createSuperAdminRoleConfig(planId: string, tenantId: string, createdBy: string): Record<string, unknown> {
  return {
    tenantId,
    roleName: 'Super Administrator',
    description: getSuperAdminDescription(planId),
    permissions: generateSuperAdminPermissions(planId),
    restrictions: getSuperAdminRestrictions(planId),
    isSystemRole: true,
    isDefault: true,
    priority: 1000, // Highest priority - Super Admin
    createdBy
  };
}

/**
 * Log permission summary for debugging
 * @param {string} planId - The subscription plan
 * @param {object} permissions - Generated permissions object
 */
export function logPermissionSummary(planId: string, permissions: Record<string, unknown>): void {
  console.log(`📊 Super Administrator permissions for ${planId} plan:`);

  const counts = getPermissionCounts(planId);

  console.log(`   📈 Total: ${counts.totalApplications} applications, ${counts.totalModules} modules, ${counts.totalPermissions} permissions`);

  Object.keys(permissions).forEach(app => {
    const appVal = permissions[app];
    if (typeof appVal === 'object' && appVal !== null) {
      const modules = Object.keys(appVal as Record<string, unknown>);
      const appPermissions = Object.values(appVal as Record<string, unknown>).reduce((sum: number, perms: unknown) => {
        return sum + (Array.isArray(perms) ? perms.length : 0);
      }, 0);
      
      console.log(`   ${app}: ${modules.length} modules, ${appPermissions} permissions`);

      // Log individual permissions for debugging
      modules.forEach(moduleCode => {
        const modulePerms = (appVal as Record<string, string[]>) [moduleCode];
        if (Array.isArray(modulePerms)) {
          console.log(`     ${moduleCode}: ${modulePerms.join(', ')}`);
        }
      });
    }
  });
}