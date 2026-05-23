// @ts-nocheck — legacy webhook handler; tighten types incrementally
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { db } from '../../../../db/index.js';
import {
  subscriptions,
  payments,
  tenants,
  tenantUsers,
} from '../../../../db/schema/index.js';
import { EmailService } from '../../../../utils/email.js';
import type { RequestContext } from '../../../../services/activityLogger.js';
import { getPaymentGateway } from '../../adapters/index.js';
import Logger from '../../../../utils/logger.js';
import {
  getAvailablePlans,
  getPlanIdFromPriceId,
} from '../subscription-core.js';
import { updateAdministratorRolesForPlan } from '../subscription-plan-roles.js';
import { PaymentService } from '../payment-service.js';
import { safePaymentSelect } from '../webhook-shared.js';

/** Apply invoice payment to a subscription (fallback when lookup by stripeSubscriptionId fails). */
export async function applyInvoicePaymentToSubscription(
  subscriptionRecord: Record<string, unknown>,
  stripeSubscriptionId: string,
  invoice: Record<string, unknown> & {
    lines?: { data?: Array<{ price?: { id?: string } }> };
    billing_reason?: string;
  }
): Promise<void> {
  const linePriceId = invoice.lines?.data?.[0]?.price?.id;
  const planId = linePriceId ? await getPlanIdFromPriceId(linePriceId) : null;
  const setPayload: Record<string, unknown> = {
    stripeSubscriptionId: stripeSubscriptionId,
    status: 'active',
    updatedAt: new Date()
  };
  if (planId) {
    const plans = await getAvailablePlans();
    const plan = plans.find((p: Record<string, unknown>) => p.id === planId) as Record<string, unknown> | undefined;
    if (plan) {
      setPayload.plan = planId;
      setPayload.yearlyPrice = String((plan.yearlyPrice ?? 0) as number);
    }
  }
  await db
    .update(subscriptions)
    .set(setPayload as Record<string, unknown>)
    .where(eq(subscriptions.subscriptionId, (subscriptionRecord.subscriptionId ?? subscriptionRecord.subscription_id) as string));

  if (planId) {
    Logger.log('info', 'billing', 'apply-invoice-payment-to-subscription', 'Triggering role upgrade for plan', { planId });
    await updateAdministratorRolesForPlan(subscriptionRecord.tenantId as string, planId);
    try {
      const onboardingOrgSetup = (await import('../../../onboarding/services/onboarding-organization-setup.js')).default;
      await onboardingOrgSetup.updateOrganizationApplicationsForPlanChange(
        subscriptionRecord.tenantId as string,
        planId,
        { skipIfRecentlyUpdated: true }
      );
    } catch (errOrgApp: unknown) {
      Logger.log('error', 'billing', 'apply-invoice-payment-to-subscription', 'Failed to update organization applications', { error: (errOrgApp as Error).message });
    }
  }
}

