import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../db/index.js';
import * as Sentry from '@sentry/node';
import { payments } from '../../../db/schema/billing/subscriptions.js';
import { eq, desc, and } from 'drizzle-orm';
import { PaymentRepository } from './payment-repository.js';
import { getPaymentGateway } from '../adapters/index.js';

type PaymentData = Record<string, unknown> & {
  tenantId: string;
  subscriptionId?: string;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  stripeChargeId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  amount: string | number;
  currency?: string;
  status: string;
  paymentMethod?: string;
  paymentMethodDetails?: Record<string, unknown>;
  paymentType?: string;
  billingReason?: string;
  invoiceNumber?: string;
  description?: string;
  prorationAmount?: string;
  creditAmount?: string;
  taxAmount?: string;
  taxRate?: string;
  taxRegion?: string;
  processingFees?: string;
  netAmount?: string;
  riskLevel?: string;
  riskScore?: number;
  fraudDetails?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  stripeRawData?: Record<string, unknown>;
  paidAt?: Date;
};

/**
 * Normalize Stripe/gateway payment statuses to DB-allowed values.
 * DB constraint chk_payment_status allows: pending, completed, failed, refunded, processing, cancelled
 */
function normalizePaymentStatus(status: string): string {
  switch (status) {
    case 'succeeded':
    case 'paid':
      return 'completed';
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return 'pending';
    case 'canceled':
      return 'cancelled';
    default:
      // pending, completed, failed, refunded, processing, cancelled pass through
      return status;
  }
}

export class PaymentService {
  // Record a comprehensive payment transaction
  static async recordPayment(paymentData: PaymentData) {
    try {
      // Only pass fields that exist in the payments table schema.
      // stripeCustomerId and stripeSubscriptionId are NOT columns —
      // they should be stored in metadata if needed.
      const payment = await PaymentRepository.create({
        tenantId: paymentData.tenantId,
        subscriptionId: paymentData.subscriptionId,
        stripePaymentIntentId: paymentData.stripePaymentIntentId,
        stripeInvoiceId: paymentData.stripeInvoiceId,
        stripeChargeId: paymentData.stripeChargeId,
        amount: String(paymentData.amount),
        currency: paymentData.currency || 'USD',
        status: normalizePaymentStatus(paymentData.status),
        paymentMethod: paymentData.paymentMethod,
        paymentMethodDetails: (paymentData.paymentMethodDetails || {}) as Record<string, unknown>,
        paymentType: paymentData.paymentType || 'subscription',
        billingReason: paymentData.billingReason,
        invoiceNumber: paymentData.invoiceNumber,
        description: paymentData.description,
        taxAmount: paymentData.taxAmount || '0',
        metadata: (paymentData.metadata || {}) as Record<string, unknown>,
        stripeRawData: (paymentData.stripeRawData || {}) as Record<string, unknown>,
        paidAt: paymentData.paidAt || new Date(),
      });

      console.log('✅ Payment recorded:', payment.paymentId);
      return payment;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to record payment:', error);
      Sentry.withScope((scope) => {
        scope.setTag('payment.operation', 'recordPayment');
        scope.setTag('payment.status', paymentData.status);
        scope.setContext('payment', {
          tenantId: paymentData.tenantId,
          amount: paymentData.amount,
          paymentType: paymentData.paymentType,
          stripePaymentIntentId: paymentData.stripePaymentIntentId,
        });
        Sentry.captureException(error);
      });
      throw error;
    }
  }

  // Get payment by Stripe payment intent ID
  static async getPaymentByIntentId(paymentIntentId: string) {
    try {
      return PaymentRepository.getByPaymentIntentId(paymentIntentId);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get payment by intent ID:', error);
      throw error;
    }
  }

