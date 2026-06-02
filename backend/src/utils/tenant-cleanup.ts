import { db } from '../db/index.js';
import {
  tenants,
  tenantUsers,
  customRoles,
  userRoleAssignments,
  subscriptions,
  payments,
  auditLogs,
  organizationApplications,
} from '../db/schema/index.js';
import { eq, like, count, or } from 'drizzle-orm';
import Logger from './logger.js';

interface DeletedRecords {
  userRoleAssignments?: number;
  auditLogs?: number;
  customRoles?: number;
  tenantUsers?: number;
  payments?: number;
  subscriptions?: number;
  organizationApplications?: number;
  tenants?: number;
}

/**
 * Delete all data related to a tenant
 * Deletes in correct order to respect foreign key constraints
 */
export const deleteTenantData = async (tenantId: string): Promise<{
  tenantId: string;
  kindeOrgId: string | null;
  deletedRecords: DeletedRecords;
  startTime: Date;
  endTime: Date | null;
  success: boolean;
  errors: string[];
}> => {
  Logger.log('info', 'tenant', 'cleanup-tenant', `Starting cleanup for tenant: ${tenantId}`, { tenantId });

  const deletionResults: {
    tenantId: string;
    kindeOrgId: string | null;
    deletedRecords: DeletedRecords;
    startTime: Date;
    endTime: Date | null;
    success: boolean;
    errors: string[];
  } = {
    tenantId,
    kindeOrgId: null,
    deletedRecords: {},
    startTime: new Date(),
    endTime: null,
    success: false,
    errors: []
  };

  try {
    // Start transaction to ensure atomicity
    await db.transaction(async (tx) => {

      // 0. Capture kindeOrgId before deletion so callers can clean up Kinde orgs
      const [tenantRow] = await tx
        .select({ kindeOrgId: tenants.idpOrgId })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId));
      deletionResults.kindeOrgId = tenantRow?.kindeOrgId ?? null;

      // 1. Delete user role assignments first (has FKs to both tenantUsers and customRoles)
      Logger.log('info', 'tenant', 'cleanup-tenant', 'Deleting user role assignments...', { tenantId });
      
      // Get all user IDs for this tenant
      const tenantUserIds = await tx
        .select({ userId: tenantUsers.userId })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId));
      
      let userRoleAssignmentsResult = [];
      if (tenantUserIds.length > 0) {
        const userIds = tenantUserIds.map(row => row.userId);
        // Delete user role assignments for all users in this tenant
        userRoleAssignmentsResult = await tx
          .delete(userRoleAssignments)
          .where(
            or(
              ...userIds.map(userId => eq(userRoleAssignments.userId, userId))
            )
          )
          .returning({ id: userRoleAssignments.id });
      }
      deletionResults.deletedRecords.userRoleAssignments = userRoleAssignmentsResult.length;
      Logger.log('info', 'tenant', 'cleanup-tenant', `Deleted ${userRoleAssignmentsResult.length} user role assignments`, { tenantId, count: userRoleAssignmentsResult.length });

      // 2. Delete audit logs (has FK to tenantUsers - must delete before tenant users)
      Logger.log('info', 'tenant', 'cleanup-tenant', 'Deleting audit logs...', { tenantId });
      const auditLogsResult = await tx
        .delete(auditLogs)
        .where(eq(auditLogs.tenantId, tenantId))
        .returning({ id: auditLogs.logId });
      deletionResults.deletedRecords.auditLogs = auditLogsResult.length;
      Logger.log('info', 'tenant', 'cleanup-tenant', `Deleted ${auditLogsResult.length} audit logs`, { tenantId, count: auditLogsResult.length });

      // 5. Delete custom roles (has FK to tenants and created_by FK to tenant_users)
      Logger.log('info', 'tenant', 'cleanup-tenant', 'Deleting custom roles...', { tenantId });
      const customRolesResult = await tx
        .delete(customRoles)
        .where(eq(customRoles.tenantId, tenantId))
        .returning({ id: customRoles.roleId });
      deletionResults.deletedRecords.customRoles = customRolesResult.length;
      Logger.log('info', 'tenant', 'cleanup-tenant', `Deleted ${customRolesResult.length} custom roles`, { tenantId, count: customRolesResult.length });

      // 6. Delete tenant users (has FK to tenants)
      Logger.log('info', 'tenant', 'cleanup-tenant', 'Deleting tenant users...', { tenantId });
      const tenantUsersResult = await tx
        .delete(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId))
        .returning({ id: tenantUsers.userId });
      deletionResults.deletedRecords.tenantUsers = tenantUsersResult.length;
      Logger.log('info', 'tenant', 'cleanup-tenant', `Deleted ${tenantUsersResult.length} tenant users`, { tenantId, count: tenantUsersResult.length });

      // 7. Delete payments (has FK to subscriptions)
      Logger.log('info', 'tenant', 'cleanup-tenant', 'Deleting payments...', { tenantId });
      const paymentsResult = await tx
        .delete(payments)
        .where(eq(payments.tenantId, tenantId))
        .returning({ id: payments.paymentId });
      deletionResults.deletedRecords.payments = paymentsResult.length;
      Logger.log('info', 'tenant', 'cleanup-tenant', `Deleted ${paymentsResult.length} payments`, { tenantId, count: paymentsResult.length });

      // 8. Delete subscriptions (has FK to tenants)
      Logger.log('info', 'tenant', 'cleanup-tenant', 'Deleting subscriptions...', { tenantId });
      const subscriptionsResult = await tx
        .delete(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .returning({ id: subscriptions.subscriptionId });
      deletionResults.deletedRecords.subscriptions = subscriptionsResult.length;
      Logger.log('info', 'tenant', 'cleanup-tenant', `Deleted ${subscriptionsResult.length} subscriptions`, { tenantId, count: subscriptionsResult.length });

      // 9. Delete organization applications (has FK to tenants)
      Logger.log('info', 'tenant', 'cleanup-tenant', 'Deleting organization applications...', { tenantId });
      const orgAppsResult = await tx
        .delete(organizationApplications)
        .where(eq(organizationApplications.tenantId, tenantId))
        .returning({ id: organizationApplications.id });
      deletionResults.deletedRecords.organizationApplications = orgAppsResult.length;
      Logger.log('info', 'tenant', 'cleanup-tenant', `Deleted ${orgAppsResult.length} organization applications`, { tenantId, count: orgAppsResult.length });

      // 10. Finally, delete the tenant itself
      Logger.log('info', 'tenant', 'cleanup-tenant', 'Deleting tenant...', { tenantId });
      const tenantResult = await tx
        .delete(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .returning({ id: tenants.tenantId });
      deletionResults.deletedRecords.tenants = tenantResult.length;
      Logger.log('info', 'tenant', 'cleanup-tenant', `Deleted ${tenantResult.length} tenant record`, { tenantId, count: tenantResult.length });

      if (tenantResult.length === 0) {
        throw new Error(`Tenant ${tenantId} not found`);
      }
    });

    deletionResults.success = true;
    deletionResults.endTime = new Date();

    Logger.log('info', 'tenant', 'cleanup-tenant', 'Tenant cleanup completed successfully', {
      tenantId,
      totalTime: deletionResults.endTime ? `${deletionResults.endTime.getTime() - deletionResults.startTime.getTime()}ms` : 'N/A',
      deletedRecords: deletionResults.deletedRecords
    });

    return deletionResults;

  } catch (err: unknown) {
    deletionResults.success = false;
    deletionResults.endTime = new Date();
    deletionResults.errors.push(err instanceof Error ? err.message : String(err));

    const error = err as Error;
    Logger.log('error', 'tenant', 'cleanup-tenant', 'Tenant cleanup failed', { tenantId, error: error.message, stack: error.stack });
    throw err;
  }
};

