import { db } from '../../../db/index.js';
import {
  credits,
  creditTransactions,
  creditPurchases,
  entities
} from '../../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { amazonMQPublisher } from '../../messaging/utils/amazon-mq-publisher.js';
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

    const unitPrice = 0.001;
    const totalAmount = creditAmount * unitPrice;

    type PurchaseRow = Record<string, unknown> & { purchaseId: string; status: string; paymentStatus?: string; stripePaymentIntentId?: string | null };
    let purchase: PurchaseRow | undefined;

    if (isWebhookCompletion && sessionId) {
      console.log('🔍 Finding existing purchase for webhook completion...');
      const [existingPurchase] = await db
        .select()
        .from(creditPurchases)
        .where(eq(creditPurchases.stripePaymentIntentId, String(sessionId)))
        .limit(1);

      if (existingPurchase) {
        console.log('✅ Found existing purchase:', existingPurchase.purchaseId);

        const updateData = {
          status: 'completed',
          paymentStatus: 'completed',
          paidAt: new Date(),
          creditedAt: new Date()
        };

        await db
          .update(creditPurchases)
          .set(updateData)
          .where(eq(creditPurchases.purchaseId, existingPurchase.purchaseId));

        purchase = {
          ...existingPurchase,
          status: 'completed',
          paymentStatus: 'completed',
          paidAt: updateData.paidAt,
          creditedAt: updateData.creditedAt
        };
      } else {
        console.log('⚠️ No existing purchase found, creating new one for webhook completion');
      }
    }

    if (!purchase) {
      console.log('📝 Creating new purchase record...');
      const [newPurchase] = await db
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

      purchase = newPurchase as PurchaseRow;

      if (sessionId) {
        await db
          .update(creditPurchases)
          .set({
            stripePaymentIntentId: sessionId
          })
          .where(eq(creditPurchases.purchaseId, purchase.purchaseId));
      }
    }

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
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `${creditAmount} Credits`,
                description: `Purchase ${creditAmount} credits for your account`
              },
              unit_amount: Math.round(totalAmount * 100)
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment-success?type=credit_purchase&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled?type=credit_purchase`,
        metadata: {
          tenantId,
          userId,
          purchaseId: purchase.purchaseId,
          creditAmount: creditAmount.toString(),
          entityType,
          entityId: finalEntityId,
          unitPrice: unitPrice.toString(),
          totalAmount: totalAmount.toString()
        }
      });

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
  const { tenantId, entityType, entityId, creditAmount, source, sourceId, description, initiatedBy } = params;
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

      const existingCredits = await sqlConn`
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
        await sqlConn`
            UPDATE credits
            SET available_credits = available_credits + ${creditAmount},
                last_updated_at = NOW()
            WHERE credit_id = ${existingCredits[0].credit_id}
          `;
        console.log('✅ Updated existing credit balance:', { previousBalance, newBalance });
      } else {
        console.log('📝 Creating new credit record...');
        const newCredit = await sqlConn`
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

      await sqlConn`
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
    } finally {
      await sqlConn.end();
    }

    console.log(
      `✅ Added ${creditAmount} credits to ${normalizedEntityType}${normalizedEntityId ? ` (${normalizedEntityId})` : ''} for tenant ${tenantId}`
    );

    const allocationMetadata = {
      allocationId: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reason: source,
      entityType: normalizedEntityType,
      previousBalance: previousBalance,
      newBalance: newBalance,
      sourceId: sourceId,
      description: description,
      allocatedBy: initiatedBy
    };

    const targetApps = ['crm', 'operations'];
    for (const app of targetApps) {
      try {
        await amazonMQPublisher.publishCreditAllocation(
          app,
          tenantId,
          normalizedEntityId,
          creditAmount,
          allocationMetadata
        );
      } catch (streamErr: unknown) {
        const streamError = streamErr as Error;
        console.warn(`⚠️ Failed to publish credit allocation event to ${app}:`, streamError.message);
      }
    }
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
    let allocationId: string;

    try {
      await sqlConn`SELECT set_config('app.tenant_id', ${tenantId}, false)`;
      await sqlConn`SELECT set_config('app.user_id', ${rlsUserId}, false)`;
      await sqlConn`SELECT set_config('app.is_admin', 'true', false)`;

      const existingCredits = await sqlConn`
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

      await sqlConn`
          UPDATE credits
          SET available_credits = available_credits - ${creditAmount},
              last_updated_at = NOW()
          WHERE credit_id = ${existingCredits[0].credit_id}
          AND available_credits >= ${creditAmount}
        `;

      allocationId = `app_alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await sqlConn`
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

      console.log('✅ Deducted credits from entity balance:', {
        previousBalance,
        newBalance,
        creditAmount,
        targetApplication
      });
    } finally {
      await sqlConn.end();
    }

    // deltaAmount = credits being added in this allocation (additive, not a replacement total).
    // Wrapper does not track per-application consumption — FA owns that via accounting_credit_usage.
    // FA will compute: newAllocated = existing.allocatedCredits + deltaAmount
    //                  usedCredits  = SUM(accounting_credit_usage) [FA ledger]
    //                  available    = newAllocated - usedCredits
    // Do NOT send usedCredits or availableCredits — they would corrupt FA's local ledger.
    const allocationEventData = {
      entityId: sourceEntityId,
      targetApplication,
      deltaAmount: creditAmount,       // FA reads this first — explicit additive delta
      allocatedCredits: creditAmount,  // kept for backward compat; FA prefers deltaAmount
      allocationType: 'organization',
      allocationPurpose: allocationPurpose || `Credit allocation to ${targetApplication}`,
      allocationSource: 'admin_allocation',
      allocatedBy: initiatedBy,
      allocatedAt: new Date().toISOString(),
      allocationId,
      metadata: {
        sourceEntityId,
        previousEntityBalance: previousBalance,
        newEntityBalance: newBalance,
        purpose: allocationPurpose
      }
    };

    try {
      await amazonMQPublisher.publishCreditEvent(
        targetApplication,
        'credit.allocated',
        tenantId,
        allocationEventData,
        initiatedBy || 'system'
      );
      console.log(`✅ Published credit.allocated event to ${targetApplication}`);
    } catch (publishErr: unknown) {
      const publishError = publishErr as Error;
      console.warn(
        `⚠️ Failed to publish credit allocation event to ${targetApplication}:`,
        publishError.message
      );
    }

    return {
      success: true,
      allocationId,
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
      await amazonMQPublisher.publishCreditConsumption(
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
            eq(credits.isActive, true)
          )
        )
        .returning();

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
  const { fromTenantId, toEntityType, toEntityId, creditAmount, initiatedBy } = params;
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

    await db.transaction(async (tx) => {
      await tx
        .update(credits)
        .set({
          availableCredits: sql`${credits.availableCredits} - ${creditAmount}`,
          lastUpdatedAt: new Date()
        })
        .where(and(eq(credits.tenantId, tenantId), eq(credits.entityId, fromEntityId)));

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
