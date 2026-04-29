/**
 * Dev-only Stripe Test Clock routes.
 * Registered ONLY when NODE_ENV !== 'production'.
 *
 * These routes let you test the full subscription lifecycle (renewal, payment
 * failure, cancellation) in minutes by advancing Stripe Test Clocks. Stripe
 * fires real webhook events for each lifecycle step, so your webhook handler,
 * credit expiry, and downstream SNS notifications are all exercised end-to-end.
 *
 * Workflow:
 *   1. POST /api/dev/test-clocks           → create clock + customer + subscription
 *   2. POST /api/dev/test-clocks/:id/advance → advance time (triggers real webhooks)
 *   3. GET  /api/dev/test-clocks/:id        → check clock status (ready / advancing)
 *   4. DELETE /api/dev/test-clocks/:id      → clean up
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { subscriptions, tenants } from '../db/schema/index.js';
import { authenticateToken } from '../middleware/auth/auth.js';
import { getPaymentGateway } from '../features/subscriptions/adapters/index.js';
import { StripePaymentGateway } from '../features/subscriptions/adapters/stripe.adapter.js';
import { normalizeStripeSubscriptionStatus } from '../features/subscriptions/services/subscription-webhook-handler.js';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  tenantId: z.string().uuid(),
  priceId: z.string().min(1, 'Stripe Price ID is required'),
  customerEmail: z.string().email(),
  customerName: z.string().min(1).max(255).optional(),
  frozenTime: z.string().datetime().optional(),
  name: z.string().max(255).optional(),
});

const advanceSchema = z.object({
  advanceTo: z.string().datetime('Must be ISO-8601 datetime'),
});

// ── Helper ───────────────────────────────────────────────────────────────────

function getStripeAdapter(): StripePaymentGateway {
  const gw = getPaymentGateway();
  if (!(gw instanceof StripePaymentGateway)) {
    throw new Error('Test clocks require the Stripe payment gateway adapter');
  }
  return gw;
}

// ── Routes ───────────────────────────────────────────────────────────────────

export default async function devTestClockRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>,
): Promise<void> {

  // Safety guard — never available in production
  fastify.addHook('onRequest', async (_req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send({ error: 'Not found' });
    }
  });

  // ── POST / — Create test clock + customer + subscription ─────────────────
  fastify.post('/', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createSchema.parse(request.body);
    const stripe = getStripeAdapter();

    // Verify tenant exists
    const [tenant] = await db
      .select({ tenantId: tenants.tenantId, companyName: tenants.companyName })
      .from(tenants)
      .where(eq(tenants.tenantId, body.tenantId))
      .limit(1);
    if (!tenant) {
      return reply.code(404).send({ success: false, error: `Tenant ${body.tenantId} not found` });
    }

    const frozenTime = body.frozenTime
      ? Math.floor(new Date(body.frozenTime).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // 1. Create test clock
    const clock = await stripe.createTestClock(
      frozenTime,
      body.name ?? `Test: ${tenant.companyName ?? body.tenantId}`,
    );

    // 2. Create customer on the clock
    const customer = await stripe.createTestClockCustomer(clock.id, {
      email: body.customerEmail,
      name: body.customerName ?? tenant.companyName ?? undefined,
      metadata: { tenantId: body.tenantId, testClock: clock.id },
    });

    // 3. Create subscription
    const sub = await stripe.createTestClockSubscription(
      customer.id,
      body.priceId,
      { tenantId: body.tenantId, testClock: clock.id },
    );

    // 4. Link to local DB — update tenant's stripe customer ID and upsert subscription
    await db.update(tenants).set({
      stripeCustomerId: customer.id,
      updatedAt: new Date(),
    }).where(eq(tenants.tenantId, body.tenantId));

    // Check if subscription record already exists for this tenant
    const [existingSub] = await db
      .select({ subscriptionId: subscriptions.subscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, body.tenantId))
      .limit(1);

    if (existingSub) {
      await db.update(subscriptions).set({
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customer.id,
        status: normalizeStripeSubscriptionStatus(sub.status),
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        updatedAt: new Date(),
      }).where(eq(subscriptions.subscriptionId, existingSub.subscriptionId));
    }

    return reply.code(201).send({
      success: true,
      data: {
        testClockId: clock.id,
        customerId: customer.id,
        subscriptionId: sub.id,
        subscriptionStatus: sub.status,
        currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        frozenTime: new Date(frozenTime * 1000).toISOString(),
        hint: 'Use POST /api/dev/test-clocks/:testClockId/advance to advance time and trigger Stripe webhooks',
      },
    });
  });

  // ── GET / — List all test clocks ─────────────────────────────────────────
  fastify.get('/', { preHandler: authenticateToken }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const stripe = getStripeAdapter();
    const clocks = await stripe.listTestClocks(20);
    return reply.send({
      success: true,
      data: clocks.data.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        frozenTime: new Date(c.frozen_time * 1000).toISOString(),
        created: new Date(c.created * 1000).toISOString(),
        livemode: c.livemode,
      })),
    });
  });

  // ── GET /:testClockId — Get test clock status ────────────────────────────
  fastify.get('/:testClockId', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { testClockId } = request.params as { testClockId: string };
    const stripe = getStripeAdapter();
    const clock = await stripe.retrieveTestClock(testClockId);
    return reply.send({
      success: true,
      data: {
        id: clock.id,
        name: clock.name,
        status: clock.status, // 'ready' | 'advancing' | 'internal_failure'
        frozenTime: new Date(clock.frozen_time * 1000).toISOString(),
        created: new Date(clock.created * 1000).toISOString(),
        hint: clock.status === 'advancing'
          ? 'Clock is advancing — Stripe is firing webhooks. Poll this endpoint until status is "ready".'
          : clock.status === 'ready'
            ? 'Clock is ready. Webhooks have been delivered. Check your subscription and credit state.'
            : 'Clock encountered an error. Create a new one.',
      },
    });
  });

  // ── POST /:testClockId/advance — Advance test clock ──────────────────────
  fastify.post('/:testClockId/advance', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { testClockId } = request.params as { testClockId: string };
    const body = advanceSchema.parse(request.body);
    const stripe = getStripeAdapter();

    const advanceTo = Math.floor(new Date(body.advanceTo).getTime() / 1000);
    const clock = await stripe.advanceTestClock(testClockId, advanceTo);

    return reply.send({
      success: true,
      data: {
        id: clock.id,
        status: clock.status,
        frozenTime: new Date(clock.frozen_time * 1000).toISOString(),
        advancedTo: body.advanceTo,
        hint: 'Clock is now advancing. Stripe will fire webhook events asynchronously. '
            + 'Poll GET /api/dev/test-clocks/:testClockId until status is "ready". '
            + 'Then check subscription status, credit batches, and downstream app events.',
      },
    });
  });

  // ── POST /:testClockId/cancel — Cancel subscription at period end ────────
  fastify.post('/:testClockId/cancel', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { testClockId } = request.params as { testClockId: string };
    const stripe = getStripeAdapter();

    // Retrieve the clock to find the associated Stripe subscription
    const clock = await stripe.retrieveTestClock(testClockId);
    const clockCustomers = (clock as unknown as { customers?: string[] }).customers ?? [];

    // Find local subscription linked to this clock's customer
    let sub: { subscriptionId: string; tenantId: string; stripeSubscriptionId: string | null; status: string; plan: string; currentPeriodEnd: Date | null } | undefined;

    // Try matching by customer IDs from the clock, or fall back to metadata scan
    const [metaSub] = await db
      .select({
        subscriptionId: subscriptions.subscriptionId,
        tenantId: subscriptions.tenantId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        status: subscriptions.status,
        plan: subscriptions.plan,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .limit(1);

    // If there's only one active subscription (test scenario), use it
    sub = metaSub ?? undefined;

    if (!sub?.stripeSubscriptionId) {
      return reply.code(404).send({
        success: false,
        error: 'No active subscription found to cancel',
      });
    }

    // Set cancel_at_period_end on Stripe
    await stripe.updateSubscription(sub.stripeSubscriptionId, {
      cancelAtPeriodEnd: true,
    });

    // Update local DB
    const periodEnd = sub.currentPeriodEnd ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await db
      .update(subscriptions)
      .set({ cancelAt: new Date(periodEnd), updatedAt: new Date() })
      .where(eq(subscriptions.subscriptionId, sub.subscriptionId));

    return reply.send({
      success: true,
      data: {
        subscriptionId: sub.stripeSubscriptionId,
        tenantId: sub.tenantId,
        plan: sub.plan,
        status: 'active',
        cancelAt: new Date(periodEnd).toISOString(),
        message: `Subscription scheduled to cancel at ${new Date(periodEnd).toISOString()}. Advance the test clock past this date to trigger deletion.`,
        nextStep: `POST /api/dev/test-clocks/${testClockId}/advance  { "advanceTo": "${new Date(new Date(periodEnd).getTime() + 24 * 60 * 60 * 1000).toISOString()}" }`,
      },
    });
  });

  // ── GET /:testClockId/subscription — Check subscription state ───────────
  fastify.get('/:testClockId/subscription', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { testClockId } = request.params as { testClockId: string };
    const stripe = getStripeAdapter();

    // Retrieve the Stripe subscription via the gateway
    const clock = await stripe.retrieveTestClock(testClockId);

    // Find local subscription for this tenant
    const [localSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .limit(1);

    // Also try canceled
    const [canceledSub] = !localSub
      ? await db.select().from(subscriptions).where(eq(subscriptions.status, 'canceled')).limit(1)
      : [null];

    const dbSub = localSub ?? canceledSub;
    let stripeSub = null;

    if (dbSub?.stripeSubscriptionId) {
      try {
        stripeSub = await stripe.retrieveSubscription(dbSub.stripeSubscriptionId);
      } catch {
        // Subscription may be deleted in Stripe
        stripeSub = { status: 'deleted' };
      }
    }

    return reply.send({
      success: true,
      data: {
        testClock: {
          id: clock.id,
          status: clock.status,
          frozenTime: new Date(clock.frozen_time * 1000).toISOString(),
        },
        stripe: stripeSub ? {
          id: (stripeSub as Record<string, unknown>).id ?? dbSub?.stripeSubscriptionId,
          status: (stripeSub as Record<string, unknown>).status,
          cancelAtPeriodEnd: (stripeSub as Record<string, unknown>).cancelAtPeriodEnd ?? null,
          currentPeriodEnd: (stripeSub as Record<string, unknown>).currentPeriodEnd
            ? new Date((stripeSub as Record<string, unknown>).currentPeriodEnd as string).toISOString()
            : null,
        } : null,
        local: dbSub ? {
          subscriptionId: dbSub.subscriptionId,
          tenantId: dbSub.tenantId,
          plan: dbSub.plan,
          status: dbSub.status,
          cancelAt: dbSub.cancelAt ? new Date(dbSub.cancelAt).toISOString() : null,
          canceledAt: dbSub.canceledAt ? new Date(dbSub.canceledAt).toISOString() : null,
          currentPeriodEnd: dbSub.currentPeriodEnd ? new Date(dbSub.currentPeriodEnd).toISOString() : null,
        } : null,
      },
    });
  });

  // ── DELETE /:testClockId — Clean up test clock ───────────────────────────
  fastify.delete('/:testClockId', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { testClockId } = request.params as { testClockId: string };
    const stripe = getStripeAdapter();

    await stripe.deleteTestClock(testClockId);

    return reply.send({
      success: true,
      data: { deleted: true, testClockId },
    });
  });
}
