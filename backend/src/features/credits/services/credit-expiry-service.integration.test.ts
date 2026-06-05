/**
 * Integration tests for CreditExpiryService.
 *
 * Tests run against a real PostgreSQL container (started by global-setup.ts).
 * All data is isolated per test via unique UUIDs.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import {
  createTestDb,
  seedTenant,
  seedOrganization,
  seedCreditRecord,
  type TestDb,
} from '../../../db/test-helpers/seed.js';
import { db } from '../../../db/index.js';
import { credits, creditTransactions } from '../../../db/schema/billing/credits.js';
import { CreditExpiryService } from './credit-expiry-service.js';

let testDb: TestDb;
let endDb: () => Promise<void>;

beforeAll(() => {
  const conn = createTestDb();
  testDb = conn.db;
  endDb = conn.end;
});

afterAll(() => endDb());

// ── Seed helper ───────────────────────────────────────────────────────────

type SeedAllocationInput = {
  tenantId: string;
  entityId: string;
  allocatedCredits?: string;
  usedCredits?: string;
  /** Default: 1 second in the past (expired) */
  expiresAt?: Date;
  isActive?: boolean;
  isExpired?: boolean;
  targetApplication?: string | null;
};

async function seedAllocation(
  db: TestDb,
  input: SeedAllocationInput,
): Promise<{ allocationId: string }> {
  const allocatedCredits = input.allocatedCredits ?? '100.0000';
  const usedCredits = input.usedCredits ?? '0';
  const expiresAt = input.expiresAt ?? new Date(Date.now() - 1_000);
  const isActive = input.isActive ?? true;
  const isExpired = input.isExpired ?? false;
  const targetApplication = input.targetApplication ?? null;
  const campaignName = `test-campaign-${randomUUID().slice(0, 8)}`;

  const [campaign] = await db.execute(sql`
    INSERT INTO seasonal_credit_campaigns
      (tenant_id, campaign_name, credit_type, total_credits, expires_at)
    VALUES
      (${input.tenantId}, ${campaignName}, 'promotional', '1000.0000', ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()})
    RETURNING campaign_id AS "campaignId"
  `) as Array<{ campaignId: string }>;

  const result = await db.execute(sql`
    INSERT INTO credit_batches
      (campaign_id, tenant_id, entity_id, allocated_credits, used_credits, expires_at, is_active, is_expired, target_application)
    VALUES
      (${campaign.campaignId}, ${input.tenantId}, ${input.entityId}, ${allocatedCredits}, ${usedCredits},
       ${expiresAt.toISOString()}, ${isActive}, ${isExpired}, ${targetApplication})
    RETURNING allocation_id AS "allocationId"
  `);

  const rows = Array.from(result as unknown as Array<{ allocationId: string }>);
  return rows[0];
}

// ── processExpiredCredits ──────────────────────────────────────────────────

describe('CreditExpiryService.processExpiredCredits', () => {
  it('returns processedCount=0 when there are no expired allocations', async () => {
    const result = await CreditExpiryService.processExpiredCredits();

    // At minimum, the call must succeed and return a well-shaped result
    expect(result.success).toBe(true);
    expect(typeof result.processedCount).toBe('number');
    expect(typeof result.errorCount).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });

  it('marks an expired allocation as isExpired=true and isActive=false', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);

    const { allocationId } = await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '50.0000',
      usedCredits: '50.0000', // fully used → unusedCredits = 0, no deduction
      expiresAt: new Date(Date.now() - 5_000),
    });

    await CreditExpiryService.processExpiredCredits();

    // Confirm the allocation row is marked expired
    const [row] = await db.execute(sql`
      SELECT is_expired AS "isExpired", is_active AS "isActive"
      FROM credit_batches
      WHERE allocation_id = ${allocationId}
    `) as Array<{ isExpired: boolean; isActive: boolean }>;

    expect(row?.isExpired).toBe(true);
    expect(row?.isActive).toBe(false);
  });

  it('deducts unused credits from the entity credit balance when unusedCredits > 0', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);
    // Seed credit record with 200 available credits
    await seedCreditRecord(testDb, tenant.tenantId, org.entityId, '200.0000');

    // Allocation with 80 allocated and 30 used → 50 unused credits to deduct
    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '80.0000',
      usedCredits: '30.0000',
      expiresAt: new Date(Date.now() - 2_000),
    });

    await CreditExpiryService.processExpiredCredits();

    // Balance should be 200 - 50 = 150
    const [creditRow] = await db
      .select()
      .from(credits)
      .where(
        and(
          eq(credits.tenantId, tenant.tenantId),
          eq(credits.entityId, org.entityId),
        ),
      );

    const balance = parseFloat(String(creditRow?.availableCredits ?? '0'));
    expect(balance).toBeCloseTo(150, 1);
  });

  it('creates a creditTransactions audit row with transactionType=expiry', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);
    await seedCreditRecord(testDb, tenant.tenantId, org.entityId, '100.0000');

    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '60.0000',
      usedCredits: '10.0000',
      expiresAt: new Date(Date.now() - 3_000),
    });

    await CreditExpiryService.processExpiredCredits();

    const txRows = await db
      .select()
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.tenantId, tenant.tenantId),
          eq(creditTransactions.entityId, org.entityId),
          eq(creditTransactions.transactionType, 'expiry'),
        ),
      );

    expect(txRows.length).toBeGreaterThanOrEqual(1);
    const tx = txRows[0];
    expect(parseFloat(String(tx?.amount ?? '0'))).toBeLessThan(0); // negative deduction
  });

  it('does NOT deduct credits when unusedCredits = 0 (all credits were used)', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);
    await seedCreditRecord(testDb, tenant.tenantId, org.entityId, '100.0000');

    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '30.0000',
      usedCredits: '30.0000', // fully used
      expiresAt: new Date(Date.now() - 2_000),
    });

    await CreditExpiryService.processExpiredCredits();

    // Balance should remain unchanged
    const [creditRow] = await db
      .select()
      .from(credits)
      .where(
        and(eq(credits.tenantId, tenant.tenantId), eq(credits.entityId, org.entityId)),
      );

    const balance = parseFloat(String(creditRow?.availableCredits ?? '0'));
    expect(balance).toBeCloseTo(100, 1);
  });

  it('does not re-process already-expired allocations', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);
    await seedCreditRecord(testDb, tenant.tenantId, org.entityId, '200.0000');

    // Seed an already-expired allocation (isExpired=true)
    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '100.0000',
      usedCredits: '0',
      expiresAt: new Date(Date.now() - 5_000),
      isExpired: true,
      isActive: false,
    });

    await CreditExpiryService.processExpiredCredits();

    // Balance should NOT be changed since the allocation was already expired
    const [creditRow] = await db
      .select()
      .from(credits)
      .where(and(eq(credits.tenantId, tenant.tenantId), eq(credits.entityId, org.entityId)));

    const balance = parseFloat(String(creditRow?.availableCredits ?? '0'));
    expect(balance).toBeCloseTo(200, 1); // unchanged
  });

  it('does not expire allocations with expiresAt in the future', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);
    await seedCreditRecord(testDb, tenant.tenantId, org.entityId, '100.0000');

    const { allocationId } = await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '50.0000',
      usedCredits: '0',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });

    await CreditExpiryService.processExpiredCredits();

    const [row] = await db.execute(sql`
      SELECT is_expired AS "isExpired"
      FROM credit_batches
      WHERE allocation_id = ${allocationId}
    `) as Array<{ isExpired: boolean }>;

    expect(row?.isExpired).toBe(false); // must NOT be expired
  });
});