  // Update payment status with comprehensive metadata
  static async updatePaymentStatus(paymentIntentId: string, status: string, metadata: Record<string, unknown> = {}) {
    try {
      const normalized = normalizePaymentStatus(status);
      return PaymentRepository.updateByPaymentIntentId(paymentIntentId, {
        status: normalized,
        metadata,
        updatedAt: new Date(),
        ...((status === 'succeeded' || normalized === 'completed') && { paidAt: new Date() }),
        ...(normalized === 'failed' && { failedAt: new Date() }),
        ...(normalized === 'refunded' && { refundedAt: new Date() }),
        ...(status === 'disputed' && { disputedAt: new Date() }),
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to update payment status:', error);
      Sentry.captureException(error, { tags: { 'payment.operation': 'updateStatus', 'payment.new_status': status } });
      throw error;
    }
  }

  // Get comprehensive payment history for a tenant
  static async getPaymentHistory(tenantId: string, limit = 50) {
    try {
      return PaymentRepository.getHistoryByTenant(tenantId, limit);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get payment history:', error);
      throw error;
    }
  }

  // Record a comprehensive refund — atomic: both the status update and refund record succeed or neither does.
  static async recordRefund(originalPaymentId: string, refundAmount: string | number, reason?: string) {
    try {
      // Use explicit columns to avoid "column does not exist" when DB is behind Drizzle schema
      const [originalPayment] = await db
        .select({
          paymentId: payments.paymentId,
          tenantId: payments.tenantId,
          subscriptionId: payments.subscriptionId,
          stripeChargeId: payments.stripeChargeId,
          amount: payments.amount,
          currency: payments.currency,
          metadata: payments.metadata,
          amountRefunded: payments.amountRefunded,
        })
        .from(payments)
        .where(eq(payments.paymentId, originalPaymentId))
        .limit(1);

      if (!originalPayment) {
        throw new Error('Original payment not found');
      }

      const totalPreviousRefunds = parseFloat(String(originalPayment.amountRefunded ?? '0'));
      const newRefundAmount = parseFloat(String(refundAmount));
      const originalAmount = parseFloat(String(originalPayment.amount));

      if (newRefundAmount + totalPreviousRefunds > originalAmount) {
        throw new Error('Refund amount exceeds original payment amount');
      }

      const totalRefunded = newRefundAmount + totalPreviousRefunds;
      const isPartialRefund = totalRefunded < originalAmount;

      const result = await db.transaction(async (tx) => {
        const [updatedPayment] = await tx
          .update(payments)
          .set({
            amountRefunded: String(totalRefunded),
            status: isPartialRefund ? 'partially_refunded' : 'refunded',
            refundReason: reason,
            isPartialRefund,
            refundedAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              ...(originalPayment.metadata as Record<string, unknown> || {}),
              refund: {
                amount: refundAmount,
                reason: reason,
                processed_at: new Date().toISOString(),
                is_partial: isPartialRefund
              }
            }
          } as any)
          .where(eq(payments.paymentId, originalPaymentId))
          .returning();

        const [refundRecord] = await tx.insert(payments).values({
          tenantId: originalPayment.tenantId,
          subscriptionId: originalPayment.subscriptionId,
          stripeChargeId: originalPayment.stripeChargeId,
          amount: (-parseFloat(String(refundAmount))).toString(),
          currency: originalPayment.currency,
          status: 'succeeded',
          paymentType: 'refund',
          billingReason: 'refund',
          description: `Refund for ${reason || 'customer request'}`,
          metadata: {
            originalPaymentId: originalPaymentId,
            refundReason: reason,
            isPartialRefund
          },
          paidAt: new Date()
        } as any).returning();

        return { updatedPayment, refundRecord };
      });

      return result;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to record refund:', error);
      Sentry.withScope((scope) => {
        scope.setTag('payment.operation', 'recordRefund');
        scope.setContext('refund', { originalPaymentId, refundAmount, reason });
        Sentry.captureException(error);
      });
      throw error;
    }
  }

  // Get payment statistics for a tenant
  static async getPaymentStats(tenantId: string) {
    try {
      const paymentHistory = await this.getPaymentHistory(tenantId);
      
      const stats = {
        totalPaid: 0,
        totalRefunded: 0,
        successfulPayments: 0,
        failedPayments: 0,
        lastPayment: null as Record<string, unknown> | null,
        monthlySpend: 0,
        averageTransactionValue: 0,
        disputeCount: 0,
        processingFees: 0
      };

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      paymentHistory.forEach((payment: any) => {
        const amount = parseFloat(String(payment.amount));
        const paidAt = payment.paidAt ?? null;

        if (payment.status === 'succeeded' && payment.paymentType !== 'refund') {
          stats.totalPaid += amount;
          stats.successfulPayments++;

          if (!stats.lastPayment || (paidAt && (stats.lastPayment as any).paidAt && paidAt > (stats.lastPayment as any).paidAt)) {
            stats.lastPayment = payment as any;
          }

          // Calculate monthly spend
          if (paidAt && paidAt >= currentMonth) {
            stats.monthlySpend += amount;
          }

          // Add processing fees
          if ((payment as any).processingFees) {
            stats.processingFees += parseFloat(String((payment as any).processingFees));
          }
        } else if (payment.status === 'failed') {
          stats.failedPayments++;
        }

        // Count refunds
        if ((payment as any).amountRefunded && parseFloat(String((payment as any).amountRefunded)) > 0) {
          stats.totalRefunded += parseFloat(String((payment as any).amountRefunded));
        }

        // Count disputes
        if (payment.status === 'disputed' || (payment as any).stripeDisputeId) {
          stats.disputeCount++;
        }
      });

      // Calculate average transaction value
      if (stats.successfulPayments > 0) {
        stats.averageTransactionValue = stats.totalPaid / stats.successfulPayments;
      }

      return stats;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get payment stats:', error);
      throw error;
    }
  }

  // Get payment methods from payment history (since we removed the separate table)
  static async getPaymentMethods(tenantId: string) {
    try {
      // Get unique payment methods from successful payments
      const uniquePaymentMethods = await db
        .select({
          paymentMethod: payments.paymentMethod,
          paymentMethodDetails: payments.paymentMethodDetails,
          lastUsed: payments.paidAt,
          count: payments.paymentId
        })
        .from(payments)
        .where(and(
          eq(payments.tenantId, tenantId),
          eq(payments.status, 'succeeded')
        ))
        .orderBy(desc(payments.paidAt));

      // Group by payment method and get the most recent details
      const methodsMap = new Map<string, { type: string; details: unknown; lastUsed: Date | null; isActive: boolean }>();

      uniquePaymentMethods.forEach(payment => {
        const method = payment.paymentMethod ?? 'unknown';
        const entry = methodsMap.get(method);
        if (!entry || (payment.lastUsed != null && (entry.lastUsed == null || payment.lastUsed > entry.lastUsed))) {
          methodsMap.set(method, {
            type: method,
            details: payment.paymentMethodDetails,
            lastUsed: payment.lastUsed,
            isActive: true
          });
        }
      });

      return Array.from(methodsMap.values());
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get payment methods:', error);
      throw error;
    }
  }

  // Record dispute information
  static async recordDispute(paymentId: string, disputeData: Record<string, unknown> & { disputeId?: string; amount: string | number; reason?: string; status?: string; currency?: string; evidenceDueBy?: string; hasEvidence?: boolean }) {
    try {
      const [updatedPayment] = await db
        .update(payments)
        .set({
          status: 'disputed',
          stripeDisputeId: (disputeData.disputeId as string) ?? undefined,
          amountDisputed: String(disputeData.amount),
          updatedAt: new Date(),
          disputeReason: disputeData.reason,
          disputeStatus: disputeData.status,
          disputedAt: new Date(),
          metadata: {
            dispute: {
              id: disputeData.disputeId,
              reason: disputeData.reason,
              status: disputeData.status,
              amount: disputeData.amount,
              currency: disputeData.currency,
              evidence_due_by: disputeData.evidenceDueBy,
              has_evidence: disputeData.hasEvidence || false
            }
          }
        } as any)
        .where(eq(payments.paymentId, paymentId))
        .returning();

      return updatedPayment;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to record dispute:', error);
      throw error;
    }
  }

  // Get payments by subscription
  static async getPaymentsBySubscription(subscriptionId: string) {
    try {
      return PaymentRepository.getBySubscription(subscriptionId);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get subscription payments:', error);
      throw error;
    }
  }

  // Get failed payments for retry
  static async getFailedPayments(tenantId: string, limit = 10) {
    try {
      return PaymentRepository.getFailedByTenant(tenantId, limit);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get failed payments:', error);
      throw error;
    }
  }

  // Create a full payment record (used by webhook handler and plan-change service)
  static async createPaymentRecord(paymentData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const paymentRecord = {
        paymentId: uuidv4(),
        tenantId: paymentData.tenantId as string,
        subscriptionId: paymentData.subscriptionId as string | undefined,
        stripePaymentIntentId: paymentData.stripePaymentIntentId,
        stripeInvoiceId: paymentData.stripeInvoiceId,
        stripeChargeId: paymentData.stripeChargeId,
        amount: String(paymentData.amount ?? 0),
        currency: String(paymentData.currency ?? 'USD').toUpperCase(),
        status: normalizePaymentStatus(paymentData.status as string),
        paymentMethod: paymentData.paymentMethod || 'card',
        paymentMethodDetails: paymentData.paymentMethodDetails || {},
        paymentType: paymentData.paymentType || 'subscription',
        billingReason: paymentData.billingReason,
        invoiceNumber: paymentData.invoiceNumber,
        description: paymentData.description,
        taxAmount: paymentData.taxAmount?.toString() || '0',
        metadata: paymentData.metadata || {},
        stripeRawData: paymentData.stripeRawData || {},
        provider: paymentData.provider || getPaymentGateway().providerName,
        paidAt: paymentData.paidAt || new Date(),
        createdAt: new Date(),
      };

      const [payment] = await db.insert(payments).values(paymentRecord as any).returning();
      console.log('✅ Payment record created:', payment.paymentId);
      return payment as unknown as Record<string, unknown>;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to create payment record:', error);
      Sentry.withScope((scope) => {
        scope.setTag('payment.operation', 'createPaymentRecord');
        scope.setContext('payment', {
          tenantId: paymentData.tenantId,
          amount: paymentData.amount,
          paymentType: paymentData.paymentType,
          status: paymentData.status,
        });
        Sentry.captureException(error);
      });
      throw error;
    }
  }

