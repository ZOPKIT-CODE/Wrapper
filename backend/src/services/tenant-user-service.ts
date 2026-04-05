/**
 * Tenant User Service — User listing, entity filtering, deletion, role updates.
 *
 * Provides a focused entry point for user-related tenant operations.
 * Delegates to the original TenantService methods (which will be migrated here
 * incrementally in follow-up PRs to avoid a risky big-bang rewrite).
 */

// Lazy import to avoid circular dependency (TenantService imports are heavy)
async function getTenantServiceImpl() {
  const { TenantService } = await import('./tenant-service.js');
  return TenantService;
}

export class TenantUserService {
  static async getTenantUsers(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const svc = await getTenantServiceImpl();
    return svc.getTenantUsers(tenantId);
  }

  static async getTenantUsersByEntity(tenantId: string, entityId: string | undefined): Promise<Array<Record<string, unknown>>> {
    const svc = await getTenantServiceImpl();
    return svc.getTenantUsersByEntity(tenantId, entityId);
  }

  static async getEntityChildren(entityId: string): Promise<Set<string>> {
    const svc = await getTenantServiceImpl();
    return svc.getEntityChildren(entityId);
  }

  static async deleteUser(userId: string, tenantId: string): Promise<unknown> {
    const svc = await getTenantServiceImpl();
    return svc.deleteUser(userId, tenantId);
  }

  static async removeUser(tenantId: string, userId: string, removedBy: string): Promise<{ success: boolean; message: string }> {
    const svc = await getTenantServiceImpl();
    return svc.removeUser(tenantId, userId, removedBy);
  }

  static async removeActiveUser(userId: string, tenantId: string): Promise<{ success: boolean; message: string; data: unknown }> {
    const svc = await getTenantServiceImpl();
    return svc.removeActiveUser(userId, tenantId);
  }

  static async updateUserRole(userId: string, roleId: string, tenantId: string): Promise<{ success: boolean; message: string; data: unknown }> {
    const svc = await getTenantServiceImpl();
    return svc.updateUserRole(userId, roleId, tenantId);
  }

  static async getUserByEmailInTenant(tenantId: string, email: string): Promise<unknown> {
    const svc = await getTenantServiceImpl();
    return svc.getUserByEmailInTenant(tenantId, email);
  }
}
