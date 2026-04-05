import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { payments } from '../../../db/schema/billing/subscriptions.js';

/**
 * Select only columns guaranteed to exist in the DB.
 * The Drizzle schema may be ahead of the actual table (pending migration for
 * amount_refunded, refund_reason, is_partial_refund, refunded_at, provider).
 * Using explicit columns prevents "column does not exist" errors at runtime.
 */
const safeColumns = {
  paymentId: payments.paymentId,
  tenantId: payments.tenantId,
  subscriptionId: payments.subscriptionId,
  stripePaymentIntentId: payments.stripePaymentIntentId,
  stripeInvoiceId: payments.stripeInvoiceId,
  stripeChargeId: payments.stripeChargeId,
  amount: payments.amount,
  currency: payments.currency,
  status: payments.status,
  paymentMethod: payments.paymentMethod,
  paymentMethodDetails: payments.paymentMethodDetails,
  paymentType: payments.paymentType,
  billingReason: payments.billingReason,
  invoiceNumber: payments.invoiceNumber,
  description: payments.description,
  taxAmount: payments.taxAmount,
  metadata: payments.metadata,
  stripeRawData: payments.stripeRawData,
  paidAt: payments.paidAt,
  createdAt: payments.createdAt,
  updatedAt: payments.updatedAt,
};

export class PaymentRepository {
  static async create(paymentValues: Record<string, unknown>): Promise<typeof payments.$inferSelect> {
    const [payment] = await db.insert(payments).values(paymentValues as any).returning();
    return payment;
  }

  static async getByPaymentIntentId(paymentIntentId: string): Promise<typeof payments.$inferSelect | null> {
    const [payment] = await db
      .select(safeColumns)
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    return (payment as typeof payments.$inferSelect) ?? null;
  }

  static async updateByPaymentIntentId(
    paymentIntentId: string,
    updates: Record<string, unknown>
  ): Promise<typeof payments.$inferSelect | undefined> {
    const [updatedPayment] = await db
      .update(payments)
      .set(updates as any)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))
      .returning();
    return updatedPayment;
  }

  static async getHistoryByTenant(tenantId: string, limit = 50): Promise<Array<typeof payments.$inferSelect>> {
    return db
      .select(safeColumns)
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt))
      .limit(limit) as any;
  }

  static async getBySubscription(subscriptionId: string): Promise<Array<typeof payments.$inferSelect>> {
    return db
      .select(safeColumns)
      .from(payments)
      .where(eq(payments.subscriptionId, subscriptionId))
      .orderBy(desc(payments.createdAt)) as any;
  }

  static async getFailedByTenant(tenantId: string, limit = 10): Promise<Array<typeof payments.$inferSelect>> {
    return db
      .select(safeColumns)
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.status, 'failed')))
      .orderBy(desc(payments.createdAt))
      .limit(limit) as any;
  }
}