/**
 * Delete multiple tenants by email domain (useful for cleaning up test accounts)
 */
export const deleteTenantsByDomain = async (emailDomain: string): Promise<{ domain: string; totalTenants: number; results: unknown[] }> => {
  Logger.log('info', 'tenant', 'cleanup-by-domain', `Starting cleanup for tenants with email domain: ${emailDomain}`, { emailDomain });

  try {
    // Find all tenants with matching email domain
    const tenantsToDelete = await db
      .select({ tenantId: tenants.tenantId, adminEmail: tenants.adminEmail })
      .from(tenants)
      .where(like(tenants.adminEmail, `%@${emailDomain}`));

    Logger.log('info', 'tenant', 'cleanup-by-domain', `Found ${tenantsToDelete.length} tenants to delete`, { emailDomain, count: tenantsToDelete.length });

    const results = [];

    for (const tenant of tenantsToDelete) {
      Logger.log('info', 'tenant', 'cleanup-by-domain', `Deleting tenant: ${tenant.adminEmail}`, { tenantId: tenant.tenantId, adminEmail: tenant.adminEmail });
      try {
        const result = await deleteTenantData(tenant.tenantId);
        results.push(result);
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('error', 'tenant', 'cleanup-by-domain', `Failed to delete tenant ${tenant.tenantId}`, { tenantId: tenant.tenantId, error: error.message, stack: error.stack });
        results.push({
          tenantId: tenant.tenantId,
          success: false,
          error: error.message
        });
      }
    }

    return {
      domain: emailDomain,
      totalTenants: tenantsToDelete.length,
      results
    };

  } catch (error) {
    const err = error as Error;
    Logger.log('error', 'tenant', 'cleanup-by-domain', 'Domain cleanup failed', { emailDomain, error: err.message, stack: err.stack });
    throw error;
  }
};

