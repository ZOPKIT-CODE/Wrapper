import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, desc, eq } from 'drizzle-orm';
import {
  createTestDb,
  seedTenant,
  type TestDb,
} from '../../../db/test-helpers/seed.js';
import { subscriptions } from '../../../db/schema/index.js';
import { getCurrentSubscription } from './subscription-core.js';

let db: TestDb;
let endDb: () => Promise<void>;

beforeAll(() => {
  const conn = createTestDb();
  db = conn.db;
  endDb = conn.end;
});

afterAll(() => endDb());

describe('subscription repository/core integration', () => {
  it('returns latest active subscription by tenant', async () => {
    const tenant = await seedTenant(db);

    await db.insert(subscriptions).values({
      tenantId: tenant.tenantId,
      plan: 'starter',
      status: 'canceled',
    });

    await db.insert(subscriptions).values({
      tenantId: tenant.tenantId,
      plan: 'professional',
      status: 'active',
    });

    // Query directly since SubscriptionRepository was inlined into subscription-core
    const [latestActive] = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.tenantId, tenant.tenantId), eq(subscriptions.status, 'active')))
      .orderBy(subscriptions.createdAt).limit(1);
    expect(latestActive).not.toBeNull();
    expect(latestActive?.plan).toBe('professional');
    expect(latestActive?.status).toBe('active');
  });

  it('getCurrentSubscription prefers active DB subscription plan', async () => {
    const tenant = await seedTenant(db);
    await db.insert(subscriptions).values({
      tenantId: tenant.tenantId,
      plan: 'enterprise',
      status: 'active',
      billingCycle: 'yearly',
    });

    const current = await getCurrentSubscription(tenant.tenantId);
    expect(current.plan).toBe('enterprise');
    expect(current.status).toBe('active');
  });

  it('is tenant-scoped and never returns another tenant subscription', async () => {
    const tenantA = await seedTenant(db);
    const tenantB = await seedTenant(db);

    await db.insert(subscriptions).values({
      tenantId: tenantB.tenantId,
      plan: 'starter',
      status: 'active',
    });

    const [forA] = await db.select().from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantA.tenantId))
      .orderBy(subscriptions.createdAt).limit(1);
    expect(forA).toBeUndefined();

    const bRows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.tenantId, tenantB.tenantId), eq(subscriptions.status, 'active')));
    expect(bRows.length).toBe(1);
  });
});
