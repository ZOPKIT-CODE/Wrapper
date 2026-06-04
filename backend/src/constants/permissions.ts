/**
 * Centralized permission constants.
 *
 * Every permission follows the `module.section.action` format so that
 * `checkPermissions()` in permission-middleware.js can split on "." and
 * look up   userPermissions.modules[module]?.[section]?.includes(action)
 */

export const PERMISSIONS = {
  // ── Admin ─────────────────────────────────────────────────────────
  ADMIN_AUDIT_VIEW: 'admin.audit.view',

  ADMIN_APPS_VIEW: 'admin.applications.view',
  ADMIN_APPS_ASSIGN: 'admin.applications.assign',
  ADMIN_APPS_EDIT: 'admin.applications.edit',
  ADMIN_APPS_DELETE: 'admin.applications.delete',
  ADMIN_APPS_BULK_ASSIGN: 'admin.applications.bulk_assign',

  ADMIN_CREDITS_VIEW: 'admin.credits.view',
  ADMIN_CREDITS_MANAGE: 'admin.credits.manage',

  ADMIN_DASHBOARD_VIEW: 'admin.dashboard.view',

  ADMIN_ENTITIES_VIEW: 'admin.entities.view',
  ADMIN_ENTITIES_MANAGE: 'admin.entities.manage',

  ADMIN_NOTIFICATIONS_VIEW: 'admin.notifications.view',
  ADMIN_NOTIFICATIONS_SEND: 'admin.notifications.send',
  ADMIN_NOTIFICATIONS_MANAGE: 'admin.notifications.manage',

  ADMIN_OPERATIONS_VIEW: 'admin.operations.view',
  ADMIN_OPERATIONS_CREATE: 'admin.operations.create',
  ADMIN_OPERATIONS_EDIT: 'admin.operations.edit',
  ADMIN_OPERATIONS_DELETE: 'admin.operations.delete',

  ADMIN_SYSTEM_MANAGE: 'admin.system.manage',

  ADMIN_TENANTS_VIEW: 'admin.tenants.view',
  ADMIN_TENANTS_MANAGE: 'admin.tenants.manage',

  ADMIN_USERS_VIEW: 'admin.users.view',
  ADMIN_USERS_PROMOTE: 'admin.users.promote',

  // ── Analytics ─────────────────────────────────────────────────────
  ANALYTICS_DATA_READ: 'analytics.data.read',

  // ── Audit ─────────────────────────────────────────────────────────
  AUDIT_LOG_VIEW: 'audit.log.view',
  AUDIT_LOG_READ: 'audit.log.read',

  // ── Billing ───────────────────────────────────────────────────────
  BILLING_PLANS_MANAGE: 'billing.plans.manage',
  BILLING_PLANS_READ: 'billing.plans.read',

  // ── Credits ───────────────────────────────────────────────────────
  CREDITS_BALANCE_MANAGE: 'credits.balance.manage',
  CREDITS_BALANCE_TRANSFER: 'credits.balance.transfer',

  // ── Credit Config ─────────────────────────────────────────────────
  CREDIT_CONFIG_VIEW: 'credit_config.settings.view',
  CREDIT_CONFIG_EDIT: 'credit_config.settings.edit',
  CREDIT_CONFIG_RESET: 'credit_config.settings.reset',
  CREDIT_CONFIG_BULK_UPDATE: 'credit_config.settings.bulk_update',
  CREDIT_CONFIG_APPLY_TEMPLATES: 'credit_config.settings.apply_templates',
  CREDIT_CONFIG_MANAGE: 'credit_config.settings.manage',

  // ── CRM ───────────────────────────────────────────────────────────
  // Note: the standalone `crm.system.*` and `crm.custom_fields.*` codes were
  // consolidated under `crm.layouts.*` (per-module admin umbrella) — see
  // data/permission-matrix.ts. Org-wide admin moved to wrapper tenant admin.
  CRM_LAYOUTS_READ: 'crm.layouts.read',
  CRM_LAYOUTS_MANAGE: 'crm.layouts.manage',
  CRM_LAYOUTS_FIELDS_READ: 'crm.layouts.fields_read',
  CRM_LAYOUTS_FIELDS_MANAGE: 'crm.layouts.fields_manage',
  CRM_LAYOUTS_SYSCONFIG_READ: 'crm.layouts.sysconfig_read',
  CRM_LAYOUTS_SYSCONFIG_CREATE: 'crm.layouts.sysconfig_create',
  CRM_LAYOUTS_SYSCONFIG_UPDATE: 'crm.layouts.sysconfig_update',
  CRM_LAYOUTS_SYSCONFIG_DELETE: 'crm.layouts.sysconfig_delete',

  // ── Permissions ───────────────────────────────────────────────────
  PERMISSIONS_ASSIGNMENT_READ: 'permissions.assignment.read',
  PERMISSIONS_ASSIGNMENT_ASSIGN: 'permissions.assignment.assign',
  PERMISSIONS_ASSIGNMENT_MANAGE: 'permissions.assignment.manage',

  // ── Roles ─────────────────────────────────────────────────────────
  ROLES_MANAGEMENT_READ: 'roles.management.read',
  ROLES_MANAGEMENT_CREATE: 'roles.management.create',
  ROLES_MANAGEMENT_EDIT: 'roles.management.edit',
  ROLES_MANAGEMENT_UPDATE: 'roles.management.update',
  ROLES_MANAGEMENT_DELETE: 'roles.management.delete',
  ROLES_MANAGEMENT_MANAGE: 'roles.management.manage',
  ROLES_ASSIGNMENT_ASSIGN: 'roles.assignment.assign',

  // ── System ────────────────────────────────────────────────────────
  SYSTEM_ADMIN_MANAGE: 'system.admin.manage',

  // ── Tenant ────────────────────────────────────────────────────────
  TENANT_SETTINGS_VIEW: 'tenant.settings.view',
  TENANT_SETTINGS_EDIT: 'tenant.settings.edit',
  TENANT_SETTINGS_DELETE: 'tenant.settings.delete',

  // ── Users ─────────────────────────────────────────────────────────
  USERS_MANAGEMENT_VIEW: 'users.management.view',
  USERS_MANAGEMENT_EDIT: 'users.management.edit',
  USERS_MANAGEMENT_DELETE: 'users.management.delete',
  USERS_DATA_READ: 'users.data.read',
};
