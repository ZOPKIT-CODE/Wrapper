/**
 * Payment Gateway Adapters — Barrel Export
 *
 * Usage:
 *   import { getPaymentGateway } from '../adapters/index.js';
 *   import type { PaymentGatewayPort, CreateCheckoutParams } from '../adapters/index.js';
 */

// Factory (primary API)
export { getPaymentGateway, setPaymentGateway, resetPaymentGateway } from './payment-gateway.factory.js';

// Port interface
export type { PaymentGatewayPort } from './payment-gateway.port.js';

// Concrete adapters (for direct instantiation / testing)
export { StripePaymentGateway } from './stripe.adapter.js';
export { RazorpayPaymentGateway } from './razorpay.adapter.js';
export { MockPaymentGateway } from './mock.adapter.js';

// Shared types
export type {
  PaymentGatewayProvider,
  CreateCheckoutParams,
  CheckoutLineItem,
  CheckoutResult,
  BillingPortalParams,
  NormalizedWebhookEvent,
  NormalizedEventType,
  CreateRefundParams,
  RefundResult,
  GatewaySubscription,
  GatewaySubscriptionItem,
  UpdateSubscriptionParams,
  CancelSubscriptionParams,
  GatewayCustomer,
  GatewayCheckoutSession,
  GatewayInvoice,
  GatewayConfigStatus,
} from './types.js';