// Handle payment succeeded webhook
export async function handlePaymentSucceeded(
  invoice: Record<string, unknown> & {
    id?: string;
    subscription?: string;
    customer?: string;
    amount_paid?: number;
    currency?: string;
    payment_intent?: string;
    billing_reason?: string;
    number?: string;
    tax?: number;
    period_start?: number;
    period_end?: number;
    attempt_count?: number;
    next_payment_attempt?: number;
    status_transitions?: { paid_at?: number };
    lines?: { data?: Array<{ price?: { id?: string } }> };
    payment_method_types?: string[];
    charge?: string;
  }
): Promise<void> {
  try {
    Logger.log('info', 'billing', 'handle-payment-succeeded', 'Processing payment succeeded for invoice', { invoiceId: invoice.id });

    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
        .limit(1);

      if (!subscription) {
        Logger.log('error', 'billing', 'handle-payment-succeeded', 'Subscription not found for payment', { subscriptionId });

        const [fallbackSubscription] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeCustomerId, (invoice.customer ?? '') as string))
          .limit(1);

        if (fallbackSubscription) {
          await applyInvoicePaymentToSubscription(fallbackSubscription as unknown as Record<string, unknown>, subscriptionId, invoice);
          return;
        }

        const [tenantByCustomer] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.stripeCustomerId, (invoice.customer ?? '') as string))
          .limit(1);

        if (tenantByCustomer) {
          const [subByTenant] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.tenantId, tenantByCustomer.tenantId))
            .limit(1);

          if (subByTenant) {
            await applyInvoicePaymentToSubscription(subByTenant as unknown as Record<string, unknown>, subscriptionId, invoice);
            return;
          }
        }

        // Attempt customer lookup via gateway
        const gateway = getPaymentGateway();
        if (gateway.isConfigured() && invoice.customer) {
          try {
            const gatewayCustomer = await gateway.retrieveCustomer(invoice.customer as string);
            const customerEmail = gatewayCustomer.deleted ? null : gatewayCustomer.email;
            if (customerEmail) {
              const [tenantUserByEmail] = await db
                .select()
                .from(tenantUsers)
                .where(eq(tenantUsers.email, customerEmail))
                .limit(1);

              if (tenantUserByEmail) {
                const [subByTenant] = await db
                  .select()
                  .from(subscriptions)
                  .where(eq(subscriptions.tenantId, tenantUserByEmail.tenantId))
                  .limit(1);

                if (subByTenant) {
                  Logger.log('info', 'billing', 'handle-payment-succeeded', 'Found subscription by customer email', { customerEmail });
                  await applyInvoicePaymentToSubscription(subByTenant as unknown as Record<string, unknown>, subscriptionId, invoice);
                  await db
                    .update(tenants)
                    .set({ stripeCustomerId: invoice.customer, updatedAt: new Date() })
                    .where(eq(tenants.tenantId, tenantUserByEmail.tenantId));
                  return;
                }
              }
            }
          } catch (errGw: unknown) {
            Logger.log('warning', 'billing', 'handle-payment-succeeded', 'Gateway customer lookup fallback failed', { error: (errGw as Error)?.message });
          }
        }

        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      // For proration invoices (subscription_update), the first line item is the
      // CREDIT for the old plan and the last line item is the CHARGE for the new plan.
      // Always use the last positive-amount line item to resolve the plan.
      const invoiceLines = ((invoice as Record<string, unknown>).lines as { data?: Array<{ price?: { id?: string }; amount?: number }> })?.data ?? [];
      const chargeLine = [...invoiceLines].reverse().find(l => (l.amount ?? 0) > 0) ?? invoiceLines[0];
      const invoicePriceId = chargeLine?.price?.id ?? null;
      const planId = invoicePriceId ? await getPlanIdFromPriceId(invoicePriceId as string) : null;
      const setPayload: Record<string, unknown> = {
        status: 'active',
        updatedAt: new Date()
      };
      if (planId) {
        const plans = await getAvailablePlans();
        const plan = plans.find((p: Record<string, unknown>) => p.id === planId) as Record<string, unknown> | undefined;
        if (plan) {
          setPayload.plan = planId;
          setPayload.yearlyPrice = String((plan.yearlyPrice ?? 0) as number);
        }
      }
      await db
        .update(subscriptions)
        .set(setPayload as Record<string, unknown>)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

      if (planId) {
        await updateAdministratorRolesForPlan(subscription.tenantId, planId);
        try {
          const onboardingOrgSetup = (await import('../../../onboarding/services/onboarding-organization-setup.js')).default;
          await onboardingOrgSetup.updateOrganizationApplicationsForPlanChange(subscription.tenantId, planId, { skipIfRecentlyUpdated: true });
        } catch (errOrgApp: unknown) {
          Logger.log('error', 'billing', 'handle-payment-succeeded', 'Failed to update organization applications', { error: (errOrgApp as Error).message });
        }
      }

      const amountPaid = (invoice as Record<string, unknown>).amount_paid ?? 0;
      const invoiceTax = (invoice as Record<string, unknown>).tax ?? 0;
      const invoiceCurrency = (invoice as Record<string, unknown>).currency ?? 'USD';
      const paymentIntentId = (invoice as Record<string, unknown>).payment_intent as string | undefined;

      let existingPaymentByIntent: Record<string, unknown> | null = null;
      if (paymentIntentId) {
        const [existing] = await db
          .select(safePaymentSelect)
          .from(payments)
          .where(eq(payments.stripePaymentIntentId, paymentIntentId))
          .limit(1);
        existingPaymentByIntent = (existing as unknown as Record<string, unknown>) || null;
      }

      if (existingPaymentByIntent) {
        const existingMeta = (existingPaymentByIntent.metadata as Record<string, unknown>) || {};
        const existingRaw = (existingPaymentByIntent.stripeRawData as Record<string, unknown>) || {};
        await db
          .update(payments)
          .set({
            tenantId: (subscription as Record<string, unknown>).tenantId,
            subscriptionId: ((subscription as Record<string, unknown>).subscriptionId ?? undefined) as string | undefined,
            stripeInvoiceId: invoice.id as string,
            stripeChargeId: (invoice as Record<string, unknown>).charge as string | undefined,
            amount: String(amountPaid / 100),
            currency: String(invoiceCurrency).toUpperCase(),
            status: 'completed',
            paymentMethod: 'card',
            paymentType: 'subscription',
            billingReason: (invoice as Record<string, unknown>).billing_reason as string | undefined,
            invoiceNumber: (invoice as Record<string, unknown>).number as string | undefined,
            description: `Subscription payment for ${(subscription as Record<string, unknown>).plan as string} plan`,
            taxAmount: String(invoiceTax / 100),
            metadata: {
              ...existingMeta,
              stripeCustomerId: (invoice as Record<string, unknown>).customer,
              billingReason: (invoice as Record<string, unknown>).billing_reason,
              subscriptionPeriod: {
                start: new Date(((invoice as Record<string, unknown>).period_start ?? 0) * 1000),
                end: new Date(((invoice as Record<string, unknown>).period_end ?? 0) * 1000)
              },
              attempt_count: (invoice as Record<string, unknown>).attempt_count,
              nextPaymentAttempt: (invoice as Record<string, unknown>).next_payment_attempt ? new Date((invoice as Record<string, unknown>).next_payment_attempt * 1000) : null
            } as Record<string, unknown>,
            stripeRawData: {
              ...existingRaw,
              invoice
            } as Record<string, unknown>,
            paidAt: new Date(((invoice as Record<string, unknown>).status_transitions?.paid_at ?? 0) * 1000),
            updatedAt: new Date()
          } as Record<string, unknown>)
          .where(eq(payments.paymentId, (existingPaymentByIntent.paymentId as string)));
      } else {
        await PaymentService.createPaymentRecord({
          tenantId: (subscription as Record<string, unknown>).tenantId,
          subscriptionId: ((subscription as Record<string, unknown>).subscriptionId ?? undefined) as string | undefined,
          stripePaymentIntentId: (invoice as Record<string, unknown>).payment_intent,
          stripeInvoiceId: invoice.id,
          stripeChargeId: (invoice as Record<string, unknown>).charge,
          amount: amountPaid / 100,
          currency: String(invoiceCurrency).toUpperCase(),
          status: 'succeeded',
          paymentMethod: 'card',
          paymentType: 'subscription',
          billingReason: (invoice as Record<string, unknown>).billing_reason,
          invoiceNumber: (invoice as Record<string, unknown>).number,
          description: `Subscription payment for ${(subscription as Record<string, unknown>).plan as string} plan`,
          taxAmount: invoiceTax / 100,
          processingFees: 0,
          netAmount: (amountPaid - invoiceTax) / 100,
          paymentMethodDetails: {},
          riskLevel: 'normal',
          metadata: {
            stripeCustomerId: (invoice as Record<string, unknown>).customer,
            billingReason: (invoice as Record<string, unknown>).billing_reason,
            subscriptionPeriod: {
              start: new Date(((invoice as Record<string, unknown>).period_start ?? 0) * 1000),
              end: new Date(((invoice as Record<string, unknown>).period_end ?? 0) * 1000)
            },
            attempt_count: (invoice as Record<string, unknown>).attempt_count,
            nextPaymentAttempt: (invoice as Record<string, unknown>).next_payment_attempt ? new Date((invoice as Record<string, unknown>).next_payment_attempt * 1000) : null
          },
          stripeRawData: invoice,
          paidAt: new Date(((invoice as Record<string, unknown>).status_transitions?.paid_at ?? 0) * 1000)
        });
      }

      Logger.log('info', 'billing', 'handle-payment-succeeded', 'Payment succeeded for tenant', { tenantId: subscription.tenantId, amount: amountPaid / 100 });

      try {
        const ActivityLogger = (await import('../../../../services/activityLogger.js')).default;
        const [tenantUser] = await db
          .select()
          .from(tenantUsers)
          .where(eq(tenantUsers.tenantId, subscription.tenantId))
          .limit(1);

        if (tenantUser) {
          const requestContext: RequestContext = {
            ipAddress: undefined,
            userAgent: 'payment-webhook',
            sessionId: undefined,
            source: 'webhook'
          };

          await ActivityLogger.logActivity(
            tenantUser.userId,
            subscription.tenantId,
            null,
            'payment.topup_success',
            {
              invoiceId: invoice.id,
              subscriptionId: subscription.subscriptionId,
              amount: amountPaid / 100,
              currency: invoiceCurrency,
              paymentMethod: invoice.payment_method_types?.[0] || 'card',
              planId: invoice.lines?.data?.[0]?.price?.id
            },
            requestContext
          );
        }
      } catch (errLog: unknown) {
        Logger.log('warning', 'billing', 'handle-payment-succeeded', 'Failed to log payment success activity', { error: (errLog as Error).message });
      }
    } else {
      Logger.log('warning', 'billing', 'handle-payment-succeeded', 'Payment succeeded but no subscription ID found in invoice', { invoiceId: invoice.id });
    }
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-payment-succeeded', 'Error handling payment succeeded', { error: error.message });
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'payment.succeeded');
      scope.setContext('invoice', { invoiceId: invoice.id, subscriptionId: invoice.subscription, amount: invoice.amount_paid });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle invoice payment paid webhook
