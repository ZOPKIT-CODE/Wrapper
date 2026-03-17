/**
 * Admin Routes — Registrar
 * Mounted at: /api/admin
 *
 * Thin wrapper that registers all admin sub-route plugins.
 * Actual route logic lives in the split modules:
 *   - admin-org-routes.ts               (auth/context, organizations)
 *   - admin-trial-routes.ts             (trial management)
 *   - admin-user-routes.ts              (user CRUD, invitations, org memberships)
 *   - company-tenant-settings-routes.ts (company-user self-service: own tenant settings,
 *                                        onboarding status, deletion — resolves tenant
 *                                        from session, never from a URL param)
 *   - admin-role-routes.ts              (role CRUD, audit logs)
 *
 * ⚠️  Platform-staff cross-tenant operations (any :tenantId) live in
 *     tenant-management.ts, mounted separately at /api/admin/tenants.
 */

import type { FastifyInstance } from 'fastify';
import adminOrgRoutes from './admin-org-routes.js';
import adminTrialRoutes from './admin-trial-routes.js';
import adminUserRoutes from './admin-user-routes.js';
import companyTenantSettingsRoutes from './company-tenant-settings-routes.js';
import adminRoleRoutes from './admin-role-routes.js';

export default async function adminRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  fastify.register(adminOrgRoutes);
  fastify.register(adminTrialRoutes);
  fastify.register(adminUserRoutes);
  fastify.register(companyTenantSettingsRoutes);
  fastify.register(adminRoleRoutes);
}
