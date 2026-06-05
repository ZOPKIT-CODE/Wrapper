/**
 * credit-core — Integration Tests
 *
 * Runs against a REAL PostgreSQL container.  No mocks.
 *
 * What is proved here that unit tests CANNOT:
 *   1. ensureCreditRecord is truly idempotent (unique DB constraint enforced).
 *   2. ensureCreditRecord respects the entity FK — inserting for a non-existent
 *      entity returns false instead of throwing a FK violation.
 *   3. findRootOrganization follows the correct priority order:
 *        primary membership → isDefault flag → oldest root org.
 *   4. All helpers are tenant-scoped — data from other tenants is invisible.
 */

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import {
  createTestDb,
  seedTenant,
  seedUser,
  seedOrganization,
  seedMembership,
  seedCreditRecord,
  type TestDb,
  organizationMemberships,
  entities,
  credits,
} from '../../../db/test-helpers/seed.js';
import {
  ensureCreditRecord,
  findRootOrganization,
} from './credit-core.js';
import { eq, and } from 'drizzle-orm';

// ---------------------------------------------------------------------------
let db: TestDb;
let endDb: () => Promise<void>;

beforeAll(() => {
  const conn = createTestDb();
  db    = conn.db;
  endDb = conn.end;
});

afterAll(() => endDb());

// ===========================================================================
// ensureCreditRecord
// ===========================================================================
describe('ensureCreditRecord', () => {

  // -------------------------------------------------------------------------
  it('returns false when the entity does not exist in the entities table', async () => {
    const tenant = await seedTenant(db);

    // Must be a valid UUID format — PostgreSQL rejects non-UUID strings outright.
    const created = await ensureCreditRecord(
      tenant.tenantId,
      'organization',
      '00000000-0000-0000-0000-000000000000', // valid UUID, but no matching row
    );

    expect(created).toBe(false);
  });

  // -------------------------------------------------------------------------
  it('creates a credit record and returns true on first call', async () => {
    const tenant = await seedTenant(db);
    const org    = await seedOrganization(db, tenant.tenantId);

    const created = await ensureCreditRecord(tenant.tenantId, 'organization', org.entityId, 500);

    expect(created).toBe(true);

    // Verify the row exists in DB with the correct balance
    const [row] = await db
      .select()
      .from(credits)
      .where(and(
        eq(credits.tenantId, tenant.tenantId),
        eq(credits.entityId, org.entityId),
      ))
      .limit(1);

    expect(row).toBeDefined();
    expect(Number(row.availableCredits)).toBe(500);
  });

  // -------------------------------------------------------------------------
  it('is idempotent — calling twice returns false on the second call', async () => {
    const tenant = await seedTenant(db);
    const org    = await seedOrganization(db, tenant.tenantId);

    const first  = await ensureCreditRecord(tenant.tenantId, 'organization', org.entityId, 100);
    const second = await ensureCreditRecord(tenant.tenantId, 'organization', org.entityId, 200);

    expect(first).toBe(true);
    expect(second).toBe(false); // record already existed — no upsert

    // Balance must still reflect the FIRST insert, not the second call's value
    const [row] = await db
      .select()
      .from(credits)
      .where(and(
        eq(credits.tenantId, tenant.tenantId),
        eq(credits.entityId, org.entityId),
      ))
      .limit(1);

    expect(Number(row.availableCredits)).toBe(100);
  });

  // -------------------------------------------------------------------------
  it('uses tenantId as entityId when no entityId is supplied', async () => {
    // This path is exercised when a tenant-level credit record is created.
    // ensureCreditRecord() falls back: const searchEntityId = entityId || tenantId
    // But tenantId is not in the entities table, so it should return false.
    const tenant = await seedTenant(db);

    const created = await ensureCreditRecord(tenant.tenantId, 'organization', null, 0);

    expect(created).toBe(false); // tenantId is not in entities → guarded by the entity lookup
  });

  // -------------------------------------------------------------------------
  it('is scoped to the tenant — same entityId across two tenants creates two independent records', async () => {
    const tenantA = await seedTenant(db);
    const tenantB = await seedTenant(db);

    // Create same-named entity in each tenant (different entityIds because UUIDs)
    const orgA = await seedOrganization(db, tenantA.tenantId, { entityName: 'Shared Name' });
    const orgB = await seedOrganization(db, tenantB.tenantId, { entityName: 'Shared Name' });

    const createdA = await ensureCreditRecord(tenantA.tenantId, 'organization', orgA.entityId, 100);
    const createdB = await ensureCreditRecord(tenantB.tenantId, 'organization', orgB.entityId, 200);

    expect(createdA).toBe(true);
    expect(createdB).toBe(true);

    const [rowA] = await db.select().from(credits).where(eq(credits.entityId, orgA.entityId)).limit(1);
    const [rowB] = await db.select().from(credits).where(eq(credits.entityId, orgB.entityId)).limit(1);

    expect(Number(rowA.availableCredits)).toBe(100);
    expect(Number(rowB.availableCredits)).toBe(200);
  });
});

