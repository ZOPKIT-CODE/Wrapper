/**
 * Mock Payment Gateway Adapter
 *
 * Used in development / test environments when no real payment provider
 * is configured. Returns plausible mock responses for every operation.
 */

import type { PaymentGatewayPort } from './payment-gateway.port.js';
import Logger from '../../../utils/logger.js';
import type {
  PaymentGatewayProvider,
  CreateCheckoutParams,
  CheckoutResult,
  BillingPortalParams,
  NormalizedWebhookEvent,
  CreateRefundParams,
  RefundResult,
  GatewaySubscription,
  UpdateSubscriptionParams,
  CancelSubscriptionParams,
  GatewayCustomer,
  GatewayCheckoutSession,
  GatewayInvoice,
  GatewayConfigStatus,
} from './types.js';

export class MockPaymentGateway implements PaymentGatewayPort {
  readonly providerName: PaymentGatewayProvider = 'mock';

  isConfigured(): boolean {
    return true;
  }

  getConfigStatus(): GatewayConfigStatus {
    return {
      isConfigured: true,
      provider: 'mock',
      hasSecretKey: false,
      hasWebhookSecret: false,
      environment: process.env.NODE_ENV || 'development',
      details: { note: 'Using mock payment gateway — no real charges will occur' },
    };
  }

  // -----------------------------------------------------------------------
  // Checkout
  // -----------------------------------------------------------------------

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const sessionId = `mock_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const separator = params.successUrl.includes('?') ? '&' : '?';
    const url = `${params.successUrl}${separator}session_id=${sessionId}&mock=true`;

    Logger.log('info', 'general', 'createCheckoutSession', 'Mock checkout session created', { sessionId });
    return { sessionId, url };
  }

  async createBillingPortalSession(params: BillingPortalParams): Promise<string | null> {
    Logger.log('info', 'general', 'createBillingPortalSession', 'Mock billing portal session created', { customerId: params.customerId });
    return `${params.returnUrl}?mock_portal=true`;
  }

  // -----------------------------------------------------------------------
  // Webhooks
  // -----------------------------------------------------------------------

  async verifyWebhook(
    rawBody: Buffer | string,
    _signature: string,
    _secret: string,
  ): Promise<NormalizedWebhookEvent> {
    const parsed = JSON.parse(rawBody.toString());
    return {
      id: parsed.id ?? `mock_evt_${Date.now()}`,
      type: parsed.type ?? 'unknown',
      data: parsed.data?.object ?? parsed.data ?? parsed,
      rawEvent: parsed,
      provider: 'mock',
    };
  }

  // -----------------------------------------------------------------------
  // Refunds
  // -----------------------------------------------------------------------

  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const refundId = `mock_refund_${Date.now()}`;
    Logger.log('info', 'general', 'createRefund', 'Mock refund created', { refundId, amount: params.amount });
    return {
      refundId,
      amount: params.amount,
      currency: 'usd',
      status: 'succeeded',
      paymentIntentId: params.paymentIntentId,
      chargeId: params.chargeId,
    };
  }

  // -----------------------------------------------------------------------
  // Subscription Management
  // -----------------------------------------------------------------------

  async retrieveSubscription(subscriptionId: string): Promise<GatewaySubscription> {
    return {
      id: subscriptionId,
      customerId: 'mock_customer',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: [{ id: 'mock_item_1', priceId: 'mock_price_1' }],
    };
  }

  async updateSubscription(subscriptionId: string, _params: UpdateSubscriptionParams): Promise<GatewaySubscription> {
    Logger.log('info', 'general', 'updateSubscription', 'Mock subscription updated', { subscriptionId });
    return this.retrieveSubscription(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string, _params?: CancelSubscriptionParams): Promise<void> {
    Logger.log('info', 'general', 'cancelSubscription', 'Mock subscription cancelled', { subscriptionId });
  }

  // -----------------------------------------------------------------------
  // Customer
  // -----------------------------------------------------------------------

  async retrieveCustomer(customerId: string): Promise<GatewayCustomer> {
    return {
      id: customerId,
      email: 'mock@example.com',
      name: 'Mock Customer',
      metadata: {},
      deleted: false,
    };
  }

  // -----------------------------------------------------------------------
  // Session / Invoice retrieval
  // -----------------------------------------------------------------------

  async retrieveCheckoutSession(sessionId: string, _expand?: string[]): Promise<GatewayCheckoutSession> {
    return {
      id: sessionId,
      mode: 'subscription',
      paymentStatus: 'paid',
      status: 'complete',
      amountTotal: 0,
      currency: 'usd',
      metadata: {},
      created: Math.floor(Date.now() / 1000),
    };
  }

  async retrieveInvoice(invoiceId: string): Promise<GatewayInvoice> {
    return {
      id: invoiceId,
      customerId: 'mock_customer',
      amountPaid: 0,
      amountDue: 0,
      currency: 'usd',
      status: 'paid',
      lineItems: [],
      rawData: {},
    };
  }
}
