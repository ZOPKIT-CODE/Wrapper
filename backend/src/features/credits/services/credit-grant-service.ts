import { systemDbConnection } from '../../../db/index.js';
import { credits, creditTransactions } from '../../../db/schema/index.js';
import { and, eq, sql } from 'drizzle-orm';
import { PermissionMatrixUtils } from '../../../data/permission-matrix.js';
import Logger from '../../../utils/logger.js';

const FALLBACK_FREE_CREDITS = 1000;

export async function ensureFreeTierCreditsForTenant(
  tenantId: string,
  entityId: string,
  planId: string,
): Promise<{ credited: boolean; amount: number }> {
  const planCredits = PermissionMatrixUtils.getPlanCredits(planId);
  const amount = planId === 'free'
    ? FALLBACK_FREE_CREDITS
    : (planCredits?.free ?? FALLBACK_FREE_CREDITS);

  const [existing] = await systemDbConnection
    .select({ creditId: credits.creditId, balance: credits.availableCredits })
    .from(credits)
    .where(and(eq(credits.tenantId, tenantId), eq(credits.entityId, entityId)))
    .limit(1);

  if (existing) {
    return { credited: false, amount: Number(existing.balance) };
  }

  await systemDbConnection.insert(credits).values({
    tenantId,
    entityId,
    availableCredits: String(amount),
    isActive: true,
  });

  await systemDbConnection.insert(creditTransactions).values({
    tenantId,
    entityId,
    transactionType: 'allocation',
    amount: String(amount),
    previousBalance: '0',
    newBalance: String(amount),
    operationCode: 'onboarding.grant',
    initiatedBy: null,
  });

  Logger.log('info', 'billing', 'ensureFreeTierCreditsForTenant', 'Granted free-tier credits', { tenantId, entityId, planId, amount });
  return { credited: true, amount };
}

/**
 * Reconciler: find every tenant with an active subscription but no credits row,
 * and back-fill the grant. Safe to run as a daily cron. Returns the count of
 * tenants repaired.
 */
export async function reconcileMissingCreditGrants(): Promise<{ repaired: number }> {
  const orphans = await systemDbConnection.execute(sql`
    SELECT s.tenant_id, e.entity_id, s.plan
    FROM subscriptions s
    JOIN entities e
      ON e.tenant_id = s.tenant_id
     AND e.parent_entity_id IS NULL
     AND e.is_active = true
    LEFT JOIN credits c
      ON c.tenant_id = s.tenant_id
     AND c.entity_id = e.entity_id
    WHERE s.status IN ('active', 'trialing')
      AND c.credit_id IS NULL
  `);

  const rows = (orphans as unknown as { rows?: Array<{ tenant_id: string; entity_id: string; plan: string }> }).rows
    ?? (orphans as unknown as Array<{ tenant_id: string; entity_id: string; plan: string }>);

  let repaired = 0;
  for (const row of rows ?? []) {
    try {
      const result = await ensureFreeTierCreditsForTenant(row.tenant_id, row.entity_id, row.plan ?? 'free');
      if (result.credited) repaired += 1;
    } catch (err) {
      Logger.log('warning', 'billing', 'reconcileMissingCreditGrants', 'Skipping tenant due to error', { tenantId: row.tenant_id, error: (err as Error).message });
    }
  }
  Logger.log('info', 'billing', 'reconcileMissingCreditGrants', 'Reconciliation complete', { repaired });
  return { repaired };
}
