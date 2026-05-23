/**
 * Tenant Invitation Service — Invite, accept, resend, cancel.
 *
 * Thin re-export facade over TenantUserService for backward compatibility
 * with any code that imports from this file directly.
 */

export { TenantUserService as TenantInvitationService } from './tenant-user-service.js';
