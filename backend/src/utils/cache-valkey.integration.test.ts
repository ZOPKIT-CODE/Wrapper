/**
 * Integration tests for the Valkey-backed shared caches.
 *
 * Runs against a real Valkey via testcontainers (the in-memory fallback is the
 * easy path; the SCAN / TTL / cross-instance / namespacing paths are where the
 * production risk lives, and those only exist against a real server).
 *
 * Run: `npm run test:integration` (excluded from the fast default `test` run).
 * Requires Docker.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { SharedCache } from './shared-cache.js';
import { DistributedSSOCache } from './distributed-sso-cache.js';
import { getValkey, isValkeyReady, closeValkey } from './valkey-client.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitReady(timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  getValkey();
  while (!isValkeyReady()) {
    if (Date.now() - start > timeoutMs) throw new Error('valkey not ready in time');
    await sleep(100);
  }
}

// ── Fallback (no Valkey configured) ─────────────────────────────────────────
// REDIS_ENABLED unset → getValkey() returns null → caches use the in-process Map.
describe('SharedCache — in-process fallback (REDIS disabled)', () => {
  const prev = { enabled: process.env.REDIS_ENABLED, url: process.env.REDIS_URL };
  beforeAll(() => {
    delete process.env.REDIS_ENABLED;
    delete process.env.REDIS_URL;
  });
  afterAll(() => {
    if (prev.enabled !== undefined) process.env.REDIS_ENABLED = prev.enabled;
    if (prev.url !== undefined) process.env.REDIS_URL = prev.url;
  });

  it('round-trips, deletes, and prefix-deletes without throwing', async () => {
    const c = new SharedCache<{ v: string }>('test:fallback');
    await c.set('u1:t1', { v: 'a' }, 5_000);
    await c.set('u1:t2', { v: 'b' }, 5_000);
    await c.set('u2:t1', { v: 'c' }, 5_000);
    expect((await c.get('u1:t1'))?.v).toBe('a');
    expect(await c.get('missing')).toBeUndefined();
    await c.delete('u2:t1');
    expect(await c.get('u2:t1')).toBeUndefined();
    await c.deleteByPrefix('u1:');
    expect(await c.get('u1:t1')).toBeUndefined();
    expect(await c.get('u1:t2')).toBeUndefined();
  });

  it('DistributedSSOCache works via Map fallback', async () => {
    const cache = new DistributedSSOCache();
    await cache.cacheUserPermissions('u1', 't1', 'crm', { permissions: ['x'] });
    expect((await cache.getUserPermissions('u1', 't1', 'crm') as any)?.permissions[0]).toBe('x');
    await cache.invalidateUserCache('u1');
    expect(await cache.getUserPermissions('u1', 't1', 'crm')).toBeNull();
  });
});

// ── Single-tier shared cache against a real Valkey ──────────────────────────
describe('Valkey single-tier shared cache', () => {
  beforeAll(async () => {
    // REDIS_ENABLED / REDIS_URL are provided by globalSetup (valkey-test-setup.ts),
    // which started the Valkey container before this worker spawned.
    await waitReady();
  }, 120_000);

  afterAll(async () => {
    await closeValkey();
  });

  beforeEach(async () => {
    await getValkey()!.flushall();
  });

  describe('SharedCache', () => {
    it('set/get round-trips an object value', async () => {
      const c = new SharedCache<{ v: string | null }>('auth:user');
      await c.set('sub1:tenantA', { v: 'hello' }, 5_000);
      expect((await c.get('sub1:tenantA'))?.v).toBe('hello');
      expect(await c.get('nope')).toBeUndefined();
    });

    it('delete on instance A is visible to instance B (single-tier shared)', async () => {
      const a = new SharedCache<{ v: string }>('auth:user');
      const b = new SharedCache<{ v: string }>('auth:user');
      await a.set('sub1:tenantA', { v: 'x' }, 5_000);
      expect((await b.get('sub1:tenantA'))?.v).toBe('x'); // shared read
      await a.delete('sub1:tenantA');
      expect(await b.get('sub1:tenantA')).toBeUndefined(); // cross-instance invalidation
    });

    it('deleteByPrefix (SCAN) clears only the matching prefix, fleet-wide', async () => {
      const a = new SharedCache<{ v: string }>('auth:user');
      const b = new SharedCache<{ v: string }>('auth:user');
      await a.set('sub2:t1', { v: '1' }, 5_000);
      await a.set('sub2:t2', { v: '2' }, 5_000);
      await a.set('sub3:t1', { v: '3' }, 5_000);
      await b.deleteByPrefix('sub2:');
      expect(await a.get('sub2:t1')).toBeUndefined();
      expect(await a.get('sub2:t2')).toBeUndefined();
      expect((await a.get('sub3:t1'))?.v).toBe('3');
    });

    it('honors PX TTL expiry', async () => {
      const c = new SharedCache<{ v: string }>('auth:user');
      await c.set('ttl', { v: 'x' }, 600);
      expect((await c.get('ttl'))?.v).toBe('x');
      await sleep(900);
      expect(await c.get('ttl')).toBeUndefined();
    });

    it('round-trips a literal-true value and a string value', async () => {
      const boolCache = new SharedCache<true>('auth:tenant-exists');
      await boolCache.set('tenantA', true, 5_000);
      expect(await boolCache.get('tenantA')).toBe(true);

      const strCache = new SharedCache<string>('auth:pkce');
      await strCache.set('state1', 'verifier-xyz', 5_000);
      expect(await strCache.get('state1')).toBe('verifier-xyz');
    });

    it('isolates identical keys across namespaces', async () => {
      const userC = new SharedCache<{ v: string }>('auth:user');
      const roleC = new SharedCache<{ v: string }>('auth:role');
      await userC.set('collide', { v: 'fromUser' }, 5_000);
      await roleC.set('collide', { v: 'fromRole' }, 5_000);
      expect((await userC.get('collide'))?.v).toBe('fromUser');
      expect((await roleC.get('collide'))?.v).toBe('fromRole');
    });
  });

  describe('DistributedSSOCache', () => {
    it('caches and reads auth/permissions across instances', async () => {
      const a = new DistributedSSOCache();
      const b = new DistributedSSOCache();
      await a.cacheUserAuth('idp1', 'orgA', { user: { id: 'u1' } });
      await a.cacheUserPermissions('u1', 't1', 'crm', { permissions: ['x'] });
      expect((await b.getUserAuth('idp1', 'orgA') as any)?.user?.id).toBe('u1');
      expect((await b.getUserPermissions('u1', 't1', 'crm') as any)?.permissions[0]).toBe('x');
    });

    it('invalidateUserCache clears that user only, fleet-wide', async () => {
      const a = new DistributedSSOCache();
      const b = new DistributedSSOCache();
      await a.cacheUserPermissions('u1', 't1', 'crm', { permissions: ['x'] });
      await a.cacheUserPermissions('u1', 't1', 'hr', { permissions: ['y'] });
      await a.cacheUserPermissions('u9', 't1', 'crm', { permissions: ['other'] });
      await a.invalidateUserCache('u1');
      expect(await b.getUserPermissions('u1', 't1', 'crm')).toBeNull();
      expect(await b.getUserPermissions('u1', 't1', 'hr')).toBeNull();
      expect((await b.getUserPermissions('u9', 't1', 'crm') as any)?.permissions[0]).toBe('other');
    });

    it('invalidateTenantCache clears all users in the tenant', async () => {
      const cache = new DistributedSSOCache();
      await cache.cacheUserPermissions('u1', 'tX', 'crm', { permissions: ['a'] });
      await cache.cacheUserPermissions('u2', 'tX', 'crm', { permissions: ['b'] });
      await cache.cacheUserPermissions('u3', 'tY', 'crm', { permissions: ['c'] });
      await cache.invalidateTenantCache('tX');
      expect(await cache.getUserPermissions('u1', 'tX', 'crm')).toBeNull();
      expect(await cache.getUserPermissions('u2', 'tX', 'crm')).toBeNull();
      expect((await cache.getUserPermissions('u3', 'tY', 'crm') as any)?.permissions[0]).toBe('c');
    });

    it('invalidateAppCache clears one app across users, leaves others', async () => {
      const cache = new DistributedSSOCache();
      await cache.cacheUserPermissions('u1', 't1', 'crm', { permissions: ['a'] });
      await cache.cacheUserPermissions('u2', 't1', 'crm', { permissions: ['b'] });
      await cache.cacheUserPermissions('u1', 't1', 'hr', { permissions: ['h'] });
      await cache.invalidateAppCache('crm');
      expect(await cache.getUserPermissions('u1', 't1', 'crm')).toBeNull();
      expect(await cache.getUserPermissions('u2', 't1', 'crm')).toBeNull();
      expect((await cache.getUserPermissions('u1', 't1', 'hr') as any)?.permissions[0]).toBe('h');
    });

    it('invalidateUserAppPermissions surgically clears one user+app only', async () => {
      const cache = new DistributedSSOCache();
      await cache.cacheUserPermissions('u1', 't1', 'crm', { permissions: ['a'] });
      await cache.cacheUserPermissions('u1', 't1', 'hr', { permissions: ['h'] });
      await cache.cacheUserPermissions('u9', 't1', 'crm', { permissions: ['other'] });
      await cache.invalidateUserAppPermissions('u1', 't1', 'crm');
      expect(await cache.getUserPermissions('u1', 't1', 'crm')).toBeNull();
      expect((await cache.getUserPermissions('u1', 't1', 'hr') as any)?.permissions[0]).toBe('h');
      expect((await cache.getUserPermissions('u9', 't1', 'crm') as any)?.permissions[0]).toBe('other');
    });

    it('escapeGlob prevents an id glob char from over-deleting', async () => {
      const cache = new DistributedSSOCache();
      await cache.cacheUserPermissions('u1', 't1', 'crm', { permissions: ['keep1'] });
      await cache.cacheUserPermissions('ux', 't1', 'crm', { permissions: ['keep2'] });
      // A crafted glob identifier must be treated literally (matches nothing here),
      // NOT expanded to wipe u1/ux.
      await cache.invalidateUserCache('u*');
      expect((await cache.getUserPermissions('u1', 't1', 'crm') as any)?.permissions[0]).toBe('keep1');
      expect((await cache.getUserPermissions('ux', 't1', 'crm') as any)?.permissions[0]).toBe('keep2');
    });

    it('sso: namespace does not collide with SharedCache auth:* keys', async () => {
      const authUser = new SharedCache<{ v: string }>('auth:user');
      const sso = new DistributedSSOCache();
      await authUser.set('u1:t1', { v: 'auth-entry' }, 5_000);
      await sso.cacheUserPermissions('u1', 't1', 'crm', { permissions: ['x'] });
      // Invalidating the SSO cache for the tenant must NOT touch SharedCache auth:* keys.
      await sso.invalidateTenantCache('t1');
      expect((await authUser.get('u1:t1'))?.v).toBe('auth-entry');
    });
  });

  describe('resilience', () => {
    it('fails open (returns miss / no throw) when Valkey errors mid-op', async () => {
      // Point the singleton at a dead port to force connection errors, then confirm
      // get/set/delete never throw and degrade to the in-process Map.
      await closeValkey();
      const prevUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://127.0.0.1:6553'; // nothing listening
      const c = new SharedCache<{ v: string }>('auth:user');
      await expect(c.set('k', { v: 'v' }, 5_000)).resolves.toBeUndefined();
      await expect(c.get('k')).resolves.toBeDefined(); // served from Map fallback
      await expect(c.delete('k')).resolves.toBeUndefined();
      await expect(c.deleteByPrefix('k')).resolves.toBeUndefined();
      // restore for any later tests / afterAll
      await closeValkey();
      process.env.REDIS_URL = prevUrl;
      await waitReady();
    });
  });
});
