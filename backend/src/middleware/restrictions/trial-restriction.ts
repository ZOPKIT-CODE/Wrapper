// import trialManager from '../utils/trial-manager.js'; // Temporarily disabled - file missing
import type { FastifyRequest, FastifyReply } from 'fastify';
import Logger from '../../utils/logger.js';
import { CreditService } from '../../features/credits/index.js';
import { shouldLogVerbose } from '../../utils/verbose-log.js';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { subscriptions } from '../../db/schema/index.js';

// Middleware to check if trial is expired and restrict operations
export async function trialRestrictionMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> {
  // TEMPORARY: Skip all trial restrictions in local development
  if (process.env.NODE_ENV === 'development' || process.env.BYPASS_TRIAL_RESTRICTIONS === 'true') {
    if (shouldLogVerbose()) Logger.log('info', 'restrictions', 'trial-restriction-middleware', '🔓 Trial restriction: BYPASSED for local development');
    return;
  }

  // Skip check for non-authenticated requests
  if (!request.userContext?.tenantId) {
    if (shouldLogVerbose()) Logger.log('info', 'restrictions', 'trial-restriction-middleware', '🔓 Trial restriction: No tenantId, skipping check');
    return;
  }

  // Skip check for auth-related operations during registration
  if (request.url.includes('/auth') || request.url.includes('/onboarding')) {
    if (shouldLogVerbose()) Logger.log('info', 'restrictions', 'trial-restriction-middleware', '🔓 Trial restriction: Auth/onboarding operation, skipping check');
    return;
  }

  // Allow ONLY payment, credit, and auth operations when credits are insufficient
  const allowedPathsForExpired = [
    '/api/subscriptions',
    '/api/payments',
    '/api/credits',
    '/api/billing',
    '/api/webhooks',
    '/api/auth',
    '/api/admin/auth-status',
    '/api/admin/trials', // For admin trial management
    '/health',
    '/docs',
  ];

  // Check if current path is allowed for expired trials
  const isAllowedPath = allowedPathsForExpired.some(path => 
    request.url.startsWith(path)
  );

  if (isAllowedPath) {
    return;
  }

  const criticalEndpoints = [
    '/api/subscriptions/current',
    '/api/admin/auth-status',
    '/api/tenants/current'
  ];
  
  if (criticalEndpoints.some(endpoint => request.url === endpoint)) {
    return;
  }

  const requestId = Logger.generateRequestId('trial-restriction');
  const tenantId = request.userContext.tenantId;

  // ── Canceled subscription check ──────────────────────────────────────────
  // Block write operations for tenants with canceled subscriptions.
  // Read operations (GET/HEAD/OPTIONS) are allowed for read-only access.
  try {
    const [latestSub] = await db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (latestSub?.status === 'canceled') {
      const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

      if (isWriteOperation) {
        // Allow paths needed to resubscribe or manage billing
        const allowedWritePaths = [
          '/api/subscriptions/',
          '/api/auth/',
          '/api/payments/',
          '/api/credits/purchase',
          '/health',
        ];
        const isAllowedWritePath = allowedWritePaths.some(path => request.url.startsWith(path));

        if (!isAllowedWritePath) {
          if (shouldLogVerbose()) {
            Logger.log('info', 'restrictions', 'trial-restriction-middleware', `[${requestId}] Blocked write operation for canceled subscription: ${request.method} ${request.url}`);
          }
          return reply.code(403).send({
            error: 'Subscription expired',
            message: 'Your subscription has expired. Please resubscribe to continue.',
            action: 'resubscribe',
          });
        }
      }

      // GET/HEAD/OPTIONS pass through — read-only access allowed
    }
  } catch (subErr: unknown) {
    // Non-blocking: if subscription check fails, continue to credit check
    Logger.log('error', 'database', requestId, 'Subscription status check failed', { error: (subErr as Error).message });
  }

  try {
    const creditBalance = await CreditService.getCurrentBalance(tenantId);

    const balanceWithTotal = creditBalance as (typeof creditBalance & { totalCredits?: number }) | null;

    const isCreditInsufficient = !creditBalance || creditBalance.availableCredits <= (creditBalance.criticalBalanceThreshold || 10);

    if (isCreditInsufficient) {
      if (shouldLogVerbose()) {
        Logger.log('info', 'restrictions', 'trial-restriction-middleware', `[${requestId}] Insufficient credits for tenant ${tenantId}: ${creditBalance?.availableCredits || 0} available`);
      }

      // Calculate credit shortage
      const criticalThreshold = creditBalance?.criticalBalanceThreshold || 10;
      const availableCredits = creditBalance?.availableCredits || 0;
      const shortage = Math.max(0, criticalThreshold - availableCredits);

      let restrictionMessage = shortage > 0
        ? `Your credit balance is insufficient (short by ${shortage} credits). Please purchase more credits to continue using the service.`
        : 'Your credit balance is insufficient. Please purchase more credits to continue using the service.';

      // Determine the type of operation being blocked
      let operationType = 'operation';
      let specificMessage = restrictionMessage;

      // More specific messages based on what they're trying to access
      if (request.url.includes('/users') || request.url.includes('/admin')) {
        operationType = 'user management';
      } else if (request.url.includes('/roles') || request.url.includes('/permissions')) {
        operationType = 'role management';
      } else if (request.url.includes('/analytics') || request.url.includes('/usage') || request.url.includes('/dashboard')) {
        operationType = 'dashboard and analytics';
      } else if (request.url.includes('/tenants') || request.url.includes('/organizations')) {
        operationType = 'organization management';
      } else if (request.url.includes('/api/')) {
        operationType = 'API access';
      } else if (request.method === 'GET') {
        operationType = 'data access';
      } else {
        operationType = 'feature access';
      }

      // Show immediate banner in response - return 200 to avoid HTTP errors
      return reply.code(200).send({
        success: false,
        error: 'Insufficient Credits',
        message: specificMessage,
        code: 'CREDIT_INSUFFICIENT',
        operationType,
        data: {
          creditBalance: availableCredits,
          criticalThreshold: criticalThreshold,
          shortage: shortage,
          availableCredits,
          totalCredits: balanceWithTotal?.totalCredits ?? 0,
          creditExpiry: creditBalance?.creditExpiry,
          reason: 'insufficient_credits',
          plan: 'credit_based',
          isCreditInsufficient: true,
          allowedOperations: ['payments', 'credits', 'billing'],
          purchaseUrl: '/api/credits/purchase',
          billingUrl: '/billing',
          blockedOperation: {
            url: request.url,
            method: request.method,
            type: operationType
          }
        },
        requestId,
        // For frontend to show immediate banner/modal
        isCreditInsufficient: true,
        showPurchasePrompt: true,
        blockAppLoading: false, // Don't block app loading for credit issues
        immediate: true, // Show banner immediately
        // Add this to indicate the response is for credit insufficiency
        creditExpired: true
      });
    }

    if (shouldLogVerbose()) {
      Logger.log('info', 'restrictions', 'trial-restriction-middleware', `[${requestId}] Credits OK: ${creditBalance?.availableCredits || 0} available`);
    }

  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    Logger.log('error', 'billing', requestId, 'Credit balance check failed', { error: error.message });

    // If it's a database connection error or critical error, we might want to block
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return reply.code(503).send({
        success: false,
        error: 'Service temporarily unavailable',
        message: 'Database connection failed. Please try again later.'
      });
    }
  }
}

// Export for use in routes that need trial checking
export async function checkTrialStatus(_tenantId: string): Promise<{ isExpired: boolean; hasRestrictions: boolean }> {
  // Temporarily disabled - trialManager file missing
  // return await trialManager.isTrialExpired(tenantId);
  return { isExpired: false, hasRestrictions: false }; // Stub implementation
} 