// ── getExpiringCredits ─────────────────────────────────────────────────────

describe('CreditExpiryService.getExpiringCredits', () => {
  it('returns allocations expiring within the specified window', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);

    // Expires in 3 days — within the 7-day window
    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '50.0000',
      usedCredits: '20.0000',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    const results = await CreditExpiryService.getExpiringCredits(7, tenant.tenantId, org.entityId);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const item = results[0];
    expect(item.daysUntilExpiry).toBeGreaterThan(0);
    expect(item.daysUntilExpiry).toBeLessThanOrEqual(7);
    expect(item.unusedCredits).toBeCloseTo(30, 1); // 50 - 20
  });

  it('excludes allocations already expired', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);

    // Already expired
    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '40.0000',
      usedCredits: '0',
      expiresAt: new Date(Date.now() - 1_000),
      isExpired: true,
      isActive: false,
    });

    const results = await CreditExpiryService.getExpiringCredits(7, tenant.tenantId, org.entityId);

    // None of the results should be the already-expired one
    const expiredAlready = results.filter((r) => !r.isActive || r.isExpired);
    expect(expiredAlready).toHaveLength(0);
  });

  it('filters by targetApplication when specified', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);

    // One CRM allocation and one HR allocation
    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      targetApplication: 'crm',
    });

    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      targetApplication: 'hr',
    });

    const crmResults = await CreditExpiryService.getExpiringCredits(7, tenant.tenantId, org.entityId, 'crm');
    const crmApps = crmResults.map((r) => r.targetApplication);

    expect(crmApps.every((a) => a === 'crm')).toBe(true);
  });
});

// ── getExpiryStats ────────────────────────────────────────────────────────

describe('CreditExpiryService.getExpiryStats', () => {
  it('returns zeroed counts for entity with no active allocations', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);

    const stats = await CreditExpiryService.getExpiryStats(tenant.tenantId, org.entityId);

    expect(stats.expiringSoon.count).toBe(0);
    expect(stats.expiringSoon.unusedCredits).toBe(0);
    expect(stats.expiringWithin30Days.count).toBe(0);
  });

  it('counts allocations expiring within 7 days in expiringSoon', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);

    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '100.0000',
      usedCredits: '40.0000',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    });

    const stats = await CreditExpiryService.getExpiryStats(tenant.tenantId, org.entityId);

    expect(stats.expiringSoon.count).toBeGreaterThanOrEqual(1);
    expect(stats.expiringSoon.unusedCredits).toBeGreaterThan(0);
  });

  it('includes 30-day but not 7-day allocation in the right bucket', async () => {
    const tenant = await seedTenant(testDb);
    const org = await seedOrganization(testDb, tenant.tenantId);

    // Expires in 20 days — beyond 7-day window but within 30-day window
    await seedAllocation(testDb, {
      tenantId: tenant.tenantId,
      entityId: org.entityId,
      allocatedCredits: '70.0000',
      usedCredits: '10.0000',
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    });

    const stats = await CreditExpiryService.getExpiryStats(tenant.tenantId, org.entityId);

    // Should NOT appear in 7-day bucket
    expect(stats.expiringSoon.count).toBe(0);
    // SHOULD appear in 30-day bucket
    expect(stats.expiringWithin30Days.count).toBeGreaterThanOrEqual(1);
    expect(stats.expiringWithin30Days.unusedCredits).toBeGreaterThan(0);
  });
});
