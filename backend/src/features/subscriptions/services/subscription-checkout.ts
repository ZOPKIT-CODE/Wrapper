import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { tenants } from '../../../db/schema/index.js';
import Logger from '../../../utils/logger.js';
import { CreditService } from '../../credits/index.js';
import { getPaymentGateway } from '../adapters/index.js';
import type { CreateCheckoutParams, CheckoutLineItem } from '../adapters/index.js';
import { getAvailablePlans } from './subscription-core.js';
import {
  getAnnualStripePriceId,
  getAnnualAmount,
  type PlanCheckoutCurrency,
  type PlanDefinition,
} from '../../../data/plans.js';

/**
 * Create checkout session (subscription or credit purchase)
 * using the configured payment gateway adapter.
 */
export async function createCheckoutSession(params: {
  tenantId: string;
  planId: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  /** Annual only; ignored if set to monthly ( callers should send yearly ) */
  billingCycle?: string;
  /** Checkout currency — must match a configured Stripe annual price */
  currency?: PlanCheckoutCurrency;
  credits?: number;
}): Promise<string> {
  const {
    tenantId,
    planId,
    customerId,
    customerEmail,
    successUrl,
    cancelUrl,
    currency = 'usd',
    credits,
  } = params;
  const checkoutCurrency: PlanCheckoutCurrency = currency === 'inr' ? 'inr' : 'usd';
  const startTime = Date.now();
  const requestId = Logger.generateRequestId('checkout');
  const gateway = getPaymentGateway();

  const isSubscriptionCheckout = !credits;
  const checkoutType = isSubscriptionCheckout ? 'SUBSCRIPTION CHECKOUT' : 'CREDIT PURCHASE CHECKOUT';

  Logger.billing.start(requestId, checkoutType, {
    tenantId,
    planId,
    customerId,
    customerEmail,
    billingCycle: 'yearly',
    currency: checkoutCurrency,
    credits,
    isSubscriptionCheckout,
    gatewayConfigured: gateway.isConfigured(),
    provider: gateway.providerName,
    environment: process.env.NODE_ENV
  });

  let selectedPlan: Record<string, unknown> | undefined;
  let totalAmount: number = 0;
  let mode: 'subscription' | 'payment';
  let lineItems: CheckoutLineItem[];

  if (isSubscriptionCheckout) {
    const plans = await getAvailablePlans();
    selectedPlan = plans.find(p => p.id === planId);

    if (!selectedPlan) {
      throw new Error('Invalid subscription plan selected');
    }

    totalAmount = getAnnualAmount(selectedPlan as unknown as PlanDefinition, checkoutCurrency);
    mode = 'subscription';

    const priceId = getAnnualStripePriceId(selectedPlan as unknown as PlanDefinition, checkoutCurrency);

    if (!priceId) {
      throw new Error(
        `Stripe annual price ID not configured for ${planId} (${checkoutCurrency.toUpperCase()}). ` +
          'Set STRIPE_*_YEARLY_PRICE_ID (USD) or STRIPE_*_YEARLY_INR_PRICE_ID (INR).'
      );
    }

    lineItems = [{
      priceId: priceId as string,
      quantity: 1,
    }];

    Logger.log('info', 'general', 'createCheckoutSession', 'createCheckoutSession — subscription', {
      planId: selectedPlan.id,
      name: selectedPlan.name,
      price: totalAmount,
      billingCycle: 'yearly',
      currency: checkoutCurrency,
      priceId,
    });
  } else {
    const packages = await CreditService.getAvailablePackages();
    selectedPlan = packages.find(p => p.id === planId);

    if (!selectedPlan) {
      throw new Error('Invalid credit package selected');
    }

    totalAmount = credits!;
    mode = 'payment';

    lineItems = [{
      priceData: {
        currency: selectedPlan.currency ? String(selectedPlan.currency).toLowerCase() : 'usd',
        unitAmount: Math.round(totalAmount * 100),
        productData: {
          name: `$${totalAmount.toFixed(2)} Credit Purchase`,
          description: `Purchase credits worth $${totalAmount.toFixed(2)}`,
        },
      },
      quantity: 1,
    }];

    Logger.log('info', 'general', 'createCheckoutSession', 'createCheckoutSession — credit purchase', {
      packageId: selectedPlan.id,
      dollarAmount: totalAmount,
      currency: selectedPlan.currency,
    });
  }

  // If the gateway isn't configured (e.g. no keys), fall back to mock URL
  if (!gateway.isConfigured()) {
    Logger.log('info', 'general', 'createCheckoutSession', `createCheckoutSession — mock mode for ${checkoutType.toLowerCase()}`);
    const mockSessionId = `mock_${isSubscriptionCheckout ? 'subscription' : 'credit'}_session_${Date.now()}`;
    const mockCheckoutUrl = `${successUrl}?session_id=${mockSessionId}&mock=true&planId=${planId}${isSubscriptionCheckout ? `&billingCycle=yearly&currency=${checkoutCurrency}` : `&credits=${credits}`}`;

    if (!isSubscriptionCheckout) {
      setTimeout(async () => {
        try {
          const estimatedCredits = Math.floor(totalAmount * 1000);
          await CreditService.purchaseCredits({
            tenantId,
            userId: 'mock-user',
            creditAmount: estimatedCredits,
            paymentMethod: gateway.providerName,
            currency: String((selectedPlan as Record<string, unknown>).currency ?? 'USD'),
            notes: `Mock purchase of $${totalAmount.toFixed(2)} worth of credits (${estimatedCredits} credits)`
          });
        } catch (err: unknown) {
          Logger.log('error', 'general', 'createCheckoutSession', 'Mock credit purchase processing error', { error: (err as Error).message });
        }
      }, 2000);
    }

    return mockCheckoutUrl;
  }

  const checkoutParams: CreateCheckoutParams = {
    mode,
    lineItems,
    successUrl,
    cancelUrl,
    customerId,
    customerEmail: customerId ? undefined : customerEmail,
    paymentMethodTypes: ['card'],
    requireBillingAddress: true,
    collectPhoneNumber: true,
    collectTaxId: true,
    metadata: {
      tenantId,
      planId,
      ...(isSubscriptionCheckout
        ? { billingCycle: 'yearly', checkoutCurrency, packageId: planId }
        : { packageId: planId, dollarAmount: String(credits ?? 0), totalAmount: String(totalAmount) }),
    },
  };

  try {
    const result = await gateway.createCheckoutSession(checkoutParams);

    Logger.billing.success(requestId, checkoutType, startTime, {
      sessionId: result.sessionId,
      checkoutUrl: result.url,
      provider: gateway.providerName,
    });

    return result.url;
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    const message = error?.message || String(error);
    Logger.log('error', 'general', 'createCheckoutSession', `Checkout failed (${checkoutType})`, { message });

    const isMissingPrice = error?.code === 'resource_missing' || /no such price/i.test(message);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (isMissingPrice && isDev && isSubscriptionCheckout) {
      const mockSessionId = `mock_subscription_session_${Date.now()}`;
      const mockCheckoutUrl = `${successUrl.replace('{CHECKOUT_SESSION_ID}', mockSessionId)}&mock=true&planId=${planId}&billingCycle=yearly&currency=${checkoutCurrency}`;
      Logger.log('warning', 'general', 'createCheckoutSession', 'Price ID not found — using mock checkout in dev mode');
      return mockCheckoutUrl;
    }

    throw error;
  }
}