/**
 * Get tenant data summary (useful before deletion)
 */
export const getTenantDataSummary = async (tenantId: string): Promise<{
  tenant: Record<string, unknown>;
  recordCounts: Record<string, number>;
}> => {
  try {
    const [tenantInfo] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId));

    if (!tenantInfo) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Count records in each related table
    // First get all tenant user IDs
    const tenantUserIds = await db
      .select({ userId: tenantUsers.userId })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, tenantId));
    
    let userRoleAssignmentsCount = { count: 0 };
    if (tenantUserIds.length > 0) {
      const userIds = tenantUserIds.map(row => row.userId);
      [userRoleAssignmentsCount] = await db
        .select({ count: count() })
        .from(userRoleAssignments)
        .where(
          or(
            ...userIds.map(userId => eq(userRoleAssignments.userId, userId))
          )
        );
    }

    const [tenantUsersCount] = await db
      .select({ count: count() })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, tenantId));

    const [customRolesCount] = await db
      .select({ count: count() })
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId));

    const [subscriptionsCount] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId));

    const [paymentsCount] = await db
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.tenantId, tenantId));

    const [orgAppsCount] = await db
      .select({ count: count() })
      .from(organizationApplications)
      .where(eq(organizationApplications.tenantId, tenantId));

    const [auditLogsCount] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId));

    return {
      tenant: tenantInfo,
      recordCounts: {
        userRoleAssignments: userRoleAssignmentsCount.count,
        tenantUsers: tenantUsersCount.count,
        customRoles: customRolesCount.count,
        subscriptions: subscriptionsCount.count,
        payments: paymentsCount.count,
        organizationApplications: orgAppsCount.count,
        auditLogs: auditLogsCount.count
      }
    };

  } catch (error) {
    const err = error as Error;
    Logger.log('error', 'tenant', 'get-summary', 'Failed to get tenant summary', { tenantId, error: err.message, stack: err.stack });
    throw error;
  }
};
