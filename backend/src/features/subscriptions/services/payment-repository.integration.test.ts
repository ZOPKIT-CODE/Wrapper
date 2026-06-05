import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createTestDb, seedTenant, seedPayment, type TestDb } from '../../../db/test-helpers/seed.js';
import { db } from '../../../db/index.js';
import { payments } from '../../../db/schema/billing/subscriptions.js';
import { eq } from 'drizzle-orm';
import { PaymentRepository } from './payment-repository.js';

let testDb: TestDb;
let endDb: () => Promise<void>;

beforeAll(() => {
  const conn = createTestDb();
  testDb = conn.db;
  endDb = conn.end;
});

afterAll(() => endDb());

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
describe('PaymentRepository – create', () => {
  it('inserts a payment record and returns the persisted row with all key fields', async () => {
    const tenant = await seedTenant(testDb);
    const intentId = `pi_test_${randomUUID().slice(0, 8)}`;

    const payment = await PaymentRepository.create({
      tenantId: tenant.tenantId,
      amount: '75.00',
      currency: 'USD',
      status: 'succeeded',
      stripePaymentIntentId: intentId,
      paymentType: 'subscription',
    });

    expect(payment).toBeDefined();
    expect(payment.tenantId).toBe(tenant.tenantId);
    expect(payment.amount).toBe('75.00');
    // PaymentRepository normalizes 'succeeded'/'paid' -> 'completed' to satisfy the
    // chk_payment_status DB constraint (pending/completed/failed/refunded/processing/cancelled).
    expect(payment.status).toBe('completed');
    expect(payment.stripePaymentIntentId).toBe(intentId);
    expect(payment.paymentId).toBeTruthy();

    // Verify the row actually exists in the DB
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentId, payment.paymentId));
    expect(row).toBeDefined();
    expect(row?.amount).toBe('75.00');
  });
});

// ---------------------------------------------------------------------------
// getByPaymentIntentId
// ---------------------------------------------------------------------------
describe('PaymentRepository – getByPaymentIntentId', () => {
  it('returns null for an unknown payment intent ID', async () => {
    const result = await PaymentRepository.getByPaymentIntentId('pi_nonexistent_xyz_' + randomUUID());
    expect(result).toBeNull();
  });

  it('returns the correct payment for a known payment intent ID', async () => {
    const tenant = await seedTenant(testDb);
    const intentId = `pi_test_${randomUUID().slice(0, 8)}`;

    await seedPayment(testDb, {
      tenantId: tenant.tenantId,
      stripePaymentIntentId: intentId,
      amount: '200.00',
      status: 'succeeded',
    });

    const found = await PaymentRepository.getByPaymentIntentId(intentId);
    expect(found).not.toBeNull();
    expect(found!.stripePaymentIntentId).toBe(intentId);
    expect(found!.tenantId).toBe(tenant.tenantId);
    expect(found!.amount).toBe('200.00');
  });
});

