/**
 * Internal Service Auth Routes
 * Audience: machine-to-machine authentication flows.
 * Handles session validation, SSO token validation, and service JWT issuance.
 * All routes require X-Internal-API-Key.
 *
 * ── JWT secret rotation (zero-downtime, no client refresh needed) ──────────
 * Wrapper is the issuer; CRM and FA are verifiers. All three share `JWT_SECRET`.
 * Issuance ALWAYS signs with `JWT_SECRET` (this file); verifiers can also
 * accept tokens signed with secrets listed in `JWT_SECRET_PREVIOUS`.
 *
 * Rotation procedure (one secret → one new secret):
 *   1. Generate the new secret. Set `JWT_SECRET_PREVIOUS=<current>` on
 *      wrapper, CRM, and FA. Deploy all three. Verifiers now accept both.
 *   2. Set `JWT_SECRET=<new>` on wrapper (issuer). Deploy wrapper. New
 *      tokens are signed with <new>; in-flight tokens still verify against
 *      <current> via JWT_SECRET_PREVIOUS on the verifiers.
 *   3. Set `JWT_SECRET=<new>` on CRM and FA. Deploy them. Verifiers now
 *      prefer <new> but still tolerate <current>.
 *   4. After max-token-lifetime (24h), unset `JWT_SECRET_PREVIOUS` on all
 *      three services. Deploy. Rotation complete.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateInternalApiKey } from '../../middleware/auth/internal.js';
import { TenantService } from '../../services/tenant-service.js';
import { db } from '../../db/index.js';
import { tenants, tenantUsers } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import DistributedSSOCache from '../../utils/distributed-sso-cache.js';
import crypto from 'crypto';
import ErrorResponses from '../../utils/error-responses.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import Logger from '../../utils/logger.js';

// Module-level JWKS set for SSO token validation — shared, not recreated per request.
const ssoKindeIssuerUrl = process.env.KINDE_ISSUER_URL || process.env.KINDE_DOMAIN || 'https://auth.zopkit.com';
const ssoJwks = createRemoteJWKSet(
  new URL(`${ssoKindeIssuerUrl}/.well-known/jwks.json`),
  { cacheMaxAge: 6 * 60 * 60 * 1000 } // 6 hours
);

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
          Logger.log('info', 'routes', 'validate-session', `🎯 CACHE HIT: Session validation for ${kinde_user_id}`);
          return cachedSession;
        }
      }

      Logger.log('info', 'routes', 'validate-session', `💾 Cache MISS: Validating session in database`);

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
          Logger.log('info', 'routes', 'validate-sso-token', `🎯 CACHE HIT: SSO token validation`);
          return { valid: true, ...cachedToken, source: 'cache' };
        }
      }

      Logger.log('info', 'routes', 'validate-sso-token', `💾 Cache MISS: Validating SSO token via Kinde JWT + database`);

      // Verify the JWT token using Kinde's JWKS endpoint
      let jwtPayload: Record<string, unknown>;
      try {
        const { payload } = await jwtVerify(token, ssoJwks, {
          issuer: ssoKindeIssuerUrl,
        });
        jwtPayload = payload as Record<string, unknown>;
      } catch (jwtErr: unknown) {
        const jwtError = jwtErr as Error;
        fastify.log.warn(`SSO token JWT verification failed: ${jwtError.message}`);
        return reply.code(401).send({ valid: false, error: 'Invalid or expired SSO token' });
      }

      // Extract claims from the verified token
      const kindeUserId = jwtPayload.sub as string | undefined;
      const orgCode = (jwtPayload.org_code ?? jwtPayload.organization ?? jwtPayload.organization_code) as string | undefined;
      const tokenExp = jwtPayload.exp as number | undefined;

      if (!kindeUserId) {
        return reply.code(401).send({ valid: false, error: 'Token missing subject claim' });
      }

      // Resolve tenant from org code
      let tenantRecord: { tenantId: string; name: string } | undefined;
      if (orgCode) {
        const [found] = await db
          .select({ tenantId: tenants.tenantId, name: tenants.name })
          .from(tenants)
          .where(eq(tenants.kindeOrgId, orgCode))
          .limit(1) as Array<{ tenantId: string; name: string }>;
        tenantRecord = found;
      }

      // Look up the user in tenantUsers by kindeUserId (scoped to tenant when available)
      const whereClause = tenantRecord
        ? and(eq(tenantUsers.kindeUserId, kindeUserId), eq(tenantUsers.tenantId, tenantRecord.tenantId), eq(tenantUsers.isActive, true))
        : and(eq(tenantUsers.kindeUserId, kindeUserId), eq(tenantUsers.isActive, true));

      const [userRecord] = await db
        .select({
          userId: tenantUsers.userId,
          tenantId: tenantUsers.tenantId,
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
        })
        .from(tenantUsers)
        .where(whereClause)
        .limit(1) as Array<{ userId: string; tenantId: string; email: string; firstName: string | null; lastName: string | null }>;

      if (!userRecord) {
        return reply.code(401).send({ valid: false, error: 'User not found or inactive' });
      }

      // Resolve tenant name — use what we already fetched, or look it up from the user record
      let resolvedTenantId = tenantRecord?.tenantId ?? userRecord.tenantId;
      let resolvedTenantName = tenantRecord?.name;
      if (!resolvedTenantName) {
        const [tenantRow] = await db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.tenantId, resolvedTenantId))
          .limit(1) as Array<{ name: string }>;
        resolvedTenantName = tenantRow?.name ?? resolvedTenantId;
      }

      const userName = [userRecord.firstName, userRecord.lastName].filter(Boolean).join(' ') || userRecord.email;
      const expiresAt = tokenExp ? new Date(tokenExp * 1000) : new Date(Date.now() + 2 * 60 * 60 * 1000);

      const tokenValidation = {
        valid: true,
        user:   { id: userRecord.userId, email: userRecord.email, name: userName },
        tenant: { id: resolvedTenantId, name: resolvedTenantName },
        expires_at: expiresAt,
      };

      await (DistributedSSOCache as any).cacheSSOToken?.(tokenHash, tokenValidation);

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
      Logger.log('info', 'routes', 'service-auth', `🔑 Service authentication request: ${service} for tenant ${tenant_id}`);

      const tenant = await TenantService.getTenantDetails(tenant_id);
      if (!tenant) return ErrorResponses.notFound(reply, 'Tenant', 'Tenant not found');

      const { sign } = await import('jsonwebtoken');
      const payload = {
        service,
        tenant_id,
        permissions,
        type: 'service_token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      };

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }
      const token = sign(payload, secret);

      Logger.log('info', 'routes', 'service-auth', `✅ Service token generated for ${service}`);

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