// ===========================================================================
// findRootOrganization
// ===========================================================================
describe('findRootOrganization', () => {

  // -------------------------------------------------------------------------
  it('returns null for an unknown tenantId', async () => {
    const result = await findRootOrganization('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('returns null when the tenant has no organizations', async () => {
    const tenant = await seedTenant(db);
    const result = await findRootOrganization(tenant.tenantId);
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('Priority 3 (fallback) — returns any root org when there is only one', async () => {
    const tenant = await seedTenant(db);

    // No isPrimary membership, no isDefault flag — should fall back to the only root org
    const org    = await seedOrganization(db, tenant.tenantId, { entityName: 'Solo Root' });

    const result = await findRootOrganization(tenant.tenantId);
    expect(result).toBe(org.entityId);
  });

  // -------------------------------------------------------------------------
  // SKIPPED: this asserts an "isDefault" preference that the current code does NOT
  // implement. `entities.is_default` was dropped in migration 0015_drop_unused_columns
  // and findRootOrganization's priority is: primary membership → first active root org →
  // oldest root org (no isDefault tier). Re-enable (and implement the tier) only if the
  // "default org" concept is intentionally reintroduced. See also seed.ts isDefault note.
  it.skip('Priority 2 (isDefault) — prefers the default org over others', async () => {
    const tenant = await seedTenant(db);

    const ordinary = await seedOrganization(db, tenant.tenantId, { entityName: 'Ordinary' });
    const preferred = await seedOrganization(db, tenant.tenantId, {
      entityName: 'Default Org',
      isDefault:  true,
    });

    const result = await findRootOrganization(tenant.tenantId);
    expect(result).toBe(preferred.entityId);
    expect(result).not.toBe(ordinary.entityId);
  });

  // -------------------------------------------------------------------------
  it('Priority 1 (isPrimary membership) — highest priority, overrides isDefault', async () => {
    const tenant = await seedTenant(db);
    const user   = await seedUser(db, tenant.tenantId);

    // This org is marked isDefault
    const defaultOrg = await seedOrganization(db, tenant.tenantId, {
      entityName: 'Default Org',
      isDefault:  true,
    });

    // This org has a PRIMARY membership — should win
    const primaryOrg = await seedOrganization(db, tenant.tenantId, {
      entityName: 'Primary Org',
      isDefault:  false,
    });

    await seedMembership(db, {
      userId:    user.userId,
      tenantId:  tenant.tenantId,
      entityId:  primaryOrg.entityId,
      isPrimary: true,
    });

    const result = await findRootOrganization(tenant.tenantId);
    expect(result).toBe(primaryOrg.entityId);
    expect(result).not.toBe(defaultOrg.entityId);
  });

  // -------------------------------------------------------------------------
  it('is tenant-scoped — does not return orgs from other tenants', async () => {
    const tenantA = await seedTenant(db);
    const tenantB = await seedTenant(db);

    // Only tenantB has an org
    const orgB = await seedOrganization(db, tenantB.tenantId, { entityName: 'B Only' });

    const resultForA = await findRootOrganization(tenantA.tenantId);
    expect(resultForA).toBeNull(); // A has no orgs, must not see B's

    const resultForB = await findRootOrganization(tenantB.tenantId);
    expect(resultForB).toBe(orgB.entityId);
  });

  // -------------------------------------------------------------------------
  it('ignores child orgs (parentEntityId IS NOT NULL) when falling back to root search', async () => {
    const tenant = await seedTenant(db);

    const parent = await seedOrganization(db, tenant.tenantId, { entityName: 'Parent' });
    // child has a parent → NOT a root org
    await seedOrganization(db, tenant.tenantId, {
      entityName:     'Child',
      parentEntityId: parent.entityId,
    });

    const result = await findRootOrganization(tenant.tenantId);
    expect(result).toBe(parent.entityId); // child excluded
  });
});
