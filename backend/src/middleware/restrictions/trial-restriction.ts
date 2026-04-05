// import trialManager from '../utils/trial-manager.js'; // Temporarily disabled - file missing
import type { FastifyRequest, FastifyReply } from 'fastify';
import Logger from '../../utils/logger.js';
import { CreditService } from '../../features/credits/index.js';
import { shouldLogVerbose } from '../../utils/verbose-log.js';

// Middleware to check if trial is expired and restrict operations
export async function trialRestrictionMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> {
  // TEMPORARY: Skip all trial restrictions in local development
  if (process.env.NODE_ENV === 'development' || process.env.BYPASS_TRIAL_RESTRICTIONS === 'true') {
    if (shouldLogVerbose()) console.log('🔓 Trial restriction: BYPASSED for local development');
    return;
  }

  // Skip check for non-authenticated requests
  if (!request.userContext?.tenantId) {
    if (shouldLogVerbose()) console.log('🔓 Trial restriction: No tenantId, skipping check');
    return;
  }

  // Skip check for auth-related operations during registration
  if (request.url.includes('/auth') || request.url.includes('/onboarding')) {
    if (shouldLogVerbose()) console.log('🔓 Trial restriction: Auth/onboarding operation, skipping check');
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

  try {
    const creditBalance = await CreditService.getCurrentBalance(tenantId);

    const balanceWithTotal = creditBalance as (typeof creditBalance & { totalCredits?: number }) | null;

    const isCreditInsufficient = !creditBalance || creditBalance.availableCredits <= (creditBalance.criticalBalanceThreshold || 10);

    if (isCreditInsufficient) {
      if (shouldLogVerbose()) {
        console.log(`[${requestId}] Insufficient credits for tenant ${tenantId}: ${creditBalance?.availableCredits || 0} available`);
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
      console.log(`[${requestId}] Credits OK: ${creditBalance?.availableCredits || 0} available`);
    }

  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    console.error(`❌ [${requestId}] Credit balance check failed:`, error.message);
    
    
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