export async function handleInvoicePaymentPaid(invoicePayment: Record<string, unknown>): Promise<void> {
  try {
    Logger.log('info', 'billing', 'handle-invoice-payment-paid', 'Processing invoice payment paid', { invoicePaymentId: invoicePayment.id });

    const gateway = getPaymentGateway();

    if (!gateway.isConfigured()) {
      Logger.log('warning', 'billing', 'handle-invoice-payment-paid', 'Gateway not configured — skipping invoice payment processing');
      return;
    }

    try {
      const gatewayInvoice = await gateway.retrieveInvoice(invoicePayment.invoice as string);
      Logger.log('info', 'billing', 'handle-invoice-payment-paid', 'Retrieved invoice', { id: gatewayInvoice.id, customer: gatewayInvoice.customerId, subscription: gatewayInvoice.subscriptionId });

      // Map gateway invoice back to the shape handlePaymentSucceeded expects
      const invoiceObj = gatewayInvoice.rawData as Record<string, unknown>;
      await handlePaymentSucceeded(invoiceObj as Record<string, unknown> & { id?: string; subscription?: string; customer?: string; amount_paid?: number; currency?: string; payment_intent?: string; billing_reason?: string; number?: string; tax?: number; period_start?: number; period_end?: number; attempt_count?: number; next_payment_attempt?: number; status_transitions?: { paid_at?: number }; lines?: { data?: Array<{ price?: { id?: string } }> }; payment_method_types?: string[]; charge?: string });
    } catch (err: unknown) {
      const gwError = err as Error;
      Logger.log('error', 'billing', 'handle-invoice-payment-paid', 'Failed to retrieve invoice', { error: gwError.message });

      const paymentIntent = (invoicePayment as Record<string, unknown>).payment?.payment_intent;
      if (paymentIntent) {
        const [payment] = await db
          .select(safePaymentSelect)
          .from(payments)
          .where(eq(payments.stripePaymentIntentId, paymentIntent as string))
          .limit(1);

        if (payment) {
          const paidAt = (invoicePayment as Record<string, unknown>).status_transitions?.paid_at;
          await db
            .update(payments)
            .set({
              status: 'completed',
              paidAt: paidAt != null ? new Date((paidAt as number) * 1000) : new Date(),
              updatedAt: new Date()
            })
            .where(eq(payments.paymentId, payment.paymentId));
        }
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-invoice-payment-paid', 'Error handling invoice payment paid', { error: error.message });
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'invoice.payment_paid');
      scope.setContext('invoice', { invoiceId: invoicePayment.id });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle payment failed webhook
export async function handlePaymentFailed(invoice: Record<string, unknown>): Promise<void> {
  try {
    Logger.log('info', 'billing', 'handle-payment-failed', 'Processing payment failed for invoice', { invoiceId: invoice.id });

    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId as string))
        .limit(1);

      if (!subscription) {
        Logger.log('error', 'billing', 'handle-payment-failed', 'Subscription not found for failed payment', { subscriptionId });
        return;
      }

      // Atomic: mark subscription as past_due + record the failed payment together.
      const inv = invoice as Record<string, unknown>;
      await db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({ status: 'past_due', updatedAt: new Date() } as Record<string, unknown>)
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId as string));

        await tx.insert(payments).values({
          tenantId: subscription.tenantId,
          subscriptionId: subscription.subscriptionId ?? undefined,
          stripePaymentIntentId: inv.payment_intent as string | undefined,
          stripeInvoiceId: inv.id as string | undefined,
          amount: String(Number(inv.amount_due ?? 0) / 100),
          currency: String(inv.currency ?? 'USD').toUpperCase(),
          status: 'failed',
          paymentMethod: 'card',
          paymentType: 'subscription',
          billingReason: inv.billing_reason as string | undefined,
          invoiceNumber: inv.number as string | undefined,
          description: `Failed subscription payment for ${subscription.plan} plan`,
          metadata: {
            stripeCustomerId: inv.customer,
            failureReason: (inv.last_finalization_error as Error)?.message || 'Payment failed',
            failureCode: (inv.last_finalization_error as Record<string, unknown>)?.code,
            attemptCount: inv.attempt_count,
            nextPaymentAttempt: inv.next_payment_attempt ? new Date((inv.next_payment_attempt as number) * 1000) : null,
            billingReason: inv.billing_reason
          },
          stripeRawData: invoice as Record<string, unknown>,
          paidAt: new Date()
        } as any);
      });

      try {
        const ActivityLogger = (await import('../../../../services/activityLogger.js')).default;
        const [tenantUser] = await db
          .select()
          .from(tenantUsers)
          .where(eq(tenantUsers.tenantId, subscription.tenantId))
          .limit(1);

        if (tenantUser) {
          const requestContext: RequestContext = {
            ipAddress: undefined,
            userAgent: 'payment-webhook',
            sessionId: undefined,
            source: 'webhook'
          };

          await ActivityLogger.logActivity(
            tenantUser.userId,
            subscription.tenantId,
            null,
            'payment.topup_failed',
            {
              invoiceId: invoice.id,
              subscriptionId: subscription.subscriptionId,
              amount: Number((invoice as Record<string, unknown>).amount_due ?? 0) / 100,
              currency: String((invoice as Record<string, unknown>).currency ?? 'USD'),
              failureReason: ((invoice as Record<string, unknown>).last_finalization_error as Error)?.message || 'Payment failed',
              failureCode: ((invoice as Record<string, unknown>).last_finalization_error as Record<string, unknown>)?.code,
              attemptCount: (invoice as Record<string, unknown>).attempt_count,
              nextPaymentAttempt: (invoice as Record<string, unknown>).next_payment_attempt != null ? new Date(Number((invoice as Record<string, unknown>).next_payment_attempt) * 1000) : null
            },
            requestContext
          );
        }
      } catch (errLog: unknown) {
        Logger.log('warning', 'billing', 'handle-payment-failed', 'Failed to log payment failure activity', { error: (errLog as Error).message });
      }

      const emailService = new EmailService();
      await emailService.sendPaymentFailedNotification({
        tenantId: subscription.tenantId,
        amount: (invoice as Record<string, unknown>).amount_due / 100,
        currency: ((invoice as Record<string, unknown>).currency as string).toUpperCase(),
        nextAttempt: (invoice as Record<string, unknown>).next_payment_attempt ? new Date((invoice as Record<string, unknown>).next_payment_attempt * 1000) : undefined,
        failureReason: ((invoice as Record<string, unknown>).last_finalization_error as Error)?.message || 'Payment failed'
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-payment-failed', 'Error handling payment failed', { error: error.message });
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'payment.failed');
      scope.setContext('invoice', { invoiceId: invoice.id, subscriptionId: invoice.subscription });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle charge dispute webhook
export async function handleChargeDispute(
  dispute: Record<string, unknown> & {
    id: string;
    charge: string;
    amount: number;
    reason?: string;
    status?: string;
    currency?: string;
    created?: number;
    evidence_details?: { due_by?: number; has_evidence?: boolean };
  }
): Promise<void> {
  try {
    Logger.log('info', 'billing', 'handle-charge-dispute', 'Processing charge dispute', { disputeId: dispute.id });

    const [payment] = await db
      .select(safePaymentSelect)
      .from(payments)
      .where(eq(payments.stripeChargeId, dispute.charge))
      .limit(1);

    if (!payment) {
      Logger.log('error', 'billing', 'handle-charge-dispute', 'Payment not found for dispute', { charge: dispute.charge });
      return;
    }

    await db
      .update(payments)
      .set({
        status: 'disputed',
        updatedAt: new Date(),
        metadata: {
          ...(payment.metadata as Record<string, unknown> || {}),
          dispute: {
            id: dispute.id,
            reason: dispute.reason,
            status: dispute.status,
            amount: dispute.amount / 100,
            currency: dispute.currency,
            evidence_due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : null,
            has_evidence: dispute.evidence_details?.has_evidence || false
          }
        },
        stripeRawData: {
          ...(payment.stripeRawData as Record<string, unknown> || {}),
          dispute: dispute
        }
      } as Record<string, unknown>)
      .where(eq(payments.paymentId, payment.paymentId));

    const emailServiceDispute = new EmailService();
    await emailServiceDispute.sendDisputeNotification({
      tenantId: payment.tenantId,
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      currency: String(dispute.currency ?? 'USD'),
      reason: dispute.reason ?? '',
      evidenceDueBy: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : undefined
    });

    Logger.log('info', 'billing', 'handle-charge-dispute', 'Dispute recorded for payment', { paymentId: payment.paymentId });
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-charge-dispute', 'Error handling charge dispute', { error: error.message });
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'charge.disputed');
      scope.setContext('dispute', { disputeId: dispute.id, chargeId: dispute.charge, amount: dispute.amount });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle refund webhook
export async function handleRefund(
  refund: Record<string, unknown> & {
    id: string;
    charge: string;
    amount: number;
    reason?: string;
    status?: string;
    currency?: string;
    created?: number;
  }
): Promise<void> {
  const refundCreated = (refund.created ?? 0) as number;
  const refundCurrency = (refund.currency ?? 'USD') as string;
  try {
    Logger.log('info', 'billing', 'handle-refund', 'Processing refund', { refundId: refund.id });

    const [payment] = await db
      .select(safePaymentSelect)
      .from(payments)
      .where(eq(payments.stripeChargeId, refund.charge))
      .limit(1);

    if (!payment) {
      Logger.log('error', 'billing', 'handle-refund', 'Payment not found for refund', { charge: refund.charge });
      return;
    }

    const refundAmount = refund.amount / 100;
    const isPartialRefund = refundAmount < parseFloat(String(payment.amount));

    const existingMeta = (payment.metadata as Record<string, unknown>) || {};

    // Atomic: update original payment + create refund record in one transaction.
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: isPartialRefund ? 'partially_refunded' : 'refunded',
          updatedAt: new Date(),
          metadata: {
            ...existingMeta,
            amountRefunded: refundAmount,
            stripeRefundId: refund.id,
            refund: {
              id: refund.id,
              amount: refundAmount,
              reason: refund.reason,
              status: refund.status,
              created: new Date(refundCreated * 1000)
            }
          }
        } as Record<string, unknown>)
        .where(eq(payments.paymentId, payment.paymentId));

      await tx.insert(payments).values({
        tenantId: payment.tenantId,
        subscriptionId: payment.subscriptionId ?? undefined,
        stripeChargeId: refund.charge,
        amount: String(-refundAmount),
        currency: String(refundCurrency).toUpperCase(),
        status: (refund.status ?? 'succeeded') as string,
        paymentType: 'refund',
        billingReason: 'refund',
        description: `Refund for ${refund.reason || 'customer request'}`,
        metadata: {
          originalPaymentId: payment.paymentId,
          refundReason: refund.reason,
          isPartialRefund
        },
        stripeRawData: refund,
        paidAt: new Date(refundCreated * 1000)
      } as any);
    });

    Logger.log('info', 'billing', 'handle-refund', 'Refund recorded', { refundId: refund.id, amount: refundAmount });
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-refund', 'Error handling refund', { error: error.message });
    Sentry.withScope((scope) => {
      scope.setTag('payment.handler', 'refund.created');
      scope.setContext('refund', { refundId: refund.id, chargeId: refund.charge, amount: refund.amount });
      Sentry.captureException(error);
    });
    throw error;
  }
}

