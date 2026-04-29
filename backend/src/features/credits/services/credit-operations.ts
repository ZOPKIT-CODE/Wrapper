import { db } from '../../../db/index.js';
import {
  credits,
  creditTransactions,
  creditPurchases,
  entities,
  tenants
} from '../../../db/schema/index.js';
import { eq, and, sql, isNotNull, gt, asc } from 'drizzle-orm';
import { getOperationConfig } from './credit-config-global.js';
import { creditBatches } from '../../../db/schema/billing/credit-batches.js';
import { randomUUID } from 'crypto';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';
import { findRootOrganization, ensureCreditRecord, stripe } from './credit-core.js';
import { getEntityBalance, getCurrentBalance } from './credit-balance.js';

/**
 * Initialize credits for a tenant (temporary method for testing)
 */
export async function initializeTenantCredits(
  tenantId: string,
  initialCredits = 1000
): Promise<void> {
  try {
    console.log(`🎯 Initializing ${initialCredits} credits for tenant: ${tenantId}`);

    const rootOrgId = await findRootOrganization(tenantId);
    if (!rootOrgId) {
      throw new Error(`Cannot initialize credits: Root organization not found for tenant ${tenantId}`);
    }

    await addCreditsToEntity({
      tenantId,
      entityType: 'organization',
      entityId: rootOrgId,
      creditAmount: initialCredits,
      source: 'initialization',
      sourceId: 'system_setup',
      description: 'Initial credit allocation for testing',
      initiatedBy: 'system'
    });

    console.log('✅ Credits initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize credits:', error);
    throw error;
  }
}

/**
 * Resolve the current credit unit price (USD per credit).
 * Reads from credit_configurations (operationCode = 'system.credit_purchase_rate').
 * Falls back to CREDIT_UNIT_PRICE env var, then to $0.001 default.
 */
async function getCreditUnitPrice(): Promise<number> {
  try {
    const config = await getOperationConfig('system.credit_purchase_rate');
    // Only use the DB value if a real config was found (not the generic default)
    if (config?.creditCost && !config.isDefault) {
      const price = parseFloat(String(config.creditCost));
      if (price > 0) return price;
    }
  } catch {
    // Config not seeded yet — fall through to defaults
  }
  return parseFloat(process.env.CREDIT_UNIT_PRICE || '0.001');
}

/**
 * Purchase credits for a tenant
 */