  // Process an immediate refund via the payment gateway, then record it atomically.
  static async processRefund(params: { tenantId: string; paymentId: string; amount?: number | null; reason?: string }): Promise<Record<string, unknown>> {
    const { tenantId, paymentId, amount = null, reason = 'customer_request' } = params;
    const gateway = getPaymentGateway();

    try {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentId, paymentId))
        .limit(1);

      if (!payment) throw new Error('Payment not found');
      if (payment.tenantId !== tenantId) throw new Error('Payment does not belong to this tenant');

      const refundAmount = amount ?? parseFloat(payment.amount);
      const isPartialRefund = amount != null && amount < parseFloat(payment.amount);

      let gatewayRefund: { refundId?: string; paymentIntentId?: string; chargeId?: string } | null = null;

      if ((payment.stripePaymentIntentId || payment.stripeChargeId) && gateway.isConfigured()) {
        gatewayRefund = await gateway.createRefund({
          paymentIntentId: payment.stripePaymentIntentId ?? undefined,
          chargeId: payment.stripeChargeId ?? undefined,
          amount: Math.round(refundAmount * 100),
          reason,
          metadata: { tenantId, paymentId, reason },
        });
        console.log('✅ Gateway refund created:', gatewayRefund.refundId, '(provider:', gateway.providerName + ')');
      }

