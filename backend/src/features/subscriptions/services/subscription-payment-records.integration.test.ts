import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createTestDb, seedTenant, seedPayment, type TestDb } from '../../../db/test-helpers/seed.js';
import { db } from '../../../db/index.js';
import { payments } from '../../../db/schema/billing/subscriptions.js';
import { and, eq } from 'drizzle-orm';
import { PaymentService } from './payment-service.js';
const { createPaymentRecord, processRefund } = PaymentService;

let testDb: TestDb;
let endDb: () => Promise<void>;

beforeAll(() => {
  const conn = createTestDb();
  testDb = conn.db;
  endDb = conn.end;
});

afterAll(() => endDb());

// ---------------------------------------------------------------------------
// createPaymentRecord
// ---------------------------------------------------------------------------
describe('createPaymentRecord', () => {
  it('auto-generates a UUID paymentId and persists the record', async () => {
    const tenant = await seedTenant(testDb);

    const result = await createPaymentRecord({
      tenantId: tenant.tenantId,
      amount: 49.99,
      currency: 'USD',
      status: 'succeeded',
    });

    expect(result.paymentId).toBeTruthy();
    expect(typeof result.paymentId).toBe('string');
    // Must be a valid UUID format
    expect(result.paymentId as string).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.tenantId).toBe(tenant.tenantId);
  });

  it('coerces a numeric amount to a decimal string in the DB', async () => {
    const tenant = await seedTenant(testDb);

    const result = await createPaymentRecord({
      tenantId: tenant.tenantId,
      amount: 99.99,
      currency: 'USD',
      status: 'succeeded',
    });

    // DB decimal columns are returned as strings by postgres
    expect(typeof result.amount).toBe('string');
    expect(parseFloat(result.amount as string)).toBeCloseTo(99.99);
  });

  it('uppercases the currency code regardless of input case', async () => {
    const tenant = await seedTenant(testDb);

    const result = await createPaymentRecord({
      tenantId: tenant.tenantId,
      amount: 10,
      currency: 'eur',   // lowercase input
      status: 'succeeded',
    });

    expect(result.currency).toBe('EUR');
  });

  it('defaults paymentType to "subscription" and paymentMethod to "card" when not provided', async () => {
    const tenant = await seedTenant(testDb);

    const result = await createPaymentRecord({
      tenantId: tenant.tenantId,
      amount: 20,
      currency: 'USD',
      status: 'succeeded',
      // paymentType and paymentMethod intentionally omitted
    });

    expect(result.paymentType).toBe('subscription');
    expect(result.paymentMethod).toBe('card');
  });

  it('stores metadata and the value is retrievable from the DB', async () => {
    const tenant = await seedTenant(testDb);
    const meta = { invoiceRef: `INV-${randomUUID().slice(0, 6)}`, planId: 'starter' };

    const result = await createPaymentRecord({
      tenantId: tenant.tenantId,
      amount: 30,
      currency: 'USD',
      status: 'succeeded',
      metadata: meta,
    });

    // Query DB directly to confirm persistence
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentId, result.paymentId as string));

    expect(row?.metadata).toMatchObject(meta);
  });

  it('accepts a negative amount for refund-type audit records', async () => {
    const tenant = await seedTenant(testDb);

    const result = await createPaymentRecord({
      tenantId: tenant.tenantId,
      amount: -50.00,
      currency: 'USD',
      status: 'succeeded',
      paymentType: 'refund',
    });

    expect(parseFloat(result.amount as string)).toBeCloseTo(-50);
    expect(result.paymentType).toBe('refund');
  });
});

// ---------------------------------------------------------------------------
// processRefund
// ---------------------------------------------------------------------------
describe('processRefund', () => {
  /**
   * Key: payments seeded via seedPayment() have no stripePaymentIntentId and
   * no stripeChargeId → the condition
   *   (payment.stripePaymentIntentId || payment.stripeChargeId) && gateway.isConfigured()
   * evaluates to false, so the Stripe gateway call is bypassed entirely.
   * This makes full DB-level refund tests possible without any Stripe setup.
   */

  it('marks the original payment as "refunded" and creates a negative-amount audit record', async () => {
    const tenant = await seedTenant(testDb);

    // No Stripe IDs → gateway bypass
    const seeded = await seedPayment(testDb, {
      tenantId: tenant.tenantId,
      amount: '100.00',
      status: 'succeeded',
    });

    const refundResult = await processRefund({
      tenantId: tenant.tenantId,
      paymentId: seeded.paymentId,
    });

    // Return value shape
    expect(refundResult.amount).toBe(100);
    expect(refundResult.status).toBe('succeeded');
    expect(refundResult.isPartialRefund).toBe(false);

    // Original row must be marked 'refunded'
    const [original] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentId, seeded.paymentId));
    expect(original?.status).toBe('refunded');

    // An audit record with paymentType='refund' and a negative amount must exist
    const refundRows = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenant.tenantId),
          eq(payments.paymentType, 'refund'),
        ),
      );
    expect(refundRows.length).toBeGreaterThanOrEqual(1);

    const auditRecord = refundRows.find((r) => parseFloat(r.amount) < 0);
    expect(auditRecord).toBeDefined();
    expect(parseFloat(auditRecord!.amount)).toBeCloseTo(-100);
  });

  it('marks the original payment as "partially_refunded" when a partial amount is specified', async () => {
    const tenant = await seedTenant(testDb);

    const seeded = await seedPayment(testDb, {
      tenantId: tenant.tenantId,
      amount: '100.00',
      status: 'succeeded',
    });

    const result = await processRefund({
      tenantId: tenant.tenantId,
      paymentId: seeded.paymentId,
      amount: 40,   // 40 out of 100 → partial
    });

    expect(result.isPartialRefund).toBe(true);
    expect(result.amount).toBe(40);

    const [original] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentId, seeded.paymentId));
    expect(original?.status).toBe('partially_refunded');
  });

  it('throws "Payment not found" for an unknown paymentId', async () => {
    const tenant = await seedTenant(testDb);

    await expect(
      processRefund({
        tenantId: tenant.tenantId,
        paymentId: randomUUID(), // random UUID not in DB
      }),
    ).rejects.toThrow('Payment not found');
  });

  it('throws "Payment does not belong to this tenant" when tenantId mismatches', async () => {
    const tenantA = await seedTenant(testDb);
    const tenantB = await seedTenant(testDb);

    // Payment belongs to tenant A
    const seeded = await seedPayment(testDb, {
      tenantId: tenantA.tenantId,
      amount: '60.00',
      status: 'succeeded',
    });

    // Attempt refund from tenant B's context
    await expect(
      processRefund({
        tenantId: tenantB.tenantId,
        paymentId: seeded.paymentId,
      }),
    ).rejects.toThrow('Payment does not belong to this tenant');
  });
});
