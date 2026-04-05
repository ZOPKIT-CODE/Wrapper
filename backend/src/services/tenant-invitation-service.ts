/**
 * Tenant Invitation Service — Invite, accept, resend, cancel.
 *
 * Provides a focused entry point for invitation-related tenant operations.
 * Delegates to the original TenantService methods (which will be migrated here
 * incrementally in follow-up PRs to avoid a risky big-bang rewrite).
 */

// Lazy import to avoid circular dependency
async function getTenantServiceImpl() {
  const { TenantService } = await import('./tenant-service.js');
  return TenantService;
}

export class TenantInvitationService {
  static async inviteUser(data: {
    tenantId: string;
    email: string;
    roleId?: string;
    invitedBy: string;
    targetEntities?: Array<Record<string, unknown>>;
    invitationScope?: string;
    primaryEntityId?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<Record<string, unknown>> {
    const svc = await getTenantServiceImpl();
    return svc.inviteUser(data);
  }

  static async acceptInvitation(
    invitationToken: string,
    kindeUserId: string,
    userData: { email: string; name?: string; avatar?: string }
  ): Promise<unknown> {
    const svc = await getTenantServiceImpl();
    return svc.acceptInvitation(invitationToken, kindeUserId, userData);
  }

  static async getPendingInvitations(tenantId: string) {
    const svc = await getTenantServiceImpl();
    return svc.getPendingInvitations(tenantId);
  }

  static async resendInvitationEmail(invitationId: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    const svc = await getTenantServiceImpl();
    return svc.resendInvitationEmail(invitationId, tenantId);
  }

  static async cancelInvitation(tenantId: string, invitationId: string, cancelledBy?: string): Promise<{ success: boolean; message: string }> {
    const svc = await getTenantServiceImpl();
    return svc.cancelInvitation(tenantId, invitationId, cancelledBy);
  }
}