      await db.transaction(async (tx) => {
        await tx.update(payments).set({
          status: isPartialRefund ? 'partially_refunded' : 'refunded',
          updatedAt: new Date(),
          metadata: {
            ...(payment.metadata as Record<string, unknown> || {}),
            amountRefunded: refundAmount,
            refundReason: reason,
            gatewayRefundId: gatewayRefund?.refundId,
            provider: gateway.providerName,
          }
        } as any).where(eq(payments.paymentId, paymentId));

        await tx.insert(payments).values({
          tenantId,
          subscriptionId: payment.subscriptionId,
          stripePaymentIntentId: gatewayRefund?.paymentIntentId ?? null,
          stripeChargeId: gatewayRefund?.chargeId ?? null,
          amount: String(-refundAmount),
          currency: payment.currency,
          status: 'succeeded',
          paymentType: 'refund',
          billingReason: 'refund_request',
          description: `Refund for ${reason}`,
          metadata: { originalPaymentId: paymentId, refundReason: reason, isPartialRefund, provider: gateway.providerName },
          stripeRawData: gatewayRefund || {},
        } as any);
      });

      return { refundId: gatewayRefund?.refundId, amount: refundAmount, currency: payment.currency, status: 'succeeded', isPartialRefund, provider: gateway.providerName };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Refund processing failed:', error);
      Sentry.withScope((scope) => {
        scope.setTag('payment.operation', 'processRefund');
        scope.setContext('refund', { tenantId, paymentId, amount, reason });
        Sentry.captureException(error);
      });
      throw error;
    }
  }

  // Retrieve payment details from a checkout session ID via the gateway adapter.
  static async getPaymentDetailsByCheckoutSessionId(sessionId: string, tenantId: string): Promise<Record<string, unknown> | null> {
    const gateway = getPaymentGateway();
    if (!gateway.isConfigured()) return null;

    try {
      const session = await gateway.retrieveCheckoutSession(sessionId, ['subscription']);
      const meta = session.metadata || {};
      if (meta.tenantId !== tenantId) return null;

      const planId = meta.planId || meta.packageId || 'starter';
      const billingCycle = meta.billingCycle || 'yearly';

      const { PLAN_ACCESS_MATRIX } = await import('../../../data/permission-matrix.js');
      const planAccess = (PLAN_ACCESS_MATRIX as Record<string, any>)[planId];
      const planDetails = planAccess ? {
        name: planId.charAt(0).toUpperCase() + planId.slice(1),
        features: [
          ...(planAccess.applications?.includes('crm') ? ['CRM Suite'] : []),
          ...(planAccess.applications?.includes('hr') ? ['HR Management'] : []),
          `${planAccess.credits?.free || 0} Free Credits`,
        ],
        credits: planAccess.credits?.free || 0,
      } : null;

      const amount = session.amountTotal ? session.amountTotal / 100 : 0;
      const status = session.paymentStatus === 'paid' ? 'succeeded' : (session.paymentStatus || 'pending');
      const sessionCreatedAt = session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString();

      const sub = session.subscription as Record<string, unknown> | null | undefined;
      const subPeriodEnd = sub?.currentPeriodEnd as string | undefined || sub?.current_period_end as string | undefined;
      const renewalDate = subPeriodEnd ? (typeof subPeriodEnd === 'number' ? new Date(subPeriodEnd * 1000).toISOString() : subPeriodEnd) : null;
      const subPeriodStart = sub?.currentPeriodStart as string | undefined || sub?.current_period_start as string | undefined;
      const periodStart = subPeriodStart ? (typeof subPeriodStart === 'number' ? new Date((subPeriodStart as unknown as number) * 1000).toISOString() : subPeriodStart) : null;

      const sessionAny = session as unknown as Record<string, unknown>;
      const stripePaymentIntentId = sessionAny.paymentIntentId as string | undefined;

      return {
        success: true,
        data: {
          sessionId: session.id,
          transactionId: stripePaymentIntentId || session.id,
          stripePaymentIntentId: stripePaymentIntentId || null,
          stripeInvoiceId: sessionAny.stripeInvoiceId as string | null || null,
          invoiceNumber: null,
          amount,
          currency: (session.currency || 'usd').toUpperCase(),
          taxAmount: 0,
          planId,
          planName: planDetails?.name || planId,
          billingCycle,
          paymentMethod: 'card',
          paymentMethodDetails: null,
          status,
          createdAt: sessionCreatedAt,
          paidAt: session.paymentStatus === 'paid' ? sessionCreatedAt : null,
          processedAt: session.paymentStatus === 'paid' ? sessionCreatedAt : null,
          description: `Subscription: ${planDetails?.name || planId}`,
          subscription: (renewalDate || periodStart) ? { status: 'active', currentPeriodStart: periodStart, currentPeriodEnd: renewalDate, nextBillingDate: renewalDate, renewalDate } : null,
          features: planDetails?.features || [],
          credits: planDetails?.credits || 0,
          provider: gateway.providerName,
        },
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('getPaymentDetailsByCheckoutSessionId:', error?.message);
      return null;
    }
  }
} 