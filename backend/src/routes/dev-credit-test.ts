/**
 * Dev-only credit testing routes.
 * Registered ONLY when NODE_ENV !== 'production'.
 *
 * These routes let you test the full credit expiry lifecycle in minutes
 * rather than waiting days or months for real expiry dates to pass.
 *
 * All routes require authentication. Use your normal dev login.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { creditBatches, subscriptions, tenants } from '../db/schema/index.js';
import { authenticateToken } from '../middleware/auth/auth.js';
import { CreditExpiryService } from '../features/credits/services/credit-expiry-service.js';
import { addCreditsToEntity } from '../features/credits/services/credit-operations.js';
import { SeasonalCreditService } from '../features/admin/services/SeasonalCreditService.js';

export default async function devCreditTestRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // ── Safety guard ─────────────────────────────────────────────────────────
  fastify.addHook('onRequest', async (_req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send({ error: 'Not found' });
    }
  });

  // ── GET /api/dev/credits/batches ──────────────────────────────────────────
  // List all credit batches for your tenant so you can grab allocationIds.
  fastify.get('/batches', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.userContext as { tenantId?: string | null }).tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'No tenantId on session' });

    const batches = await db
      .select()
      .from(creditBatches)
      .where(eq(creditBatches.tenantId, tenantId))
      .orderBy(creditBatches.allocatedAt);

    return reply.send({ success: true, data: batches });
  });

  // ── POST /api/dev/credits/seed ────────────────────────────────────────────
  // Quickly seed one batch of each type with short expiry so you can test FIFO
  // and expiry without going through the admin UI.
  //
  // Body: { entityId: string, minutesUntilSeasonalExpiry?: number (default 2) }
  fastify.post('/seed', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.userContext as { tenantId?: string | null }).tenantId;
    // DB columns (e.g. credit_transactions.initiated_by) expect UUID, not Kinde subject (kp_...).
    const initiatedBy =
      (request.userContext as { internalUserId?: string | null }).internalUserId ?? 'system';
    if (!tenantId) return reply.code(400).send({ error: 'No tenantId on session' });

    const body = (request.body as Record<string, unknown>) ?? {};
    const entityId = body.entityId as string;
    if (!entityId) return reply.code(400).send({ error: 'entityId is required' });

    const mins = Number(body.minutesUntilSeasonalExpiry ?? 2);

    const seasonalExpiry = new Date(Date.now() + mins * 60_000);
    const freeExpiry     = new Date(Date.now() + (mins + 5) * 60_000);
    // Paid expiry is tied to the subscription; fall back to +10 min for dev
    const [sub] = await db
      .select({ currentPeriodEnd: subscriptions.currentPeriodEnd })
      .from(subscriptions)
      .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')))
      .limit(1);
    const paidExpiry = sub?.currentPeriodEnd ?? new Date(Date.now() + (mins + 10) * 60_000);

    // Insert credit batches directly so we control creditType + expiresAt.
    // Then call addCreditsToEntity once per batch to bump the balance + write a ledger row.
    const batchDefs = [
      { creditType: 'seasonal' as const, amount: 500, expiresAt: seasonalExpiry },
      { creditType: 'free'     as const, amount: 300, expiresAt: freeExpiry     },
      { creditType: 'paid'     as const, amount: 200, expiresAt: paidExpiry     },
    ];
    for (const b of batchDefs) {
      const [batch] = await db.insert(creditBatches).values({
        tenantId,
        entityId,
        entityType: 'organization',
        creditType: b.creditType,
        allocatedCredits: b.amount.toString(),
        usedCredits: '0',
        expiresAt: b.expiresAt,
        isActive: true,
        isExpired: false,
        distributionStatus: 'completed',
      }).returning({ allocationId: creditBatches.allocationId });

      await addCreditsToEntity({
        tenantId,
        entityId,
        creditAmount: b.amount,
        source: 'dev_seed',
        sourceId: batch.allocationId,
        description: `Dev seed – ${b.creditType}`,
        initiatedBy,
      });
    }

    return reply.send({
      success: true,
      message: `Seeded 500 seasonal (expires in ${mins}m), 300 free (expires in ${mins + 5}m), 200 paid (expires at subscription period end)`,
      expiries: {
        seasonal: seasonalExpiry.toISOString(),
        free:     freeExpiry.toISOString(),
        paid:     paidExpiry.toISOString(),
      },
    });
  });

  // ── POST /api/dev/credits/backdate ────────────────────────────────────────
  // Move a batch's expiresAt into the past so the next cron run will expire it.
  //
  // Body: { allocationId: string, minutesAgo?: number (default 1) }
  fastify.post('/backdate', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.userContext as { tenantId?: string | null }).tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'No tenantId on session' });

    const body = (request.body as Record<string, unknown>) ?? {};
    const allocationId = body.allocationId as string;
    if (!allocationId) return reply.code(400).send({ error: 'allocationId is required' });

    const minutesAgo = Number(body.minutesAgo ?? 1);
    const pastDate = new Date(Date.now() - minutesAgo * 60_000);

    const [row] = await db
      .select({ tenantId: creditBatches.tenantId })
      .from(creditBatches)
      .where(eq(creditBatches.allocationId, allocationId))
      .limit(1);

    if (!row || row.tenantId !== tenantId) {
      return reply.code(404).send({ error: 'Batch not found or does not belong to your tenant' });
    }

    await db
      .update(creditBatches)
      .set({ expiresAt: pastDate, updatedAt: new Date() })
      .where(eq(creditBatches.allocationId, allocationId));

    return reply.send({
      success: true,
      message: `Batch ${allocationId} backdated to ${pastDate.toISOString()} — run /trigger-expiry to process it`,
    });
  });

  // ── POST /api/dev/credits/backdate-subscription ───────────────────────────
  // Move the tenant's active subscription currentPeriodEnd into the past to
  // simulate plan expiry without waiting for Stripe.
  // Automatically calls syncPaidCreditBatchExpiry so paid batches sync instantly.
  //
  // Body: { minutesAgo?: number (default 1) }
  fastify.post('/backdate-subscription', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.userContext as { tenantId?: string | null }).tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'No tenantId on session' });

    const body = (request.body as Record<string, unknown>) ?? {};
    const minutesAgo = Number(body.minutesAgo ?? 1);
    const pastDate = new Date(Date.now() - minutesAgo * 60_000);

    await db
      .update(subscriptions)
      .set({ currentPeriodEnd: pastDate, updatedAt: new Date() })
      .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')));

    await CreditExpiryService.syncPaidCreditBatchExpiry(tenantId, pastDate);

    return reply.send({
      success: true,
      message: `Subscription currentPeriodEnd moved to ${pastDate.toISOString()} and paid credit batches synced — run /trigger-expiry to process`,
    });
  });

  // ── POST /api/dev/credits/trigger-expiry ─────────────────────────────────
  // Immediately run the expiry cron — no waiting for the scheduled job.
  // Returns a full report of what was processed.
  fastify.post('/trigger-expiry', { preHandler: authenticateToken }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await CreditExpiryService.processExpiredCredits();
    return reply.send({ success: true, data: result });
  });

  // ── POST /api/dev/credits/create-campaign ─────────────────────────────────
  // Create a seasonal campaign and immediately distribute it to the current
  // tenant with a short expiry (in minutes) — no waiting for real dates.
  //
  // Body: {
  //   minutesUntilExpiry?: number   (default 2)
  //   creditAmount?:       number   (default 500)
  //   creditType?:         string   (default 'promotional')
  //   campaignName?:       string   (default 'Dev Test Campaign')
  //   targetAllTenants?:   boolean  (default false — targets only your tenant)
  // }
  fastify.post('/create-campaign', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.userContext as { tenantId?: string | null }).tenantId;
    const createdBy = (request.userContext as { internalUserId?: string | null }).internalUserId ?? 'system';
    if (!tenantId) return reply.code(400).send({ error: 'No tenantId on session' });

    const body = (request.body as Record<string, unknown>) ?? {};
    const mins = Number(body.minutesUntilExpiry ?? 2);
    const creditAmount = Number(body.creditAmount ?? 500);
    const creditType = String(body.creditType ?? 'promotional');
    const campaignName = String(body.campaignName ?? `Dev Test Campaign – ${new Date().toISOString()}`);
    const targetAllTenants = Boolean(body.targetAllTenants ?? false);

    const expiresAt = new Date(Date.now() + mins * 60_000);

    // Resolve the real tenantId UUID (in case session only has a short id)
    const [tenantRow] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);
    if (!tenantRow) return reply.code(400).send({ error: 'Tenant not found' });

    const campaign = await SeasonalCreditService.createDistributionCampaign({
      campaignName,
      creditType,
      totalCredits: creditAmount,
      creditsPerTenant: creditAmount,
      distributionMethod: 'equal',
      targetAllTenants,
      targetTenantIds: targetAllTenants ? [] : [tenantRow.tenantId],
      allocationMode: 'primary_org',
      expiresAt,
      sendNotifications: false, // skip noise in dev
      createdBy,
      tenantId, // the admin tenant creating the campaign
    });

    const distribution = await SeasonalCreditService.distributeCreditsToTenants(campaign.campaignId);

    // Fetch the created batch IDs for easy backdating
    const batches = await db
      .select({ allocationId: creditBatches.allocationId, expiresAt: creditBatches.expiresAt })
      .from(creditBatches)
      .where(eq(creditBatches.campaignId, campaign.campaignId));

    return reply.send({
      success: true,
      message: `Campaign created and distributed. Credits expire in ${mins}m (${expiresAt.toISOString()}).`,
      campaign: {
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        creditType: campaign.creditType,
        expiresAt: expiresAt.toISOString(),
      },
      distribution,
      batches,
      nextSteps: [
        `GET  /api/dev/credits/batches                           — verify batch was created`,
        `POST /api/dev/credits/backdate {"allocationId":"<id>"}  — move expiry to the past immediately`,
        `POST /api/dev/credits/trigger-expiry                    — run expiry cron now`,
      ],
    });
  });

  // ── POST /api/dev/credits/trigger-warnings ────────────────────────────────
  // Immediately send expiry warning notifications (default 7 days window).
  // Body: { daysAhead?: number (default 7) }
  fastify.post('/trigger-warnings', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as Record<string, unknown>) ?? {};
    const daysAhead = Number(body.daysAhead ?? 7);
    const result = await CreditExpiryService.sendExpiryWarnings(daysAhead);
    return reply.send({ success: true, data: result });
  });

}
