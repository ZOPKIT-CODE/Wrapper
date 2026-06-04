import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreditService } from '../services/credit-service.js';
import Logger from '../../../utils/logger.js';
import { authenticateToken, requirePermission } from '../../../middleware/auth/auth.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import { db } from '../../../db/index.js';
import { credits, creditPurchases, tenantUsers, entities, eventTracking } from '../../../db/schema/index.js';
import { eq, and, asc } from 'drizzle-orm';
import ErrorResponses from '../../../utils/error-responses.js';

export default async function creditRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  Logger.log('info', 'general', 'boot', 'Registering credit routes');

  // Get current credit balance for authenticated user
  fastify.get('/current', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = request.userContext as { userId: string; tenantId: string | null };
      Logger.log('info', 'billing', 'get-credit-balance', 'Credit API request received', { userId: userContext.userId, tenantId: userContext.tenantId });
      const userId = userContext.userId;
      let tenantId = userContext.tenantId;

      Logger.log('info', 'billing', 'get-credit-balance', 'Credit API request received', {
        userId,
        tenantId,
        hasTenantId: !!tenantId
      });

      if (!tenantId) {
        Logger.log('warning', 'billing', 'get-credit-balance', 'User not associated with organization, checking onboarding status');
        // Check if user needs onboarding instead of hard error
        try {
          Logger.log('info', 'billing', 'get-credit-balance', 'Querying database for user record');
          const onboardingResponse = await db
            .select()
            .from(tenantUsers)
            .where(eq(tenantUsers.idpSub, userId))
            .limit(1);

          Logger.log('info', 'billing', 'get-credit-balance', 'Database query successful', { recordCount: onboardingResponse.length });

          if (onboardingResponse.length === 0) {
            // User doesn't exist in our system - likely needs onboarding
            Logger.log('info', 'billing', 'get-credit-balance', 'User record not found, likely needs onboarding');
            return reply.code(404).send({
              success: false,
              error: 'Organization Required',
              message: 'Please complete organization setup to access credit features',
              resource: 'Organization',
              statusCode: 404,
              requestId: `credit_${Date.now()}`,
              timestamp: new Date().toISOString(),
              requiresOnboarding: true
            });
          }

          // User exists - check if they have a tenant
          const userRecord = onboardingResponse[0];
          Logger.log('info', 'billing', 'get-credit-balance', 'Found user record', {
            userId: userRecord.userId,
            tenantId: userRecord.tenantId,
            onboardingCompleted: userRecord.onboardingCompleted,
            hasTenantId: !!userRecord.tenantId
          });

          // CRITICAL FIX: If user has a tenant in database but request context has null tenantId,
          // use the tenantId from the database record
          if (userRecord.tenantId && userRecord.onboardingCompleted) {
            Logger.log('info', 'billing', 'get-credit-balance', 'User has completed onboarding with tenant, querying credit data');
            // Set the tenantId from database and continue with normal credit query
            tenantId = userRecord.tenantId;
          } else {
            // User doesn't have a completed tenant setup
            Logger.log('warning', 'billing', 'get-credit-balance', 'User does not have completed tenant setup, returning onboarding required');
            return reply.code(404).send({
              success: false,
              error: 'Organization Required',
              message: 'Please complete organization setup to access credit features',
              resource: 'Organization',
              statusCode: 404,
              requestId: `credit_${Date.now()}`,
              timestamp: new Date().toISOString(),
              requiresOnboarding: true
            });
          }
        } catch (onboardingError) {
          Logger.log('error', 'billing', 'get-credit-balance', 'Error checking onboarding status', { error: (onboardingError as Error).message });

          // CRITICAL FIX: If database query fails but user is authenticated,
          // provide default credit balance instead of hard error
          Logger.log('warning', 'billing', 'get-credit-balance', 'Database query failed but user is authenticated, returning default credit balance');
        }

        // Return default credit balance for authenticated users without tenant context
        Logger.log('info', 'billing', 'get-credit-balance', 'Returning default credit balance for authenticated user');
        return {
          success: true,
          data: {
            tenantId: null, // No tenant yet
            availableCredits: 0,
            freeCredits: 0,
            paidCredits: 0,
            seasonalCredits: 0,
            reservedCredits: 0,
            totalCredits: 0,
            creditBalance: 0,
            plan: 'free',
            status: 'no_credits',
            lastPurchase: null,
            creditExpiry: null,
            freeCreditsExpiry: null,
            paidCreditsExpiry: null,
            seasonalCreditsExpiry: null,
            usageThisPeriod: 0,
            periodLimit: 0,
            periodType: 'month',
            lowBalanceThreshold: 100,
            criticalBalanceThreshold: 10,
            restrictionsActive: true,
            alerts: [{
              id: 'onboarding_required',
              type: 'info',
              message: 'Complete your organization setup to access credit features',
              priority: 'medium'
            }]
          }
        };
      }

      // Find all organization entities for this tenant
      // Select only columns we use so the query works when legal_name (and other FA fields) are not yet migrated
      Logger.log('info', 'billing', 'get-credit-balance', 'Finding organization entities for tenant', { tenantId });
      let organizationEntities: { entityId: string; entityName: string; entityLevel: number | null }[] = [];
      try {
        organizationEntities = await db
          .select({
            entityId: entities.entityId,
            entityName: entities.entityName,
            entityLevel: entities.entityLevel,
          })
          .from(entities)
          .where(and(
            eq(entities.tenantId, tenantId),
            eq(entities.entityType, 'organization'),
            eq(entities.isActive, true)
          ))
          .orderBy(asc(entities.entityLevel), asc(entities.createdAt));
      } catch (dbErr: unknown) {
        const dbError = dbErr as Error;
        Logger.log('error', 'billing', 'get-credit-balance', 'Error querying organization entities', { error: dbError.message });
        throw new Error(`Database query failed: ${dbError.message}`);
      }

      let creditBalance = null;

      if (organizationEntities.length > 0) {
        Logger.log('info', 'billing', 'get-credit-balance', 'Found organization entities', { count: organizationEntities.length });

        const primaryEntity = organizationEntities[0];

        // Always get the primary org's balance first — it carries the subscription
        // metadata (plan, expiry dates, alerts) that the billing UI needs.
        try {
          creditBalance = await CreditService.getCurrentBalance(tenantId, 'organization', primaryEntity.entityId);
          creditBalance.entityId = primaryEntity.entityId;
        } catch (entityError) {
          Logger.log('error', 'billing', 'get-credit-balance', 'Error getting balance for primary entity', { entityId: primaryEntity.entityId, error: (entityError as Error).message });
        }

        // Aggregate availableCredits across ALL entities so the billing header
        // shows the tenant's total balance, not just one entity's balance.
        // The primary org's balance already provides subscription metadata (plan,
        // expiry dates, alerts) — we only need to sum the raw credit numbers.
        if (creditBalance && organizationEntities.length > 1) {
          let totalAvailable = 0;
          for (const entity of organizationEntities) {
            try {
              const [entityCredits] = await db
                .select({ available: credits.availableCredits })
                .from(credits)
                .where(and(
                  eq(credits.tenantId, tenantId),
                  eq(credits.entityId, entity.entityId)
                ))
                .limit(1);
              if (entityCredits) {
                totalAvailable += parseFloat(String(entityCredits.available ?? 0));
              }
            } catch {
              // skip entities we can't read
            }
          }

          // Override the single-entity balance with the tenant-wide total.
          // Keep the subscription metadata (plan, expiry, alerts) from the primary org.
          creditBalance.availableCredits = totalAvailable;

          // Re-categorize: freeCredits = totalAvailable minus paid/seasonal
          // (paid and seasonal are already computed correctly from transactions/batches)
          const paidCredits = creditBalance.paidCredits ?? 0;
          const seasonalCredits = creditBalance.seasonalCredits ?? 0;
          const categorized = paidCredits + seasonalCredits;
          creditBalance.freeCredits = Math.max(0, totalAvailable - categorized);

          Logger.log('info', 'billing', 'get-credit-balance', 'Aggregated balance across entities', { entityCount: organizationEntities.length, totalAvailable });
        }

        Logger.log('info', 'billing', 'get-credit-balance', 'Final credit balance resolved', { availableCredits: creditBalance?.availableCredits });
      } else {
        Logger.log('warning', 'billing', 'get-credit-balance', 'No organization entities found for tenant');
      }

      if (!creditBalance) {
        // Return default credit balance for new users
        const defaultEntityId = organizationEntities.length > 0 ? organizationEntities[0].entityId : tenantId;
        return {
          success: true,
          data: {
            tenantId,
            entityId: defaultEntityId,
            availableCredits: 0,
            freeCredits: 0,
            paidCredits: 0,
            seasonalCredits: 0,
            reservedCredits: 0,
            lowBalanceThreshold: 100,
            criticalBalanceThreshold: 10,
            plan: 'credit_based',
            status: 'no_credits',
            creditExpiry: null,
            freeCreditsExpiry: null,
            paidCreditsExpiry: null,
            seasonalCreditsExpiry: null,
            usageThisPeriod: 0,
            periodLimit: 0,
            periodType: 'month',
            alerts: [{
              id: 'no_credit_record',
              type: 'no_credit_record',
              severity: 'info',
              title: 'No Credit Record',
              message: 'This entity does not have a credit record yet',
              threshold: 0,
              currentValue: 0,
              actionRequired: 'initialize_credits'
            }]
          }
        };
      }

      return {
        success: true,
        data: creditBalance
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'get-credit-balance', 'Error fetching current credit balance', { error: error.message });
      request.log.error(error, 'Error fetching current credit balance:');
      const errorMessage = error.message || 'Unknown error';
      const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
      
      return reply.code(500).send({ 
        error: 'Failed to fetch credit balance',
        message: errorMessage,
        ...(errorStack && { stack: errorStack })
      });
    }
  });

  // Get credit balances for ALL entities in the tenant (for billing Credit Expiry tab)
  fastify.get('/entity-balances', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userContext = request.userContext as { tenantId: string | null };
      const tenantId = userContext.tenantId;
      if (!tenantId) {
        return reply.code(400).send({ success: false, error: 'No tenant' });
      }

      // Fetch all org entities and left-join their credit balances
      const rows = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          entityLevel: entities.entityLevel,
          parentEntityId: entities.parentEntityId,
          availableCredits: credits.availableCredits,
        })
        .from(entities)
        .leftJoin(credits, and(
          eq(credits.entityId, entities.entityId),
          eq(credits.tenantId, entities.tenantId)
        ))
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.entityType, 'organization'),
          eq(entities.isActive, true)
        ))
        .orderBy(asc(entities.entityLevel), asc(entities.createdAt));

      const result = rows.map(r => ({
        entityId: r.entityId,
        entityName: r.entityName,
        entityType: r.entityType,
        entityLevel: r.entityLevel,
        parentEntityId: r.parentEntityId,
        availableCredits: parseFloat(String(r.availableCredits ?? 0)),
      }));

      return { success: true, data: result };
    } catch (err: unknown) {
      Logger.log('error', 'billing', 'get-entity-balances', 'Error fetching entity balances', { error: (err as Error).message });
      return reply.code(500).send({ success: false, error: 'Failed to fetch entity balances' });
    }
  });

  // Get credit transaction history
  fastify.get('/transactions', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string | undefined>;
      const { page = 1, limit = 50, type, startDate, endDate } = query;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Organization', 'User is not associated with any organization');
      }

      const transactions = await CreditService.getTransactionHistory(tenantId, {
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        type,
        startDate,
        endDate
      });

      return {
        success: true,
        data: transactions
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching credit transactions:');
      return reply.code(500).send({ error: 'Failed to fetch credit transactions' });
    }
  });

  // Get credit alerts/notifications
  fastify.get('/alerts', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Organization', 'User is not associated with any organization');
      }

      // Alert system removed in CreditService - return empty array
      const alerts: unknown[] = [];

      return {
        success: true,
        data: alerts
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching credit alerts:');
      return reply.code(500).send({ error: 'Failed to fetch credit alerts' });
    }
  });

  // ── Credit pricing info ────────────────────────────────────────────────
  fastify.get('/pricing', {
    preHandler: authenticateToken,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { getOperationConfig } = await import('../services/credit-config-global.js');

      let unitPrice = parseFloat(process.env.CREDIT_UNIT_PRICE || '0.001');
      try {
        const config = await getOperationConfig('system.credit_purchase_rate');
        if (config?.creditCost && !config.isDefault) {
          const price = parseFloat(String(config.creditCost));
          if (price > 0) unitPrice = price;
        }
      } catch { /* use default */ }

      const minChargeUsd = 0.50;
      const minCredits = Math.ceil(minChargeUsd / unitPrice);

      return reply.send({
        success: true,
        data: {
          unitPrice,
          creditsPerDollar: Math.round(1 / unitPrice),
          currency: 'USD',
          minimumCredits: minCredits,
          minimumCharge: minChargeUsd,
          presets: [1000, 5000, 10000, 25000, 50000, 100000],
        },
      });
    } catch (err: unknown) {
      const error = err as Error;
      _request.log.error(error, 'Error fetching credit pricing');
      return reply.code(500).send({ success: false, error: 'Failed to fetch credit pricing' });
    }
  });

  // Purchase credits
  fastify.post('/purchase', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { creditAmount, paymentMethod, currency = 'USD', notes, entityType = 'organization', entityId } = body;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;
      const internalUserId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).internalUserId ?? (request.userContext as { userId: string }).userId;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization to purchase credits'
        });
      }

      Logger.log('info', 'billing', 'purchase-credits', 'Credit purchase requested', { tenantId, creditAmount, paymentMethod, currency });

      const result = await CreditService.purchaseCredits({
        tenantId,
        userId: internalUserId,
        creditAmount: parseInt(String(creditAmount)),
        paymentMethod: paymentMethod as string,
        currency: currency as string,
        notes: notes as string | undefined,
        entityType: entityType as string,
        entityId: entityId as string | undefined
      });

      // Log successful credit purchase initiation
      try {
        const ActivityLogger = (await import('../../../services/activityLogger.js')).default;
        const requestContext = ActivityLogger.createRequestContext(request as unknown as Record<string, unknown>);
        await ActivityLogger.logActivity(
          internalUserId,
          tenantId,
          null,
          'credit.purchase_success',
          {
            creditAmount: parseInt(String(creditAmount)),
            paymentMethod,
            currency,
            purchaseId: result.purchaseId,
            sessionId: result.sessionId,
            entityType,
            entityId
          },
          requestContext
        );
      } catch (logErr: unknown) {
        Logger.log('warning', 'billing', 'purchase-credits', 'Failed to log credit purchase activity', { error: (logErr as Error).message });
      }

      return {
        success: true,
        data: result,
        message: 'Credit purchase initiated successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error processing credit purchase:');
      const body = request.body as Record<string, unknown> | undefined;
      const uc = request.userContext as { userId?: string; tenantId?: string | null; internalUserId?: string } | undefined;
      try {
        const ActivityLogger = (await import('../../../services/activityLogger.js')).default;
        const requestContext = ActivityLogger.createRequestContext(request as unknown as Record<string, unknown>);
        await ActivityLogger.logActivity(
          (uc?.internalUserId ?? uc?.userId) as string,
          uc?.tenantId ?? '',
          null,
          'credit.purchase_failed',
          {
            error: error.message,
            creditAmount: body?.creditAmount,
            paymentMethod: body?.paymentMethod,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          requestContext
        );
      } catch (logErr: unknown) {
        Logger.log('warning', 'billing', 'purchase-credits', 'Failed to log credit purchase failure activity', { error: (logErr as Error).message });
      }
      return reply.code(500).send({
        error: 'Failed to process credit purchase',
        message: error.message
      });
    }
  });

  // Consume credits (for operations)
  // REMOVED: validateApplicationCreditAllocation, autoReplenishApplicationCredits, validateCreditConsumption - Applications manage their own credits
  // Credit validation is handled by CreditService.consumeCredits() in the route handler
  fastify.post('/consume', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { operationCode, creditCost, operationId, description, metadata, entityType = 'organization', entityId } = body;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;
      const userId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).userId;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      const uid: string = userId ?? '';
      const result = await CreditService.consumeCredits({
        tenantId: tenantId!,
        userId: uid!,
        operationCode: operationCode as string,
        creditCost: parseFloat(String(creditCost)),
        operationId: (operationId as string | undefined) ?? '',
        description: description as string | undefined,
        metadata: metadata as Record<string, unknown> | undefined,
        entityType: entityType as string,
        entityId: entityId as string | undefined
      });

      if (!result.success) {
        return reply.code(402).send({
          error: 'Insufficient credits',
          message: result.message,
          data: result.data
        });
      }

      return {
        success: true,
        data: result.data,
        message: 'Credits consumed successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error consuming credits:');
      return reply.code(500).send({
        error: 'Failed to consume credits',
        message: error.message
      });
    }
  });

  // Get credit usage summary
  fastify.get('/usage-summary', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string | undefined>;
      const { period = 'month', startDate, endDate } = query;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Organization', 'User is not associated with any organization');
      }

      const summary = await CreditService.getUsageSummary(tenantId!, {
        period: period as string,
        startDate,
        endDate
      });

      return {
        success: true,
        data: summary
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching credit usage summary:');
      return reply.code(500).send({ error: 'Failed to fetch usage summary' });
    }
  });

  // Transfer credits between entities
  fastify.post('/transfer', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.CREDITS_BALANCE_TRANSFER)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { fromEntityId, toEntityType, toEntityId, creditAmount, reason } = body;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;
      const internalUserId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).internalUserId ?? (request.userContext as { userId: string }).userId;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      // Find the source entity that has credits
      let sourceEntityId = fromEntityId;

      if (!sourceEntityId) {
        // If no source entity specified, find the entity that has credits
        Logger.log('info', 'billing', 'transfer-credits', 'Finding source entity with credits for tenant', { tenantId });

        const organizationEntities = await db
          .select({
            entityId: entities.entityId,
            entityName: entities.entityName,
            entityLevel: entities.entityLevel,
          })
          .from(entities)
          .where(and(
            eq(entities.tenantId, tenantId),
            eq(entities.entityType, 'organization'),
            eq(entities.isActive, true)
          ))
          .orderBy(asc(entities.entityLevel), asc(entities.createdAt));

        if (organizationEntities.length > 0) {
          // Try to find credits on any organization entity for this tenant
          const primaryEntity = organizationEntities[0];
          const entitiesToCheck = organizationEntities;

          for (const entity of entitiesToCheck) {
            Logger.log('info', 'billing', 'transfer-credits', 'Checking credits for entity', { entityId: entity.entityId, entityName: entity.entityName });

            const entityCreditBalance = await CreditService.getCurrentBalance(tenantId, 'organization', entity.entityId);

            // If we found credits (not the default "no credits" response), use this as source
            if (entityCreditBalance && entityCreditBalance.availableCredits > 0) {
              Logger.log('info', 'billing', 'transfer-credits', 'Found credits on entity', { entityId: entity.entityId, entityName: entity.entityName });
              sourceEntityId = entity.entityId;
              break; // Use the first entity that has credits
            }
          }

          // If no entity has credits, use the default entity as fallback
          if (!sourceEntityId) {
            if (primaryEntity) {
              Logger.log('warning', 'billing', 'transfer-credits', 'No credits found, using primary entity as source', { entityId: primaryEntity.entityId });
              sourceEntityId = primaryEntity.entityId;
            } else {
              Logger.log('warning', 'billing', 'transfer-credits', 'No credits found, using first entity as source', { entityId: organizationEntities[0].entityId });
              sourceEntityId = organizationEntities[0].entityId;
            }
          }
        } else {
          return reply.code(400).send({
            error: 'No source entity found',
            message: 'No organization entities found for this tenant'
          });
        }
      }

      if (!sourceEntityId) {
        return reply.code(400).send({
          error: 'No source entity with credits',
          message: 'Could not find a source entity with available credits'
        });
      }

      Logger.log('info', 'billing', 'transfer-credits', 'Transferring credits between entities', { fromEntityId: sourceEntityId, toEntityId });

      const result = await CreditService.transferCredits({
        fromTenantId: String(sourceEntityId),
        toEntityType: toEntityType as string,
        toEntityId: toEntityId as string,
        creditAmount: parseFloat(String(creditAmount)),
        initiatedBy: internalUserId,
        reason: reason as string | undefined
      });

      if (!result.success) {
        return reply.code(400).send({
          error: 'Transfer failed',
          message: result.message
        });
      }

      return {
        success: true,
        data: result.data,
        message: 'Credits transferred successfully'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error transferring credits:');
      return reply.code(500).send({
        error: 'Failed to transfer credits',
        message: error.message
      });
    }
  });

  // Get effective credit configuration for operations (tenant-specific → global → default)
  fastify.get('/config/:operationCode', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { operationCode } = params;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;

      const config = await CreditService.getOperationConfig(operationCode, tenantId ?? null);

      return {
        success: true,
        data: config
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching credit configuration:');
      return reply.code(500).send({ error: 'Failed to fetch credit configuration' });
    }
  });

  // Get effective module credit configuration (tenant-specific → global → default)
  fastify.get('/config/module/:moduleCode', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { moduleCode } = params;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;

      const config = await CreditService.getModuleConfig(moduleCode, tenantId ?? null);

      return {
        success: true,
        data: config
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching module configuration:');
      return reply.code(500).send({ error: 'Failed to fetch module configuration' });
    }
  });

  // Get effective application credit configuration (tenant-specific → global → default)
  fastify.get('/config/app/:appCode', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const appCode = params.appCode;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId; // May be null for users without tenant association

      const config = await CreditService.getAppConfig(appCode, tenantId);

      return {
        success: true,
        data: config
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching application configuration:');
      return reply.code(500).send({ error: 'Failed to fetch application configuration' });
    }
  });

  // Get all global credit configurations (public - any authenticated user)
  fastify.get('/configurations', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, unknown>;
      const { isActive } = query;

      const configurations = await CreditService.getAllConfigurations({
        isActive: isActive as boolean | undefined
      });

      return {
        success: true,
        data: configurations
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching global configurations:');
      return reply.code(500).send({ error: 'Failed to fetch configurations' });
    }
  });

  // Set operation configuration (global or tenant-specific, company admin only)
  fastify.post('/config/operation/:operationCode', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { operationCode } = params;
      const configData = request.body as Record<string, unknown>;
      const userId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).userId;
      const tenantId = (configData.tenantId as string) || null;

      const result = await CreditService.setOperationConfig(operationCode, configData, userId, tenantId);

      const configType = tenantId ? 'tenant-specific' : 'global';
      return {
        success: true,
        data: result,
        message: `${configType} operation configuration updated successfully`
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error setting operation configuration:');
      return reply.code(500).send({ error: 'Failed to update operation configuration' });
    }
  });

  // Set module configuration (global or tenant-specific, company admin only)
  fastify.post('/config/module/:moduleCode', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { moduleCode } = params;
      const configData = request.body as Record<string, unknown>;
      const userId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).userId;
      const tenantId = (configData.tenantId as string) || null;

      const result = await CreditService.setModuleConfig(moduleCode, configData, userId, tenantId);

      const configType = tenantId ? 'tenant-specific' : 'global';
      return {
        success: true,
        data: result,
        message: `${configType} module configuration updated successfully`
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error setting module configuration:');
      return reply.code(500).send({ error: 'Failed to update module configuration' });
    }
  });

  // Set application configuration (global or tenant-specific, company admin only)
  fastify.post('/config/app/:appCode', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { appCode } = params;
      const configData = request.body as Record<string, unknown>;
      const userId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).userId;
      const tenantId = (configData.tenantId as string) || null;

      const result = await CreditService.setAppConfig(appCode, configData, userId, tenantId);

      const configType = tenantId ? 'tenant-specific' : 'global';
      return {
        success: true,
        data: result,
        message: `${configType} application configuration updated successfully`
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error setting application configuration:');
      return reply.code(500).send({ error: 'Failed to update application configuration' });
    }
  });

  // Mark alert as read (alert system removed in CreditService - no-op)
  fastify.put('/alerts/:alertId/read', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Organization', 'User is not associated with any organization');
      }

      // markAlertAsRead removed in CreditService - no-op

      return {
        success: true,
        message: 'Alert marked as read'
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error marking alert as read:');
      return reply.code(500).send({ error: 'Failed to mark alert as read' });
    }
  });

  // Get credit packages available for purchase
  fastify.get('/packages', async (request, reply) => {
    try {
      const packages = await CreditService.getAvailablePackages();

      return {
        success: true,
        data: packages
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching credit packages:');
      return reply.code(500).send({ error: 'Failed to fetch credit packages' });
    }
  });

  // ===============================
  // APPLICATION CREDIT ALLOCATION ROUTE
  // ===============================
  fastify.post('/allocate/application', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId, internalUserId } = request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string };

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Organization', 'User is not associated with any organization');
      }

      const body = (request.body as Record<string, unknown>) || {};
      const { sourceEntityId, targetApplication, creditAmount, allocationPurpose } = body;

      if (!sourceEntityId || !targetApplication || !creditAmount) {
        return reply.code(400).send({
          success: false,
          message: 'Missing required fields: sourceEntityId, targetApplication, and creditAmount are required'
        });
      }

      if (Number(creditAmount) <= 0) {
        return reply.code(400).send({
          success: false,
          message: 'creditAmount must be a positive number'
        });
      }

      const result = await CreditService.allocateCreditsToApplication({
        tenantId,
        sourceEntityId: sourceEntityId as string,
        targetApplication: targetApplication as string,
        creditAmount: parseFloat(String(creditAmount)),
        allocationPurpose: (allocationPurpose as string) || '',
        initiatedBy: internalUserId ?? null
      });

      return {
        success: true,
        message: `Successfully allocated ${creditAmount} credits to ${targetApplication}`,
        data: result
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error allocating credits to application:');

      if (error.message?.includes('Insufficient credits')) {
        return reply.code(400).send({
          success: false,
          message: error.message
        });
      }

      if (error.message?.includes('No credit record found')) {
        return reply.code(404).send({
          success: false,
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to allocate credits to application'
      });
    }
  });

  // Get credit balance monitor status (admin only)
  fastify.get('/monitor-status', {
    preHandler: [authenticateToken, requirePermission(PERMISSIONS.ADMIN_CREDITS_MANAGE)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Stub: credit-balance-monitor module not present in this codebase
      const status: Record<string, unknown> = {};

      return {
        success: true,
        data: status
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching monitor status:');
      return reply.code(500).send({
        error: 'Failed to fetch monitor status',
        message: error.message
      });
    }
  });

  // Get credit statistics for dashboard
  fastify.get('/stats', {
    preHandler: authenticateToken
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;

      if (!tenantId) {
        return ErrorResponses.notFound(reply, 'Organization', 'User is not associated with any organization');
      }

      const stats = await CreditService.getCreditStats(tenantId);

      return {
        success: true,
        data: stats
      };
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error fetching credit statistics:');
      return reply.code(500).send({ error: 'Failed to fetch credit statistics' });
    }
  });

  // Get detailed credit purchase payment information by sessionId
  fastify.get('/payment/:identifier', {
    preHandler: authenticateToken,
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const { identifier } = params;
      const tenantId = (request.userContext as { userId: string; tenantId?: string | null; internalUserId?: string }).tenantId;

      if (!tenantId) {
        return reply.code(400).send({
          error: 'No organization found',
          message: 'User must be associated with an organization'
        });
      }

      let payment;
      let stripeSession = null;
      let paymentMethodDetails = {};

      try {
        // Check if identifier is a valid UUID (purchaseId)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);

        if (isUUID) {
          // Try to find by purchaseId first (if it's a UUID)
          let [purchaseById] = await db
            .select()
            .from(creditPurchases)
            .where(and(
              eq(creditPurchases.purchaseId, identifier),
              eq(creditPurchases.tenantId, tenantId)
            ))
            .limit(1);

          if (purchaseById) {
            payment = purchaseById;
          }
        }

        // If not found by purchaseId or identifier is not a UUID, try by Stripe payment intent ID
        if (!payment) {
          let [purchaseByIntent] = await db
            .select()
            .from(creditPurchases)
            .where(and(
              eq(creditPurchases.stripePaymentIntentId, identifier),
              eq(creditPurchases.tenantId, tenantId)
            ))
            .limit(1);

          if (purchaseByIntent) {
            payment = purchaseByIntent;
          }
        }

        // Also try by Stripe checkout session ID - need to get payment intent from Stripe first
        if (!payment && (identifier.startsWith('cs_test_') || identifier.startsWith('cs_live_'))) {
          try {
            // Import Stripe to get payment intent from checkout session
            const Stripe = (await import('stripe')).default;
            if (process.env.STRIPE_SECRET_KEY) {
              const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                timeout: Number(process.env.STRIPE_TIMEOUT_MS ?? 10_000)
              });
              stripeSession = await stripe.checkout.sessions.retrieve(identifier, {
                expand: ['payment_intent.payment_method']
              });
              
              if (stripeSession.payment_intent) {
                let [purchaseByIntent] = await db
                  .select()
                  .from(creditPurchases)
                  .where(and(
                    eq(creditPurchases.stripePaymentIntentId, typeof stripeSession.payment_intent === 'string' 
                      ? stripeSession.payment_intent 
                      : stripeSession.payment_intent.id),
                    eq(creditPurchases.tenantId, tenantId)
                  ))
                  .limit(1);

                if (purchaseByIntent) {
                  payment = purchaseByIntent;
                }

                // Fetch payment method details from Stripe
                try {
                  const paymentIntent = typeof stripeSession.payment_intent === 'string'
                    ? await stripe.paymentIntents.retrieve(stripeSession.payment_intent, {
                        expand: ['payment_method']
                      })
                    : stripeSession.payment_intent;

                  if (paymentIntent.payment_method) {
                    const pm = typeof paymentIntent.payment_method === 'string'
                      ? await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
                      : paymentIntent.payment_method;
                    
                    if (pm.card) {
                      paymentMethodDetails = {
                        card: {
                          brand: pm.card.brand,
                          last4: pm.card.last4,
                          exp_month: pm.card.exp_month,
                          exp_year: pm.card.exp_year
                        }
                      };
                    }
                  }
                } catch (pmError: unknown) {
                  Logger.log('warning', 'billing', 'get-credit-payment', 'Could not fetch payment method details', { error: (pmError as Error).message });
                }
              }
            }
          } catch (stripeError: unknown) {
            Logger.log('warning', 'billing', 'get-credit-payment', 'Could not retrieve Stripe session', { error: (stripeError as Error).message });
            // Continue to return 404 if not found
          }
        }
      } catch (dbError: unknown) {
        Logger.log('error', 'database', 'get-credit-payment', 'Database error in credit payment lookup', { error: (dbError as Error).message });
        return reply.code(500).send({
          error: 'Database error',
          message: 'Failed to query credit payment records'
        });
      }

      if (!payment) {
        // Check if this is a checkout session that hasn't completed yet
        if (identifier.startsWith('cs_test_') || identifier.startsWith('cs_live_')) {
          return reply.code(404).send({
            error: 'Payment not found',
            message: 'Checkout session found but payment has not been completed yet. Please complete the payment process.',
            code: 'PAYMENT_PENDING'
          });
        }

        return ErrorResponses.notFound(reply, 'Credit Payment', 'Credit payment not found or does not belong to your organization');
      }

      try {
        // Try to get payment method details from payments table
        let paymentMethodDetailsFromDB = {};
        try {
          const { payments } = await import('../../../db/schema/billing/subscriptions.js');
          const { eq, and } = await import('drizzle-orm');
          const stripeId: string = String((payment as Record<string, unknown>).stripePaymentIntentId ?? (typeof identifier === 'string' ? identifier : (identifier as string[])[0] ?? ''));
          const tenantIdStr: string = String(tenantId ?? '');
          const [paymentRecord] = await db
            .select()
            .from(payments)
            .where(and(
              eq(payments.stripePaymentIntentId, stripeId as string),
              eq(payments.tenantId, tenantIdStr as string),
              eq(payments.paymentType, 'credit_purchase')
            ))
            .limit(1);
          
          if (paymentRecord?.paymentMethodDetails) {
            paymentMethodDetailsFromDB = paymentRecord.paymentMethodDetails;
          }
        } catch (dbError: unknown) {
          Logger.log('warning', 'database', 'get-credit-payment', 'Could not fetch payment record', { error: (dbError as Error).message });
        }

        // Use payment method details from DB if available, otherwise use Stripe fetch
        const finalPaymentMethodDetails = Object.keys(paymentMethodDetailsFromDB).length > 0 
          ? paymentMethodDetailsFromDB 
          : paymentMethodDetails;

        // Get credit details and current balance using CreditService
        const creditBalance = await CreditService.getCurrentBalance(tenantId as string);
        
        // Calculate credits added in this transaction
        const creditsAdded = parseFloat(String(payment.creditAmount ?? 0));
        const totalAmount = parseFloat(String(payment.totalAmount ?? 0));
        
        // Calculate credit details from balance
        const availableCredits = parseFloat(String(creditBalance?.availableCredits ?? 0));
        const reservedCredits = parseFloat(String(creditBalance?.reservedCredits ?? 0));
        
        // Check if payment has been processed (credits added)
        const isProcessed = payment.status === 'completed' || payment.creditedAt;
        
        // For display purposes, treat all available credits as paid credits (since we don't track free vs paid separately in simplified schema)
        // If payment is pending, show what the balance will be after processing
        const finalAvailableCredits = isProcessed ? availableCredits : (availableCredits + creditsAdded);
        
        const creditDetails = {
          freeCredits: 0, // Not tracked in simplified schema
          paidCredits: finalAvailableCredits, // All available credits are considered paid
          freeCreditsExpiry: creditBalance?.freeCreditsExpiry || null,
          paidCreditsExpiry: creditBalance?.paidCreditsExpiry || null,
          totalCredits: finalAvailableCredits,
          availableCredits: finalAvailableCredits,
          reservedCredits: reservedCredits
        };

        // Return data in the format expected by PaymentSuccess component
        return {
          success: true,
          data: {
            sessionId: identifier, // Use the identifier (checkout session ID) passed in
            transactionId: payment.purchaseId,
            amount: totalAmount,
            currency: 'USD',
            planId: 'credit-purchase',
            planName: 'Credit Purchase',
            billingCycle: 'one-time',
            paymentMethod: payment.paymentMethod || 'card',
            paymentMethodDetails: finalPaymentMethodDetails,
            status: payment.status || 'completed',
            createdAt: payment.createdAt || payment.requestedAt,
            processedAt: payment.creditedAt || payment.paidAt || payment.createdAt,
            description: `Credit purchase: ${creditsAdded.toLocaleString()} credits for $${totalAmount.toFixed(2)}`,
            subscription: null, // Credit purchases don't have subscriptions
            features: [
              `${creditsAdded.toLocaleString()} credits added to account`,
              'Credits expire with subscription plan',
              'Use across all applications'
            ],
            credits: creditsAdded,
            // Additional credit-specific fields
            creditsAdded: creditsAdded,
            creditDetails: creditDetails,
            creditBalance: {
              freeCredits: creditDetails.freeCredits,
              paidCredits: creditDetails.paidCredits,
              totalCredits: creditDetails.totalCredits,
              availableCredits: creditDetails.availableCredits,
              reservedCredits: creditDetails.reservedCredits
            },
            // Include full balance object for compatibility
            balance: creditBalance,
            // Include Stripe raw data for frontend extraction
            stripeRawData: stripeSession || {}
          }
        };
      } catch (error: unknown) {
        const err = error as Error;
        request.log.error(err, 'Error fetching credit payment details:');
        return reply.code(500).send({
          error: 'Failed to fetch credit payment details',
          message: err.message
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(error, 'Error in credit payment details route:');
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to process credit payment details request'
      });
    }
  });

  // Stripe webhook for credit purchase completion
  fastify.post('/webhook', {
    // Webhook endpoint should be public and handle raw body
    preHandler: (request, reply, done) => {
      // Stripe webhooks require raw body, not parsed JSON
      const req = request as FastifyRequest & { rawBody?: Buffer | string };
      if (request.headers['content-type'] === 'application/json') {
        (req as { rawBody?: Buffer | string }).rawBody = JSON.stringify(request.body);
      } else {
        (req as { rawBody?: Buffer | string }).rawBody = request.body as Buffer;
      }
      done();
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    Logger.log('info', 'billing', 'credit-webhook', 'Credit webhook endpoint hit');

    try {

      const signature = request.headers['stripe-signature'];
      const rawBodyRaw = (request as FastifyRequest & { rawBody?: Buffer | string }).rawBody;
      const rawBodyStr = rawBodyRaw == null ? '' : (Buffer.isBuffer(rawBodyRaw) ? rawBodyRaw.toString() : String(rawBodyRaw));

      Logger.log('info', 'billing', 'credit-webhook', 'Credit purchase webhook received', {
        contentType: request.headers['content-type'],
        hasSignature: !!signature,
        rawBodyLength: rawBodyStr ? rawBodyStr.length : 0
      });

      // Verify Stripe webhook signature — always required
      let event: { id: string; type: string; data: { object: unknown }; created: number };
      try {
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
          throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
        }
        if (!signature) {
          throw new Error('Missing stripe-signature header');
        }

        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          timeout: Number(process.env.STRIPE_TIMEOUT_MS ?? 10_000)
        });
        event = stripe.webhooks.constructEvent(rawBodyStr, signature, process.env.STRIPE_WEBHOOK_SECRET) as typeof event;
        Logger.log('info', 'billing', 'credit-webhook', 'Webhook signature verified');
      } catch (error: unknown) {
        Logger.log('error', 'billing', 'credit-webhook', 'Webhook verification failed', { error: (error as Error).message });
        return reply.code(400).send({ error: 'Webhook verification failed' });
      }

      Logger.log('info', 'billing', 'credit-webhook', 'Processing webhook event', { eventType: event.type, eventId: event.id });

      // Idempotency check — skip already-processed events
      try {
        const [existing] = await db
          .select({ id: eventTracking.id })
          .from(eventTracking)
          .where(eq(eventTracking.eventId, event.id))
          .limit(1);
        if (existing) {
          Logger.log('info', 'billing', 'credit-webhook', 'Skipping already-processed webhook event', { eventId: event.id });
          return reply.code(200).send({ received: true, duplicate: true });
        }
      } catch (dedupeErr) {
        Logger.log('warning', 'billing', 'credit-webhook', 'Idempotency check failed, proceeding with processing', { error: (dedupeErr as Error).message });
      }

      // Handle credit purchase completion
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as { id: string; payment_status?: string; amount_total?: number; payment_intent?: string; metadata?: Record<string, unknown>; customer?: string; currency?: string };

        Logger.log('info', 'billing', 'credit-webhook', 'Checkout session completed', { sessionId: session.id, paymentStatus: session.payment_status, amount: (session.amount_total ?? 0) / 100 });

        if (session.payment_status === 'paid' && session.metadata?.creditAmount) {

          try {
            // Extract metadata
            const tenantId = session.metadata?.tenantId as string;
            const userId = session.metadata?.userId as string;
            const creditAmount = parseInt(String(session.metadata?.creditAmount ?? 0));
            const entityType = (session.metadata?.entityType as string) || 'organization';
            const entityId = (session.metadata?.entityId as string) || tenantId;

            Logger.log('info', 'billing', 'credit-webhook', 'Credit purchase details', { tenantId, userId, creditAmount, entityType, entityId });

            if (!tenantId || !userId || !creditAmount) {
              Logger.log('error', 'billing', 'credit-webhook', 'Missing required metadata');
              return reply.code(400).send({ error: 'Missing required metadata' });
            }

            // Fetch payment method details from Stripe
            let paymentMethodDetails = {};
            try {
              const Stripe = (await import('stripe')).default;
              if (process.env.STRIPE_SECRET_KEY && session.payment_intent) {
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                  timeout: Number(process.env.STRIPE_TIMEOUT_MS ?? 10_000)
                });
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
                
                if (paymentIntent.payment_method) {
                  const pmId = typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : paymentIntent.payment_method.id;
                  const paymentMethod = await stripe.paymentMethods.retrieve(pmId);
                  if (paymentMethod.card) {
                    paymentMethodDetails = {
                      card: {
                        brand: paymentMethod.card.brand,
                        last4: paymentMethod.card.last4,
                        exp_month: paymentMethod.card.exp_month,
                        exp_year: paymentMethod.card.exp_year
                      }
                    };
                    Logger.log('info', 'billing', 'credit-webhook', 'Payment method details fetched');
                  }
                }
              }
            } catch (stripeError: unknown) {
              Logger.log('warning', 'billing', 'credit-webhook', 'Could not fetch payment method details from Stripe', { error: (stripeError as Error).message });
            }

            // Process the credit purchase
            const purchaseResult = await CreditService.purchaseCredits({
              tenantId: String(tenantId),
              userId: String(userId),
              creditAmount: Number(creditAmount),
              paymentMethod: 'stripe',
              currency: 'USD',
              entityType: String(entityType),
              entityId: String(entityId),
              notes: `Stripe webhook: ${session.id}`,
              paymentMethodDetails: paymentMethodDetails as Record<string, unknown>
            });

            // Create payment record with payment method details
            try {
              const { PaymentService } = await import('../../subscriptions/services/payment-service.js');
              const totalAmount = parseFloat(String(session.metadata?.totalAmount ?? (session.amount_total ?? 0) / 100));
              
              await PaymentService.recordPayment({
                tenantId: String(tenantId),
                stripePaymentIntentId: String(session.payment_intent || session.id),
                stripeCustomerId: session.customer as string,
                amount: totalAmount.toString(),
                currency: String(session.currency || 'USD').toUpperCase(),
                status: 'succeeded',
                paymentMethod: 'card',
                paymentMethodDetails: paymentMethodDetails,
                paymentType: 'credit_purchase',
                description: `Credit purchase: ${creditAmount.toLocaleString()} credits for $${totalAmount.toFixed(2)}`,
                metadata: {
                  stripeCheckoutSessionId: session.id,
                  creditAmount: creditAmount.toString(),
                  purchaseId: purchaseResult.purchaseId,
                  entityType: String(entityType),
                  entityId: String(entityId),
                  ...(session.metadata as Record<string, unknown>)
                },
                stripeRawData: session as Record<string, unknown>,
                paidAt: new Date()
              });
              Logger.log('info', 'billing', 'credit-webhook', 'Payment record created with payment method details');
            } catch (paymentRecordError: unknown) {
              Logger.log('warning', 'billing', 'credit-webhook', 'Could not create payment record', { error: (paymentRecordError as Error).message });
            }

            Logger.log('info', 'billing', 'credit-webhook', 'Credit purchase processed', { purchaseId: purchaseResult.purchaseId, creditsAllocated: creditAmount });

            // Record processed event for idempotency
            try {
              await db.insert(eventTracking).values({
                eventId: event.id,
                eventType: event.type,
                tenantId: tenantId,
                streamKey: 'stripe-credit-webhook',
                sourceApplication: 'stripe',
                targetApplication: 'wrapper-backend',
                eventData: session as Record<string, unknown>,
                status: 'processed',
              });
            } catch (trackErr) {
              Logger.log('warning', 'billing', 'credit-webhook', 'Failed to record webhook event', { error: (trackErr as Error).message });
            }

            return reply.code(200).send({
              success: true,
              message: 'Credit purchase processed successfully',
              purchaseId: purchaseResult.purchaseId,
              creditsAllocated: creditAmount
            });

          } catch (purchaseError: unknown) {
            const pe = purchaseError as Error;
            Logger.log('error', 'billing', 'credit-webhook', 'Credit purchase processing failed', { error: pe.message });

            // Still return 200 to Stripe to prevent retries
            return reply.code(200).send({
              success: false,
              error: 'Credit purchase processing failed',
              message: pe.message
            });
          }
        } else {
          Logger.log('warning', 'billing', 'credit-webhook', 'Payment not completed or not a credit purchase');
          return reply.code(200).send({ message: 'Payment not completed or not a credit purchase' });
        }
      } else {
        Logger.log('info', 'billing', 'credit-webhook', 'Unhandled webhook event type', { eventType: event.type });
        return reply.code(200).send({
          message: 'Event type not handled',
          receivedEventType: event.type,
          expectedEventType: 'checkout.session.completed'
        });
      }

    } catch (error: unknown) {
      const err = error as Error;
      Logger.log('error', 'billing', 'credit-webhook', 'Webhook processing error', { error: err.message });
      // Return 500 for unexpected errors to trigger Stripe retry
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });
}