/**
 * Handle mock checkout completion for development/testing.
 */
export async function handleMockCheckoutCompleted(params: { tenantId: string; planId: string; billingCycle: string; sessionId: string }): Promise<void> {
  const { tenantId, planId } = params;
  try {
    const packages = await CreditService.getAvailablePackages();
    const selectedPackage = packages.find((p: Record<string, unknown>) => p.id === planId) as Record<string, unknown> | undefined;

    if (!selectedPackage) {
      throw new Error(`Invalid package ID: ${planId}`);
    }

    const gateway = getPaymentGateway();

    await CreditService.purchaseCredits({
      tenantId,
      userId: 'mock-user',
      creditAmount: Number(selectedPackage.credits) || 0,
      paymentMethod: gateway.providerName,
      currency: String(selectedPackage.currency || 'USD'),
      notes: `Mock purchase of ${String(selectedPackage.name || 'package')} package`
    });

    Logger.log('info', 'general', 'handleMockCheckoutCompleted', 'Mock credit purchase processed', { tenantId });
  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'general', 'handleMockCheckoutCompleted', 'Error processing mock credit purchase', { error: error.message });
    throw error;
  }
}

/**
 * Create a Billing Portal session for plan changes.
 * Upgrades must go through the payment provider portal so payment is confirmed.
 */
export async function createBillingPortalSession(tenantId: string, returnUrl?: string): Promise<string | null> {
  const gateway = getPaymentGateway();

  if (!gateway.isConfigured()) {
    throw new Error('Payment gateway is not configured; cannot create billing portal session.');
  }

  const [tenant] = await db
    .select({ stripeCustomerId: tenants.stripeCustomerId })
    .from(tenants)
    .where(eq(tenants.tenantId, tenantId))
    .limit(1);

  const customerId = tenant?.stripeCustomerId;
  if (!customerId) {
    throw new Error('No payment customer linked to this organization. Please subscribe via checkout first.');
  }

  const url = await gateway.createBillingPortalSession({
    customerId,
    returnUrl: returnUrl || `${process.env.FRONTEND_URL || ''}/billing`,
  });

  Logger.log('info', 'general', 'createBillingPortalSession', 'Billing portal session created', { tenantId, provider: gateway.providerName });
  return url;
}
