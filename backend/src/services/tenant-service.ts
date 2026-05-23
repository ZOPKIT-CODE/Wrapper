/**
 * TenantService — backward-compatible facade.
 *
 * All implementations have been extracted into focused modules:
 *   - tenant-core-service.ts   → tenant CRUD, settings, onboarding
 *   - tenant-user-service.ts   → invitations, user listing, removal, role updates
 *   - tenant-repository.ts     → pure DB queries (subdomain, kindeOrgId lookups)
 *
 * This file re-exports everything from those modules so that all existing
 * callers continue to work without any import changes.
 */

import { TenantCoreService } from './tenant-core-service.js';
import { TenantUserService } from './tenant-user-service.js';
import { tenants, customRoles, tenantUsers } from '../db/schema/index.js';

export class TenantService {
  // ---------------------------------------------------------------------------
  // Core tenant CRUD — delegate to TenantCoreService
  // ---------------------------------------------------------------------------

  static async createTenant(data: Parameters<typeof TenantCoreService.createTenant>[0]): Promise<{ tenant: typeof tenants.$inferSelect; adminRole: typeof customRoles.$inferSelect; adminUser: typeof tenantUsers.$inferSelect }> {
    return TenantCoreService.createTenant(data);
  }

  static async getBySubdomain(subdomain: string): Promise<Record<string, unknown> | null> {
    return TenantCoreService.getBySubdomain(subdomain);
  }

  static async getByKindeOrgId(kindeOrgId: string): Promise<Record<string, unknown> | null> {
    return TenantCoreService.getByKindeOrgId(kindeOrgId);
  }

  static async getTenantDetails(tenantId: string): Promise<Record<string, unknown>> {
    return TenantCoreService.getTenantDetails(tenantId);
  }

  static async upsertBankingDetails(tenantId: string, data: Record<string, unknown>): Promise<void> {
    return TenantCoreService.upsertBankingDetails(tenantId, data);
  }

  static async getOnboardingStatus(tenantId: string): Promise<Record<string, unknown>> {
    return TenantCoreService.getOnboardingStatus(tenantId);
  }

  static async markOnboardingComplete(tenantId: string, userId: string): Promise<{ success: boolean; completedAt: Date; message: string }> {
    return TenantCoreService.markOnboardingComplete(tenantId, userId);
  }

  static async updateTenant(tenantId: string, updates: Record<string, unknown>): Promise<typeof tenants.$inferSelect | undefined> {
    return TenantCoreService.updateTenant(tenantId, updates);
  }

  static async deactivateTenant(tenantId: string, reason: string): Promise<typeof tenants.$inferSelect | undefined> {
    return TenantCoreService.deactivateTenant(tenantId, reason);
  }

  static async reactivateTenant(tenantId: string): Promise<typeof tenants.$inferSelect | undefined> {
    return TenantCoreService.reactivateTenant(tenantId);
  }

  static async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
    return TenantCoreService.checkSubdomainAvailability(subdomain);
  }

  static getDefaultAdminPermissions() {
    return TenantCoreService.getDefaultAdminPermissions();
  }

  // ---------------------------------------------------------------------------
  // User / invitation management — delegate to TenantUserService
  // ---------------------------------------------------------------------------

  static async inviteUser(data: Parameters<typeof TenantUserService.inviteUser>[0]): Promise<ReturnType<typeof TenantUserService.inviteUser>> {
    return TenantUserService.inviteUser(data);
  }

  static async acceptInvitation(
    invitationToken: string,
    kindeUserId: string,
    userData: { email: string; firstName?: string; lastName?: string }
  ): Promise<ReturnType<typeof TenantUserService.acceptInvitation>> {
    return TenantUserService.acceptInvitation(invitationToken, kindeUserId, userData);
  }

  static async getPendingInvitations(tenantId: string): ReturnType<typeof TenantUserService.getPendingInvitations> {
    return TenantUserService.getPendingInvitations(tenantId);
  }

  static async resendInvitationEmail(invitationId: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    return TenantUserService.resendInvitationEmail(invitationId, tenantId);
  }

  static async cancelInvitation(tenantId: string, invitationId: string, cancelledBy?: string): Promise<{ success: boolean; message: string }> {
    return TenantUserService.cancelInvitation(tenantId, invitationId, cancelledBy);
  }

  static async getTenantUsers(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return TenantUserService.getTenantUsers(tenantId);
  }

  static async getTenantUsersByEntity(tenantId: string, entityId: string | undefined): Promise<Array<Record<string, unknown>>> {
    return TenantUserService.getTenantUsersByEntity(tenantId, entityId);
  }

  static async getEntityChildren(entityId: string): Promise<Set<string>> {
    return TenantUserService.getEntityChildren(entityId);
  }

  static async deleteUser(userId: string, tenantId: string): Promise<unknown> {
    return TenantUserService.deleteUser(userId, tenantId);
  }

  static async removeUser(tenantId: string, userId: string, removedBy: string): Promise<{ success: boolean; message: string }> {
    return TenantUserService.removeUser(tenantId, userId, removedBy);
  }

  static async removeActiveUser(userId: string, tenantId: string): Promise<{ success: boolean; message: string; data: unknown }> {
    return TenantUserService.removeActiveUser(userId, tenantId);
  }

  static async updateUserRole(userId: string, roleId: string, tenantId: string): Promise<{ success: boolean; message: string; data: unknown }> {
    return TenantUserService.updateUserRole(userId, roleId, tenantId);
  }

  static async getUserByEmailInTenant(tenantId: string, email: string): Promise<typeof tenantUsers.$inferSelect | undefined> {
    return TenantUserService.getUserByEmailInTenant(tenantId, email);
  }
}

export default TenantService;