export async function purchaseCredits(opts: {
  tenantId: string;
  userId: string;
  creditAmount: number;
  paymentMethod: string;
  currency?: string;
  notes?: string | null;
  entityType?: string;
  entityId?: string | null;
  isWebhookCompletion?: boolean;
  sessionId?: string | null;
  paymentMethodDetails?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const {
    tenantId,
    userId,
    creditAmount,
    paymentMethod,
    currency = 'USD',
    entityType = 'organization',
    entityId = null,
    isWebhookCompletion = false,
    sessionId = null
  } = opts;
  try {
    let finalEntityId = entityId;
    if (!finalEntityId) {
      console.log('🔍 No entityId provided for credit purchase, finding root organization...');
      const rootOrgId = await findRootOrganization(tenantId);
      if (rootOrgId) {
        finalEntityId = rootOrgId;
        console.log(`✅ Using root organization for credit purchase: ${finalEntityId}`);
      } else {
        console.warn('⚠️ Root organization not found, will use tenantId as fallback');
        finalEntityId = tenantId;
      }
    }

    console.log('💰 Processing credit purchase:', {
      tenantId,
      creditAmount,
      paymentMethod,
      isWebhookCompletion,
      sessionId,
      entityId: finalEntityId
    });

    const unitPrice = await getCreditUnitPrice();
    const totalAmount = creditAmount * unitPrice;

    const MIN_CHARGE_USD = 0.50; // Stripe minimum for USD
    const minCredits = Math.ceil(MIN_CHARGE_USD / unitPrice);
    if (totalAmount < MIN_CHARGE_USD) {
      throw new Error(`Minimum purchase is ${minCredits.toLocaleString()} credits ($${MIN_CHARGE_USD.toFixed(2)})`);
    }

    type PurchaseRow = Record<string, unknown> & { purchaseId: string; status: string; paymentStatus?: string; stripePaymentIntentId?: string | null };
    let purchase: PurchaseRow | undefined;

    purchase = await db.transaction(async (tx) => {
      let txPurchase: PurchaseRow | undefined;

      if (isWebhookCompletion && sessionId) {
        console.log('🔍 Finding existing purchase for webhook completion...');
        const [existingPurchase] = await tx
          .select()
          .from(creditPurchases)
          .where(eq(creditPurchases.stripePaymentIntentId, String(sessionId)))
          .limit(1);

        if (existingPurchase) {
          console.log('✅ Found existing purchase:', existingPurchase.purchaseId);

          const updateData = {
            status: 'completed',
            paidAt: new Date(),
            creditedAt: new Date()
          };

          await tx
            .update(creditPurchases)
            .set(updateData)
            .where(eq(creditPurchases.purchaseId, existingPurchase.purchaseId));

          txPurchase = {
            ...existingPurchase,
            status: 'completed',
            paidAt: updateData.paidAt,
            creditedAt: updateData.creditedAt
          };
        } else {
          console.log('⚠️ No existing purchase found, creating new one for webhook completion');
        }
      }

      if (!txPurchase) {
        console.log('📝 Creating new purchase record...');
        const [newPurchase] = await tx
          .insert(creditPurchases)
          .values({
            tenantId,
            entityId: finalEntityId ?? undefined,
            creditAmount: creditAmount.toString(),
            unitPrice: unitPrice.toString(),
            totalAmount: totalAmount.toString(),
            batchId: randomUUID(),
            paymentMethod,
            status: isWebhookCompletion ? 'completed' : 'pending',
            requestedBy: userId || '00000000-0000-0000-0000-000000000001',
            paidAt: isWebhookCompletion ? new Date() : undefined,
            creditedAt: isWebhookCompletion ? new Date() : undefined
          })
          .returning();

        txPurchase = newPurchase as PurchaseRow;

        if (sessionId) {
          await tx
            .update(creditPurchases)
            .set({
              stripePaymentIntentId: sessionId
            })
            .where(eq(creditPurchases.purchaseId, txPurchase.purchaseId));
        }
      }

      return txPurchase;
    });

    console.log('🔍 Checking purchase status for credit allocation:', {
      purchaseId: purchase.purchaseId,
      status: purchase.status,
      paymentStatus: purchase.paymentStatus,
      isWebhookCompletion
    });

    if (purchase.status === 'completed') {
      console.log('💰 Adding credits to entity balance - CALLING addCreditsToEntity...');
      console.log('📋 Purchase details for credit allocation:', {
        purchaseId: purchase.purchaseId,
        stripePaymentIntentId: purchase.stripePaymentIntentId,
        sourceId: purchase.stripePaymentIntentId || purchase.purchaseId
      });
      try {
        await addCreditsToEntity({
          tenantId,
          entityType,
          entityId: finalEntityId,
          creditAmount,
          source: 'purchase',
          sourceId: (purchase.stripePaymentIntentId as string) || purchase.purchaseId,
          description: `Credit purchase: ${creditAmount} credits`,
          initiatedBy: userId || '00000000-0000-0000-0000-000000000001'
        });
        console.log('✅ addCreditsToEntity completed successfully');
      } catch (creditErr: unknown) {
        const creditError = creditErr as Error;
        console.error('❌ addCreditsToEntity failed:', creditError.message);
        throw creditError;
      }
    } else {
      console.log('⚠️ Purchase status is not completed, skipping credit allocation');
    }

    if (paymentMethod === 'stripe' && !isWebhookCompletion) {
      console.log('💳 Creating Stripe checkout session...');

      // Look up tenant's Stripe customer for linking
      let stripeCustomerId: string | undefined;
      try {
        const [tenant] = await db
          .select({ stripeCustomerId: tenants.stripeCustomerId })
          .from(tenants)
          .where(eq(tenants.tenantId, tenantId))
          .limit(1);
        if (tenant?.stripeCustomerId) {
          stripeCustomerId = tenant.stripeCustomerId;
        }
      } catch { /* proceed without customer link */ }

      const lineItem: Record<string, unknown> = {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(totalAmount * 100),
          ...(process.env.STRIPE_CREDIT_PRODUCT_ID
            ? { product: process.env.STRIPE_CREDIT_PRODUCT_ID }
            : {
                product_data: {
                  name: `${creditAmount.toLocaleString()} Credits`,
                  description: `Purchase ${creditAmount.toLocaleString()} credits for your account`,
                },
              }),
        },
        quantity: 1,
      };

      const checkoutSession = await stripe.checkout.sessions.create(
        {
          payment_method_types: ['card'],
          line_items: [lineItem as any],
          mode: 'payment',
          ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          success_url: `${process.env.FRONTEND_URL}/payment-success?type=credit_purchase&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled?type=credit_purchase`,
          metadata: {
            type: 'credit_purchase',
            tenantId,
            userId,
            purchaseId: purchase.purchaseId,
            creditAmount: creditAmount.toString(),
            entityType,
            entityId: finalEntityId,
            unitPrice: unitPrice.toString(),
            totalAmount: totalAmount.toString(),
            dollarAmount: totalAmount.toString(),
          },
        },
        { idempotencyKey: `credit-purchase-${purchase.purchaseId}` }
      );

      await db
        .update(creditPurchases)
        .set({
          stripePaymentIntentId: checkoutSession.id
        })
        .where(eq(creditPurchases.purchaseId, purchase.purchaseId));

      return {
        purchaseId: purchase.purchaseId,
        checkoutUrl: checkoutSession.url,
        amount: totalAmount,
        credits: creditAmount
      };
    }

    return {
      purchaseId: purchase.purchaseId,
      amount: totalAmount,
      credits: creditAmount,
      status: purchase.status
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error processing credit purchase:', error);
    throw error;
  }
}

/**
 * Add credits to an entity's balance
 */
export async function addCreditsToEntity(params: {
  tenantId: string;
  entityType?: string;
  entityId?: string | null;
  creditAmount: number;
  source: string;
  sourceId: string;
  description?: string;
  initiatedBy: string;
}): Promise<void> {
  const { tenantId, entityType, entityId, creditAmount, source, sourceId, initiatedBy } = params;
  let previousBalance = 0;
  let newBalance = 0;
  try {
    const normalizedEntityType = entityType || 'organization';

    let normalizedEntityId = entityId;
    if (!normalizedEntityId) {
      console.log('🔍 No entityId provided, finding root organization...');
      const rootOrgId = await findRootOrganization(tenantId);
      if (rootOrgId) {
        normalizedEntityId = rootOrgId;
        console.log(`✅ Using root organization: ${normalizedEntityId}`);
      } else {
        console.warn('⚠️ Root organization not found, falling back to tenantId');
        normalizedEntityId = tenantId;
      }
    }

    console.log('💰 Adding credits to entity:', {
      tenantId,
      originalEntityType: entityType,
      originalEntityId: entityId,
      normalizedEntityType,
      normalizedEntityId,
      creditAmount,
      source,
      sourceId
    });

    const { default: postgres } = await import('postgres');
    const sqlConn = postgres((process.env.DATABASE_URL ?? '') as string);

    try {
      console.log('🔐 Setting RLS context on direct connection...');
      await sqlConn`SELECT set_config('app.tenant_id', ${tenantId}, false)`;
      await sqlConn`SELECT set_config('app.user_id', ${initiatedBy}, false)`;
      await sqlConn`SELECT set_config('app.is_admin', 'true', false)`;
      console.log('✅ RLS context set on direct connection');

      // Wrap credit balance + transaction record in a single DB transaction
      // so the ledger stays consistent if either step fails.
      await sqlConn.begin(async (tx: any) => {
        const existingCredits = await tx`
            SELECT * FROM credits
            WHERE tenant_id = ${tenantId}
            AND entity_id = ${normalizedEntityId}
            LIMIT 1
          `;

        console.log('📊 Existing credits check result:', existingCredits.length);

        previousBalance = existingCredits.length > 0 ? parseFloat(String(existingCredits[0].available_credits)) : 0;
        newBalance = previousBalance + creditAmount;

        if (existingCredits.length > 0) {
          console.log('📝 Updating existing credit record...');
          const [updatedRow] = await tx`
              UPDATE credits
              SET available_credits = available_credits + ${creditAmount},
                  last_updated_at = NOW()
              WHERE credit_id = ${existingCredits[0].credit_id}
              RETURNING available_credits
            `;
          newBalance = parseFloat(String(updatedRow.available_credits));
          previousBalance = newBalance - creditAmount;
          console.log('✅ Updated existing credit balance:', { previousBalance, newBalance });
        } else {
          console.log('📝 Creating new credit record...');
          const newCredit = await tx`
              INSERT INTO credits (
                tenant_id, entity_id, available_credits, is_active
              ) VALUES (
                ${tenantId}, ${normalizedEntityId}, ${creditAmount.toString()}, true
              )
              RETURNING credit_id
            `;
          console.log('✅ Created new credit balance:', { creditId: newCredit[0].credit_id, newBalance: creditAmount });
        }

        console.log('📝 Creating transaction record...');

        await tx`
            INSERT INTO credit_transactions (
              tenant_id, entity_id, transaction_type, amount,
              previous_balance, new_balance, operation_code,
              initiated_by
            ) VALUES (
              ${tenantId}, ${normalizedEntityId}, 'purchase', ${creditAmount.toString()},
              ${previousBalance.toString()}, ${newBalance.toString()}, ${source},
              ${initiatedBy === 'system' ? null : initiatedBy}
            )
          `;
        console.log('✅ Transaction record created successfully');

        // Create a credit_batches row so FIFO allocation to apps can track these
        // credits with proper expiry dates.
        // Paid credits expire with the subscription period (currentPeriodEnd).
        // Free onboarding credits also expire with the subscription period.
        // Seasonal credits are handled separately by campaign distribution.
        const isPaid = source === 'purchase' || source === 'stripe' || source === 'manual_purchase';
        const isOnboarding = source === 'onboarding' || source === 'subscription' || source === 'trial';

        if (isPaid || isOnboarding) {
          // Look up subscription expiry for this tenant
          const subRows = await tx`
              SELECT current_period_end FROM subscriptions
              WHERE tenant_id = ${tenantId} AND status = 'active'
              ORDER BY updated_at DESC LIMIT 1
            `;
          const subExpiry = subRows.length > 0 && subRows[0].current_period_end
            ? new Date(subRows[0].current_period_end).toISOString()
            : null;

          // Dev mode: 10-minute expiry for quick testing of the expiry flow.
          // Production: use subscription period end.
          const devExpiryMs = process.env.CREDIT_PURCHASE_EXPIRY_MINUTES
            ? parseInt(process.env.CREDIT_PURCHASE_EXPIRY_MINUTES, 10) * 60_000
            : null;
          const batchExpiry = devExpiryMs
            ? new Date(Date.now() + devExpiryMs).toISOString()
            : (subExpiry ?? new Date(Date.now() + 365 * 86_400_000).toISOString());
          const batchCreditType = isPaid ? 'paid' : 'free';

          await tx`
              INSERT INTO credit_batches (
                tenant_id, entity_id, entity_type,
                target_application, credit_type,
                allocated_credits, used_credits, expires_at,
                is_active, is_expired, distribution_status, allocated_at,
                created_at, updated_at
              ) VALUES (
                ${tenantId}, ${normalizedEntityId}, ${normalizedEntityType},
                NULL, ${batchCreditType},
                ${creditAmount.toString()}, '0', ${batchExpiry},
                true, false, 'completed', NOW(),
                NOW(), NOW()
              )
            `;
          console.log(`✅ Created ${batchCreditType} credit batch (expires: ${batchExpiry})`);
        }
      });
    } finally {
      await sqlConn.end();
    }

    console.log(
      `✅ Added ${creditAmount} credits to ${normalizedEntityType}${normalizedEntityId ? ` (${normalizedEntityId})` : ''} for tenant ${tenantId}`
    );

    // NOTE: Do NOT publish MQ events here. addCreditsToEntity only adds to the
    // tenant's POOL. Apps receive credits only when an admin explicitly allocates
    // via allocateCreditsToApplication(), which publishes the MQ event itself.
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error adding credits to entity:', error);
    throw error;
  }
}

/**
 * Allocate credits from an entity's balance to a specific application.
 */
export async function allocateCreditsToApplication(params: {
  tenantId: string;
  sourceEntityId: string;
  targetApplication: string;
  creditAmount: number;
  allocationPurpose?: string;
  initiatedBy?: string;
}): Promise<Record<string, unknown>> {
  const { tenantId, sourceEntityId, targetApplication, creditAmount, allocationPurpose, initiatedBy } = params;
  try {
    console.log('📦 Allocating credits to application:', {
      tenantId,
      sourceEntityId,
      targetApplication,
      creditAmount,
      allocationPurpose
    });

    if (!tenantId || !sourceEntityId || !targetApplication || !creditAmount || creditAmount <= 0) {
      throw new Error(
        'Missing required fields: tenantId, sourceEntityId, targetApplication, and a positive creditAmount are required'
      );
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const initiatedByUuid = initiatedBy && UUID_REGEX.test(initiatedBy) ? initiatedBy : null;
    const rlsUserId = initiatedBy || 'system';

    const { default: postgres } = await import('postgres');
    const sqlConn = postgres((process.env.DATABASE_URL ?? '') as string);

    let previousBalance = 0;
    let newBalance = 0;
    let allocationId = `app_alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Collect per-batch results during the transaction so we can publish
    // one SNS event per source batch (FA needs per-batch expiry dates).
    interface BatchResult { allocationId: string; expiresAt: string | null; deltaAmount: number; creditType: string }
    const batchResults: BatchResult[] = [];

    try {
      await sqlConn`SELECT set_config('app.tenant_id', ${tenantId}, false)`;
      await sqlConn`SELECT set_config('app.user_id', ${rlsUserId}, false)`;
      await sqlConn`SELECT set_config('app.is_admin', 'true', false)`;

      // Wrap deduction + transaction record atomically so the ledger
      // stays consistent if either step fails.
      await sqlConn.begin(async (tx: any) => {
        const existingCredits = await tx`
            SELECT * FROM credits
            WHERE tenant_id = ${tenantId}
            AND entity_id = ${sourceEntityId}
            LIMIT 1
          `;

        if (existingCredits.length === 0) {
          throw new Error('No credit record found for the source entity');
        }

        previousBalance = parseFloat(existingCredits[0].available_credits);

        if (previousBalance < creditAmount) {
          throw new Error(`Insufficient credits. Available: ${previousBalance}, Requested: ${creditAmount}`);
        }

        newBalance = previousBalance - creditAmount;

        const updateResult = await tx`
            UPDATE credits
            SET available_credits = available_credits - ${creditAmount},
                last_updated_at = NOW()
            WHERE credit_id = ${existingCredits[0].credit_id}
            AND available_credits >= ${creditAmount}
            RETURNING *
          `;

        if (updateResult.length === 0) {
          throw new Error('Insufficient credits for allocation');
        }

        await tx`
            INSERT INTO credit_transactions (
              tenant_id, entity_id, transaction_type, amount,
              previous_balance, new_balance, operation_code,
              initiated_by
            ) VALUES (
              ${tenantId}, ${sourceEntityId}, 'allocation', ${creditAmount.toString()},
              ${previousBalance.toString()}, ${newBalance.toString()},
              ${'application_allocation:' + targetApplication},
              ${initiatedByUuid}
            )
          `;

        // FIFO allocation across batches: consume soonest-expiring first.
        // This ensures seasonal (expire soon) are used before free (subscription
        // period) which are used before paid (subscription period).
        const sourceBatches = await tx`
            SELECT allocation_id, expires_at, campaign_id, credit_type,
                   allocated_credits, used_credits
            FROM credit_batches
            WHERE tenant_id = ${tenantId}
              AND entity_id = ${sourceEntityId}
              AND target_application IS NULL
              AND is_active = true
              AND is_expired = false
              AND expires_at IS NOT NULL
              AND expires_at > NOW()
            ORDER BY expires_at ASC
          `;

        let remaining = creditAmount;

        for (const srcBatch of sourceBatches) {
          if (remaining <= 0) break;

          const batchRemaining = parseFloat(srcBatch.allocated_credits) - parseFloat(srcBatch.used_credits);
          if (batchRemaining <= 0) continue;

          // Take as much as we can from this batch
          const take = Math.min(remaining, batchRemaining);
          remaining -= take;

          // Mark credits as used on source batch
          await tx`
              UPDATE credit_batches
              SET used_credits = used_credits + ${take},
                  updated_at = NOW()
              WHERE allocation_id = ${srcBatch.allocation_id}
            `;

          // Create or update app-specific batch (upsert handles the unique constraint
          // uq_seasonal_alloc_campaign_tenant_app for same campaign+tenant+app combo).
          const [upsertedBatch] = await tx`
              INSERT INTO credit_batches (
                campaign_id, tenant_id, entity_id, entity_type,
                target_application, credit_type,
                allocated_credits, used_credits, expires_at,
                is_active, is_expired, distribution_status, allocated_at,
                created_at, updated_at
              ) VALUES (
                ${srcBatch.campaign_id}, ${tenantId}, ${sourceEntityId}, 'organization',
                ${targetApplication}, ${srcBatch.credit_type || 'free'},
                ${take.toString()}, '0', ${srcBatch.expires_at},
                true, false, 'completed', NOW(),
                NOW(), NOW()
              )
              ON CONFLICT (campaign_id, tenant_id, target_application)
              DO UPDATE SET
                allocated_credits = credit_batches.allocated_credits + ${take},
                expires_at = GREATEST(credit_batches.expires_at, ${srcBatch.expires_at}),
                is_active = true,
                is_expired = false,
                updated_at = NOW()
              RETURNING allocation_id, expires_at
            `;

          batchResults.push({
            allocationId: upsertedBatch.allocation_id,
            expiresAt: srcBatch.expires_at ? new Date(srcBatch.expires_at).toISOString() : null,
            deltaAmount: take,
            creditType: srcBatch.credit_type || 'free',
          });
        }

        // Fallback: no source batches found or they didn't cover the full amount.
        // These are likely old pre-batch credits. Use subscription period end as expiry.
        if (remaining > 0 || batchResults.length === 0) {
          const subRows = await tx`
              SELECT current_period_end FROM subscriptions
              WHERE tenant_id = ${tenantId} AND status = 'active'
              ORDER BY updated_at DESC LIMIT 1
            `;
          const fallbackExpiry = subRows.length > 0 && subRows[0].current_period_end
            ? new Date(subRows[0].current_period_end).toISOString()
            : new Date(Date.now() + 365 * 86_400_000).toISOString();
          const fallbackAmount = remaining > 0 ? remaining : creditAmount;

          const [fallbackBatch] = await tx`
              INSERT INTO credit_batches (
                tenant_id, entity_id, entity_type,
                target_application, credit_type,
                allocated_credits, used_credits, expires_at,
                is_active, is_expired, distribution_status, allocated_at,
                created_at, updated_at
              ) VALUES (
                ${tenantId}, ${sourceEntityId}, 'organization',
                ${targetApplication}, 'paid',
                ${fallbackAmount.toString()}, '0', ${fallbackExpiry},
                true, false, 'completed', NOW(),
                NOW(), NOW()
              )
              RETURNING allocation_id, expires_at
            `;

          batchResults.push({
            allocationId: fallbackBatch.allocation_id,
            expiresAt: fallbackExpiry,
            deltaAmount: fallbackAmount,
            creditType: 'paid',
          });
        }
      });

      console.log('✅ Deducted credits from entity balance:', {
        previousBalance,
        newBalance,
        creditAmount,
        targetApplication
      });
    } finally {
      await sqlConn.end();
    }

    // Publish one credit.allocated event PER source batch so the downstream app
    // (FA) gets per-batch expiry dates and can create separate batch records.
    // E.g., 250 credits from seasonal(200, expires Apr 10) + free(50, expires Jul 4)
    // → two events: {deltaAmount:200, expiresAt:Apr10} + {deltaAmount:50, expiresAt:Jul4}
    const allocatedAt = new Date().toISOString();
    for (const batch of batchResults) {
      const allocationEventData = {
        entityId: sourceEntityId,
        targetApplication,
        deltaAmount: batch.deltaAmount,
        allocatedCredits: batch.deltaAmount,
        allocationType: 'organization',
        allocationPurpose: allocationPurpose || `Credit allocation to ${targetApplication}`,
        allocationSource: 'admin_allocation',
        allocatedBy: initiatedBy,
        allocatedAt,
        allocationId: batch.allocationId,
        expiresAt: batch.expiresAt,
        creditType: batch.creditType,
        metadata: {
          sourceEntityId,
          previousEntityBalance: previousBalance,
          newEntityBalance: newBalance,
          purpose: allocationPurpose,
          totalAllocationAmount: creditAmount,
          batchCount: batchResults.length,
        }
      };

      try {
        await snsSqsPublisher.publishCreditEvent(
          targetApplication,
          'credit.allocated',
          tenantId,
          allocationEventData,
          initiatedBy || 'system'
        );
        console.log(`✅ Published credit.allocated event to ${targetApplication}: ${batch.deltaAmount} credits, expires ${batch.expiresAt}`);
      } catch (publishErr: unknown) {
        const publishError = publishErr as Error;
        console.warn(
          `⚠️ Failed to publish credit allocation event to ${targetApplication}:`,
          publishError.message
        );
      }
    }

    return {
      success: true,
      allocationId: batchResults[0]?.allocationId || allocationId,
      sourceEntityId,
      targetApplication,
      creditAmount,
      previousBalance,
      newBalance,
      allocationPurpose,
      timestamp: new Date().toISOString()
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('❌ Error allocating credits to application:', error);
    throw error;
  }
}

/**
 * Record credit consumption from CRM (called by CRM consumer)
 */
export async function recordCreditConsumption(
  tenantId: string,
  entityId: string,
  userId: string,
  amount: number,
  operationType: string,
  operationId: string,
  metadata: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  try {
    console.log(`📊 Recording credit consumption: ${amount} credits by ${userId} for ${operationType}`);

    try {
      await snsSqsPublisher.publishCreditConsumption(
        'crm',
        tenantId,
        entityId,
        userId,
        amount,
        operationType,
        operationId,
        metadata
      );
    } catch (streamErr: unknown) {
      const streamError = streamErr as Error;
      console.warn('⚠️ Failed to publish credit consumption event:', streamError.message);
    }

    return {
      success: true,
      message: 'Credit consumption recorded and published',
      data: {
        tenantId,
        entityId,
        userId,
        amount,
        operationType,
        operationId,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error recording credit consumption:', error);
    throw error;
  }
}

/**
 * Consume credits for an operation (organization-level only).
 */
export async function consumeCredits(opts: {
  tenantId: string;
  userId: string;
  operationCode: string;
  creditCost: number;
  operationId: string;
  description?: string;
  metadata?: Record<string, unknown>;
  entityType?: string;
  entityId?: string | null;
}): Promise<Record<string, unknown>> {
  const {
    tenantId,
    userId,
    operationCode,
    creditCost,
    entityType = 'organization',
    entityId = null
  } = opts;
  try {
    const currentBalance = await getEntityBalance(tenantId, entityType, entityId);
    const availableNum = Number(currentBalance?.availableCredits ?? 0);

    if (!currentBalance || availableNum < creditCost) {
      return {
        success: false,
        message: 'Insufficient credits',
        data: {
          availableCredits: availableNum,
          requiredCredits: creditCost,
          entityType,
          entityId
        }
      };
    }

    const result = await db.transaction(async (tx) => {
      const [updatedCredit] = await tx
        .update(credits)
        .set({
          availableCredits: sql`${credits.availableCredits} - ${creditCost}`,
          lastUpdatedAt: new Date()
        })
        .where(
          and(
            eq(credits.tenantId, tenantId),
            entityId ? eq(credits.entityId, entityId) : sql`${credits.entityId} IS NULL`,
            eq(credits.isActive, true),
            sql`${credits.availableCredits} >= ${creditCost}`
          )
        )
        .returning();

      if (!updatedCredit) {
        throw new Error('Insufficient credits');
      }

      const prevBal = Number(currentBalance.availableCredits ?? 0);
      const newBal = prevBal - creditCost;
      const [transaction] = await tx
        .insert(creditTransactions)
        .values({
          tenantId,
          entityId: entityId ?? undefined,
          transactionType: 'consumption',
          amount: (-creditCost).toString(),
          previousBalance: prevBal.toString(),
          newBalance: newBal.toString(),
          operationCode: operationCode ?? undefined,
          initiatedBy: userId
        })
        .returning();

      return {
        creditBalance: updatedCredit,
        transaction
      };
    });

    const remaining = Number(currentBalance.availableCredits ?? 0) - creditCost;
    return {
      success: true,
      data: {
        transactionId: result.transaction.transactionId,
        creditsConsumed: creditCost,
        remainingCredits: remaining
      }
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error consuming credits:', error);
    throw error;
  }
}

/**
 * Transfer credits between entities
 */
export async function transferCredits(params: {
  fromTenantId: string;
  toEntityType: string;
  toEntityId: string;
  creditAmount: number;
  initiatedBy?: string;
  reason?: string;
}): Promise<Record<string, unknown>> {
  const { fromTenantId, toEntityId, creditAmount, initiatedBy } = params;
  try {
    let tenantId: string;
    let fromEntityId: string;

    const [sourceEntity] = await db
      .select({ entityId: entities.entityId, tenantId: entities.tenantId })
      .from(entities)
      .where(and(eq(entities.entityId, fromTenantId), eq(entities.isActive, true)))
      .limit(1);

    if (sourceEntity) {
      tenantId = sourceEntity.tenantId;
      fromEntityId = fromTenantId;
    } else {
      tenantId = fromTenantId;
      fromEntityId = fromTenantId;
    }

    await ensureCreditRecord(tenantId, 'organization', fromEntityId, 0);

    const sourceBalance = await getCurrentBalance(tenantId, 'organization', fromEntityId);

    if (!sourceBalance || sourceBalance.availableCredits < creditAmount) {
      return {
        success: false,
        message: `Insufficient credits for transfer. Available: ${sourceBalance?.availableCredits || 0}, Required: ${creditAmount}`
      };
    }

    const [targetEntity] = await db
      .select({ entityId: entities.entityId })
      .from(entities)
      .where(
        and(
          eq(entities.entityId, toEntityId),
          eq(entities.tenantId, tenantId),
          eq(entities.isActive, true)
        )
      )
      .limit(1);

    if (!targetEntity) {
      return {
        success: false,
        message: `Target entity ${toEntityId} does not exist or is not active. Cannot transfer credits to a non-existent entity.`
      };
    }

    // Find the soonest-expiring active batch on the source entity so we can
    // carry its expiry date to the destination and correctly account for the
    // transferred amount in the source batch's usedCredits.
    // We pick the earliest-expiring batch (FIFO / burn-soonest-first).
    const [sourceBatch] = await db
      .select()
      .from(creditBatches)
      .where(and(
        eq(creditBatches.tenantId, tenantId),
        eq(creditBatches.entityId, fromEntityId),
        eq(creditBatches.isActive, true),
        eq(creditBatches.isExpired, false),
        isNotNull(creditBatches.expiresAt),
        gt(creditBatches.expiresAt, new Date())
      ))
      .orderBy(asc(creditBatches.expiresAt))
      .limit(1);

    await db.transaction(async (tx) => {
      // 1. Deduct from source entity balance
      const [deducted] = await tx
        .update(credits)
        .set({
          availableCredits: sql`${credits.availableCredits} - ${creditAmount}`,
          lastUpdatedAt: new Date()
        })
        .where(
          and(
            eq(credits.tenantId, tenantId),
            eq(credits.entityId, fromEntityId),
            sql`${credits.availableCredits} >= ${creditAmount}`
          )
        )
        .returning();

      if (!deducted) {
        throw new Error('Insufficient credits for transfer');
      }

      // 2. Add to destination entity balance
      const [existingCredit] = await tx
        .select()
        .from(credits)
        .where(and(eq(credits.tenantId, tenantId), eq(credits.entityId, toEntityId)))
        .limit(1);

      if (existingCredit) {
        await tx
          .update(credits)
          .set({
            availableCredits: sql`${credits.availableCredits} + ${creditAmount}`,
            lastUpdatedAt: new Date()
          })
          .where(eq(credits.creditId, existingCredit.creditId));
      } else {
        await tx.insert(credits).values({
          tenantId: tenantId,
          entityId: toEntityId,
          availableCredits: creditAmount.toString(),
          isActive: true,
          lastUpdatedAt: new Date()
        });
      }

      // 3. Record credit transactions (audit trail)
      await tx.insert(creditTransactions).values({
        tenantId: tenantId,
        entityId: fromEntityId,
        transactionType: 'transfer_out',
        amount: (-creditAmount).toString(),
        initiatedBy: initiatedBy ?? undefined
      });

      await tx.insert(creditTransactions).values({
        tenantId: tenantId,
        entityId: toEntityId,
        transactionType: 'transfer_in',
        amount: creditAmount.toString(),
        initiatedBy: initiatedBy ?? undefined
      });

      // 4. Carry expiry from source batch to destination.
      //    Without this, destination credits would never expire and the expiry
      //    cron would deduct 'allocatedCredits - 0' from the source entity even
      //    though those credits have been moved — creating a negative balance.
      if (sourceBatch) {
        // Mark the transferred amount as "used" on the source batch so the cron
        // correctly computes unusedCredits = allocated - used (not allocated - 0).
        await tx
          .update(creditBatches)
          .set({ usedCredits: sql`${creditBatches.usedCredits} + ${creditAmount}` })
          .where(eq(creditBatches.allocationId, sourceBatch.allocationId));

        // Create a new batch for the destination entity that inherits the same
        // expiry date and campaign reference so:
        //   (a) the expiry cron will deduct from the destination entity on expiry
        //   (b) the tenant's billing expiry card shows the destination batch too
        await tx.insert(creditBatches).values({
          campaignId: sourceBatch.campaignId ?? undefined,
          tenantId: tenantId,
          entityId: toEntityId,
          entityType: 'organization',
          targetApplication: sourceBatch.targetApplication ?? undefined,
          creditType: sourceBatch.creditType ?? undefined,
          allocatedCredits: creditAmount.toString(),
          usedCredits: '0',
          expiresAt: sourceBatch.expiresAt!,
          isActive: true,
          isExpired: false,
          distributionStatus: 'completed',
          allocatedAt: new Date(),
        });
      } else {
        // No source batch found — credits exist in the balance but have no batch
        // tracking them (e.g. manually added credits, or all batches already expired).
        // Create a destination batch with a 1-year default expiry so the expiry cron
        // can eventually reclaim unused credits instead of them living forever.
        const defaultExpiry = new Date();
        defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);

        await tx.insert(creditBatches).values({
          tenantId: tenantId,
          entityId: toEntityId,
          entityType: 'organization',
          creditType: 'free',
          allocatedCredits: creditAmount.toString(),
          usedCredits: '0',
          expiresAt: defaultExpiry,
          isActive: true,
          isExpired: false,
          distributionStatus: 'completed',
          allocatedAt: new Date(),
        });
      }
    });

    return {
      success: true,
      message: 'Credits transferred successfully'
    };
  } catch (error) {
    console.error('Error transferring credits:', error);
    throw error;
  }
}

/**
 * Get available credit packages
 */
export async function getAvailablePackages(): Promise<
  Array<{
    id: string;
    name: string;
    credits: number;
    price: number;
    currency: string;
    description: string;
    features: string[];
    recommended: boolean;
  }>
> {
  return [
    {
      id: 'starter',
      name: 'Starter Package',
      credits: 1000,
      price: 49,
      currency: 'USD',
      description: 'Perfect for small businesses getting started',
      features: [
        '1,000 credits',
        'Basic operations support',
        'Email support',
        '1 month validity'
      ],
      recommended: false
    },
    {
      id: 'professional',
      name: 'Professional Package',
      credits: 5000,
      price: 199,
      currency: 'USD',
      description: 'Ideal for growing businesses with regular operations',
      features: [
        '5,000 credits',
        'Advanced operations support',
        'Priority email support',
        '3 months validity',
        'Basic reporting'
      ],
      recommended: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise Package',
      credits: 15000,
      price: 499,
      currency: 'USD',
      description: 'For large organizations with high-volume operations',
      features: [
        '15,000 credits',
        'Full operations support',
        'Phone & email support',
        '6 months validity',
        'Advanced reporting',
        'Custom integrations'
      ],
      recommended: false
    }
  ];
}
