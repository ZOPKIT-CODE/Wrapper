import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, seedTenant, type TestDb } from '../db/test-helpers/seed.js';
import { TenantRepository } from './tenant-repository.js';
import { TenantService } from './tenant-service.js';

let db: TestDb;
let endDb: () => Promise<void>;

beforeAll(() => {
  const conn = createTestDb();
  db = conn.db;
  endDb = conn.end;
});

afterAll(() => endDb());

describe('tenant repository/service integration', () => {
  it('fetches tenant by subdomain and idpOrgId', async () => {
    const tenant = await seedTenant(db);

    const bySubdomain = await TenantRepository.getBySubdomain(tenant.subdomain);
    expect(bySubdomain).not.toBeNull();
    expect(bySubdomain?.tenantId).toBe(tenant.tenantId);

    const byOrgId = await TenantRepository.getByIdpOrgId(tenant.idpOrgId);
    expect(byOrgId).not.toBeNull();
    expect(byOrgId?.tenantId).toBe(tenant.tenantId);
  });

  it('checks subdomain availability via service', async () => {
    const tenant = await seedTenant(db);

    const taken = await TenantService.checkSubdomainAvailability(tenant.subdomain);
    const free = await TenantService.checkSubdomainAvailability(`free-${Date.now()}`);

    expect(taken).toBe(false);
    expect(free).toBe(true);
  });

  it('service-level lookups delegate to repository correctly', async () => {
    const tenant = await seedTenant(db);

    const bySubdomain = await TenantService.getBySubdomain(tenant.subdomain);
    const byIdpOrgId = await TenantService.getByIdpOrgId(tenant.idpOrgId);

    expect(bySubdomain?.tenantId).toBe(tenant.tenantId);
    expect(byIdpOrgId?.tenantId).toBe(tenant.tenantId);
  });
});
