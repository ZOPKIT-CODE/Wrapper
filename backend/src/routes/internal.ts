/**
 * Internal API — route orchestrator
 *
 * Mounts focused sub-routers, each owning a single concern.
 * app-routes.ts registers this plugin at /api/internal — no changes needed there.
 *
 * Sub-routers:
 *   tenant-config  → /api/internal/health, /tenant/:id/config, /tenant/:id/features
 *   user-access    → /api/internal/validate-access, /user-permissions, /user-tools
 *   service-auth   → /api/internal/validate-session, /validate-sso-token, /service-auth
 *   cache          → /api/internal/cache/stats, /cache/invalidate, /cache/warmup
 *   tenant-snapshot → /api/internal/tenants/:tenantId/snapshot, /tenants/:tenantId/entitlements
 */

import type { FastifyInstance } from 'fastify';
import internalTenantConfigRoutes   from './internal/tenant-config.js';
import internalUserAccessRoutes     from './internal/user-access.js';
import internalServiceAuthRoutes    from './internal/service-auth.js';
import internalCacheRoutes          from './internal/cache.js';
import internalTenantSnapshotRoutes from './internal/tenant-snapshot.js';

export default async function internalRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(internalTenantConfigRoutes);
  await fastify.register(internalUserAccessRoutes);
  await fastify.register(internalServiceAuthRoutes);
  await fastify.register(internalCacheRoutes);
  await fastify.register(internalTenantSnapshotRoutes);
}
