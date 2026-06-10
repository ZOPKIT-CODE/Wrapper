import { beforeEach, describe, expect, it, vi } from 'vitest';

// getActivePlatformStaff hits the DB; mock the db module so these tests stay pure.
// Default: no platform_staff row for anyone (select chain resolves to []).
const { staffRowsMock } = vi.hoisted(() => ({ staffRowsMock: { rows: [] as unknown[] } }));

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => staffRowsMock.rows,
        }),
      }),
    }),
    insert: () => ({ values: async () => undefined }),
  },
}));
vi.mock('../../utils/logger.js', () => ({ default: { log: vi.fn() } }));

import { requirePlatformPermission, requirePlatformOrOwnTenant } from './platform-permission-middleware.js';

function makeReqReply(userContext: Record<string, unknown>, params: Record<string, string> = {}) {
  const reply = {
    statusCode: 0,
    body: undefined as unknown,
    code(c: number) { this.statusCode = c; return this; },
    send(b: unknown) { this.body = b; return this; },
  };
  const request = { userContext, params, url: '/x', method: 'GET', ip: '1.2.3.4', headers: {} } as any;
  return { request, reply };
}

const TENANT_ADMIN = { isAuthenticated: true, isPlatformAdmin: false, isSuperAdmin: false, isTenantAdmin: true, tenantId: 'T1', idpSub: 'sub-ta' };
const TENANT_SUPERADMIN = { isAuthenticated: true, isPlatformAdmin: false, isSuperAdmin: true, isTenantAdmin: true, tenantId: 'T1', idpSub: 'sub-sa' };
const PLATFORM_ADMIN = { isAuthenticated: true, isPlatformAdmin: true, isSuperAdmin: false, isTenantAdmin: false, tenantId: null, idpSub: 'sub-pa' };

beforeEach(() => { staffRowsMock.rows = []; });

describe('requirePlatformPermission (platform-only)', () => {
  it('allows a platform admin', async () => {
    const { request, reply } = makeReqReply(PLATFORM_ADMIN);
    await requirePlatformPermission('credit_config:read')(request, reply as any);
    expect(reply.statusCode).toBe(0); // no reply sent → passed through
  });

  it('DENIES a tenant super admin (the cross-tenant escalation regression)', async () => {
    const { request, reply } = makeReqReply(TENANT_SUPERADMIN);
    await requirePlatformPermission('credit_config:read')(request, reply as any);
    expect(reply.statusCode).toBe(403);
  });

  it('denies a plain tenant admin', async () => {
    const { request, reply } = makeReqReply(TENANT_ADMIN);
    await requirePlatformPermission('credit_config:read')(request, reply as any);
    expect(reply.statusCode).toBe(403);
  });

  it('401s when unauthenticated', async () => {
    const { request, reply } = makeReqReply({ isAuthenticated: false });
    await requirePlatformPermission('credit_config:read')(request, reply as any);
    expect(reply.statusCode).toBe(401);
  });
});

describe('requirePlatformOrOwnTenant (dual-purpose)', () => {
  it('allows a platform admin on ANY tenant', async () => {
    const { request, reply } = makeReqReply(PLATFORM_ADMIN, { tenantId: 'T-OTHER' });
    await requirePlatformOrOwnTenant('credit_config:read')(request, reply as any);
    expect(reply.statusCode).toBe(0);
  });

  it('allows a tenant admin on their OWN tenant', async () => {
    const { request, reply } = makeReqReply(TENANT_ADMIN, { tenantId: 'T1' });
    await requirePlatformOrOwnTenant('credit_config:read')(request, reply as any);
    expect(reply.statusCode).toBe(0);
  });

  it('DENIES a tenant admin targeting a DIFFERENT tenant', async () => {
    const { request, reply } = makeReqReply(TENANT_ADMIN, { tenantId: 'T2' });
    await requirePlatformOrOwnTenant('credit_config:read')(request, reply as any);
    expect(reply.statusCode).toBe(403);
  });

  it('DENIES a tenant super admin targeting a DIFFERENT tenant (no cross-tenant via isSuperAdmin)', async () => {
    const { request, reply } = makeReqReply(TENANT_SUPERADMIN, { tenantId: 'T2' });
    await requirePlatformOrOwnTenant('credit_config:read')(request, reply as any);
    expect(reply.statusCode).toBe(403);
  });
});