// Handle charge succeeded webhook
export async function handleChargeSucceeded(
  charge: Record<string, unknown> & {
    id: string;
    customer?: string;
    amount: number;
    currency?: string;
    payment_intent?: string;
    payment_method_details?: { type?: string };
    description?: string;
    metadata?: Record<string, unknown>;
    created?: number;
  }
): Promise<void> {
  try {
    Logger.log('info', 'billing', 'handle-charge-succeeded', 'Processing charge succeeded', { chargeId: charge.id });

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, (charge.customer ?? '') as string))
      .limit(1);

    if (subscription) {
      await PaymentService.createPaymentRecord({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.subscriptionId ?? undefined,
        stripeChargeId: charge.id,
        stripePaymentIntentId: charge.payment_intent as string | undefined,
        stripeCustomerId: (charge.customer ?? undefined) as string | undefined,
        amount: (charge.amount / 100).toString(),
        currency: String(charge.currency ?? 'USD').toUpperCase(),
        status: 'succeeded',
        paymentMethod: (charge.payment_method_details as Record<string, unknown>)?.type || 'card',
        paymentType: 'subscription',
        description: (charge.description as string) || 'Subscription payment',
        metadata: (charge.metadata as Record<string, unknown>) || {},
        stripeRawData: charge,
        paidAt: new Date((charge.created ?? 0) * 1000)
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'billing', 'handle-charge-succeeded', 'Error handling charge succeeded', { error: error.message });
    Sentry.captureException(error, { tags: { 'payment.handler': 'charge.succeeded' } });
    throw error;
  }
}
