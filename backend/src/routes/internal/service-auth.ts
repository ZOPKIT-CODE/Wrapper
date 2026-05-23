/**
 * Internal Service Auth Routes
 * Audience: machine-to-machine authentication flows.
 * Handles session validation, SSO token validation, and service JWT issuance.
 * All routes require X-Internal-API-Key.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateInternalApiKey } from '../../middleware/auth/internal.js';
import { TenantService } from '../../services/tenant-service.js';
import { db } from '../../db/index.js';
import { tenantUsers } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import DistributedSSOCache from '../../utils/distributed-sso-cache.js';
import crypto from 'crypto';
import ErrorResponses from '../../utils/error-responses.js';

export default async function internalServiceAuthRoutes(fastify: FastifyInstance): Promise<void> {

  // Validate whether a Kinde user/org pair has an active session in this tenant
  fastify.post('/validate-session', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const kinde_user_id  = (body.kinde_user_id  as string) ?? '';
    const kinde_org_code = (body.kinde_org_code as string) ?? '';
    const force_refresh  = body.force_refresh as boolean | undefined;

    try {
      if (!force_refresh) {
        const cachedSession = await (DistributedSSOCache as any).getSessionValidation?.(kinde_user_id, kinde_org_code);
        if (cachedSession) {
          console.log(`🎯 CACHE HIT: Session validation for ${kinde_user_id}`);
          return cachedSession;
        }
      }

      console.log(`💾 Cache MISS: Validating session in database`);

      const tenant = await TenantService.getByKindeOrgId(kinde_org_code);
      if (!tenant) {
        await (DistributedSSOCache as any).cacheSessionValidation?.(kinde_user_id, kinde_org_code, false);
        return { valid: false, error: 'Tenant not found' };
      }

      const userResult = await db
        .select({ id: tenantUsers.userId, isActive: tenantUsers.isActive })
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.kindeUserId, kinde_user_id),
          eq(tenantUsers.tenantId, tenant.tenantId as string),
        ))
        .limit(1) as any[];

      const isValid = userResult.length > 0 && userResult[0].isActive;
      const userData = isValid ? { tenant_id: tenant.tenantId, user_id: userResult[0].id } : null;

      await (DistributedSSOCache as any).cacheSessionValidation?.(kinde_user_id, kinde_org_code, isValid, userData);

      return { valid: isValid, ...userData };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error validating session:');
      return { valid: false, error: 'Validation failed' };
    }
  });

  // Validate an SSO token (hash-keyed cache)
  fastify.post('/validate-sso-token', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const token        = (body.token    as string) ?? '';
    const force_refresh = body.force_refresh as boolean | undefined;

    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      if (!force_refresh) {
        const cachedToken = await (DistributedSSOCache as any).getSSOToken?.(tokenHash);
        if (cachedToken) {
          console.log(`🎯 CACHE HIT: SSO token validation`);
          return { valid: true, ...cachedToken, source: 'cache' };
        }
      }

      console.log(`💾 Cache MISS: Validating SSO token in database`);

      // TODO: replace stub with real token validation against a token store
      const tokenValidation = {
        valid: true,
        user:    { id: 'user_123', email: 'user@example.com', name: 'John Doe' },
        tenant:  { id: 'tenant_123', name: 'Company Name' },
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
      };

      if (tokenValidation.valid) {
        await (DistributedSSOCache as any).cacheSSOToken?.(tokenHash, tokenValidation);
      }

      return { ...tokenValidation, source: 'database' };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Error validating SSO token:');
      return reply.code(500).send({ error: 'Failed to validate SSO token', message: (err as Error).message });
    }
  });

  // Issue a short-lived service JWT for a trusted internal service
  fastify.post('/service-auth', {
    preHandler: [validateInternalApiKey],
    schema: {},
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const service    = (body.service    as string)   ?? '';
    const tenant_id  = (body.tenant_id  as string)   ?? '';
    const permissions = (body.permissions as string[]) ?? ['read'];

    try {
      console.log(`🔑 Service authentication request: ${service} for tenant ${tenant_id}`);

      const tenant = await TenantService.getTenantDetails(tenant_id);
      if (!tenant) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const { signServiceToken } = await import('../../utils/jwt-signing.js');
      const payload = {
        service,
        tenant_id,
        permissions,
        type: 'service_token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      };

      // signServiceToken transparently picks RS256 (if configured) or HS256
      // (default, JWT_SECRET) so existing downstream verifiers keep working.
      const token = signServiceToken(payload);

      console.log(`✅ Service token generated for ${service}`);

      return {
        success: true,
        data: {
          token,
          service,
          tenant_id,
          permissions,
          expires_in: 24 * 60 * 60,
          token_type: 'service_jwt',
        },
      };
    } catch (err: unknown) {
      fastify.log.error(err as Error, 'Service authentication error:');
      return reply.code(500).send({ error: 'Failed to authenticate service' });
    }
  });
}