// ---------------------------------------------------------------------------
// updateByPaymentIntentId
// ---------------------------------------------------------------------------
describe('PaymentRepository – updateByPaymentIntentId', () => {
  it('updates the status of an existing payment and returns the updated record', async () => {
    const tenant = await seedTenant(testDb);
    const intentId = `pi_test_${randomUUID().slice(0, 8)}`;

    await seedPayment(testDb, {
      tenantId: tenant.tenantId,
      stripePaymentIntentId: intentId,
      amount: '50.00',
      status: 'pending',
    });

    const updated = await PaymentRepository.updateByPaymentIntentId(intentId, {
      status: 'succeeded',
    });

    expect(updated).toBeDefined();
    // 'succeeded' is normalized to 'completed' by the repository (see create test above).
    expect(updated!.status).toBe('completed');
    expect(updated!.stripePaymentIntentId).toBe(intentId);
  });

  it('returns undefined when the payment intent ID does not exist', async () => {
    const result = await PaymentRepository.updateByPaymentIntentId(
      'pi_ghost_' + randomUUID(),
      { status: 'failed' },
    );
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getHistoryByTenant
// ---------------------------------------------------------------------------
describe('PaymentRepository – getHistoryByTenant', () => {
  it('returns an empty array for a tenant with no payments', async () => {
    const tenant = await seedTenant(testDb);
    const result = await PaymentRepository.getHistoryByTenant(tenant.tenantId);
    expect(result).toHaveLength(0);
  });

  it('returns all payments for a tenant', async () => {
    const tenant = await seedTenant(testDb);

    await seedPayment(testDb, { tenantId: tenant.tenantId, amount: '10.00', status: 'succeeded' });
    await seedPayment(testDb, { tenantId: tenant.tenantId, amount: '20.00', status: 'succeeded' });
    await seedPayment(testDb, { tenantId: tenant.tenantId, amount: '30.00', status: 'succeeded' });

    const history = await PaymentRepository.getHistoryByTenant(tenant.tenantId);
    expect(history).toHaveLength(3);
    // Every returned row must belong to this tenant
    history.forEach((p) => expect(p.tenantId).toBe(tenant.tenantId));
  });

  it('respects the limit parameter', async () => {
    const tenant = await seedTenant(testDb);

    for (let i = 0; i < 5; i++) {
      await seedPayment(testDb, {
        tenantId: tenant.tenantId,
        amount: `${(i + 1) * 10}.00`,
        status: 'succeeded',
      });
    }

    const limited = await PaymentRepository.getHistoryByTenant(tenant.tenantId, 3);
    expect(limited).toHaveLength(3);
  });

  it('is tenant-scoped: does not return payments from other tenants', async () => {
    const tenantA = await seedTenant(testDb);
    const tenantB = await seedTenant(testDb);

    await seedPayment(testDb, { tenantId: tenantA.tenantId, amount: '100.00', status: 'succeeded' });

    const historyB = await PaymentRepository.getHistoryByTenant(tenantB.tenantId);
    expect(historyB).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getBySubscription
// ---------------------------------------------------------------------------
describe('PaymentRepository – getBySubscription', () => {
  it('returns an empty array for an unknown subscription ID', async () => {
    const result = await PaymentRepository.getBySubscription(randomUUID());
    expect(result).toHaveLength(0);
  });

  it('returns all payments linked to a specific subscription', async () => {
    const tenant = await seedTenant(testDb);

    // Insert a minimal subscription row to satisfy the FK constraint
    const subResult = await db.execute(sql`
      INSERT INTO subscriptions (tenant_id, plan, status)
      VALUES (${tenant.tenantId}, 'starter', 'active')
      RETURNING subscription_id AS "subscriptionId"
    `);
    const subscriptionId = Array.from(
      subResult as unknown as Array<{ subscriptionId: string }>
    )[0].subscriptionId;

    // Insert two payments linked to that subscription
    await db.execute(sql`
      INSERT INTO payments (tenant_id, subscription_id, amount, currency, status, paid_at)
      VALUES (${tenant.tenantId}, ${subscriptionId}, '150.00', 'USD', 'succeeded', NOW())
    `);
    await db.execute(sql`
      INSERT INTO payments (tenant_id, subscription_id, amount, currency, status, paid_at)
      VALUES (${tenant.tenantId}, ${subscriptionId}, '150.00', 'USD', 'succeeded', NOW())
    `);

    const results = await PaymentRepository.getBySubscription(subscriptionId);
    expect(results).toHaveLength(2);
    results.forEach((p) => expect(p.subscriptionId).toBe(subscriptionId));
  });
});

// ---------------------------------------------------------------------------
// getFailedByTenant
// ---------------------------------------------------------------------------
describe('PaymentRepository – getFailedByTenant', () => {
  it('returns only failed payments for a tenant, ignoring succeeded ones', async () => {
    const tenant = await seedTenant(testDb);

    await seedPayment(testDb, { tenantId: tenant.tenantId, amount: '50.00', status: 'failed' });
    await seedPayment(testDb, { tenantId: tenant.tenantId, amount: '60.00', status: 'failed' });
    await seedPayment(testDb, { tenantId: tenant.tenantId, amount: '75.00', status: 'succeeded' }); // excluded

    const failed = await PaymentRepository.getFailedByTenant(tenant.tenantId);
    expect(failed).toHaveLength(2);
    failed.forEach((p) => {
      expect(p.status).toBe('failed');
      expect(p.tenantId).toBe(tenant.tenantId);
    });
  });

  it('returns an empty array when no failed payments exist for a tenant', async () => {
    const tenant = await seedTenant(testDb);
    await seedPayment(testDb, { tenantId: tenant.tenantId, amount: '100.00', status: 'succeeded' });

    const failed = await PaymentRepository.getFailedByTenant(tenant.tenantId);
    expect(failed).toHaveLength(0);
  });

  it('is tenant-scoped: failed payments from other tenants are not returned', async () => {
    const tenantA = await seedTenant(testDb);
    const tenantB = await seedTenant(testDb);

    await seedPayment(testDb, { tenantId: tenantA.tenantId, amount: '50.00', status: 'failed' });

    const failedB = await PaymentRepository.getFailedByTenant(tenantB.tenantId);
    expect(failedB).toHaveLength(0);
  });
});
