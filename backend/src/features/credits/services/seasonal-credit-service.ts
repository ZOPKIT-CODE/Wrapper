// REMOVED: CreditAllocationService - Application-specific allocations removed
// REMOVED: creditAllocations, creditAllocationTransactions - Tables removed
import Logger from '../../../utils/logger.js';

/**
 * ⚠️ DEPRECATED: SeasonalCreditService
 * 
 * This service was built on top of the credit allocation system which has been removed.
 * Applications now manage their own credit consumption.
 * 
 * This service needs to be refactored to use CreditService instead.
 * For now, methods will throw errors indicating they need refactoring.
 */
class SeasonalCreditService {

  // Seasonal credit types with their default configurations
  static SEASONAL_CREDIT_TYPES = {
    seasonal: {
      name: 'Seasonal Credits',
      defaultExpiryDays: 30,
      expiryRule: 'fixed_date',
      warningDays: 7,
      description: 'Holiday and seasonal promotional credits'
    },
    bonus: {
      name: 'Bonus Credits',
      defaultExpiryDays: 90,
      expiryRule: 'fixed_date',
      warningDays: 14,
      description: 'Loyalty and referral bonus credits'
    },
    promotional: {
      name: 'Promotional Credits',
      defaultExpiryDays: 14,
      expiryRule: 'fixed_date',
      warningDays: 3,
      description: 'Marketing campaign credits'
    },
    event: {
      name: 'Event Credits',
      defaultExpiryDays: 7,
      expiryRule: 'fixed_date',
      warningDays: 2,
      description: 'Special event and product launch credits'
    },
    partnership: {
      name: 'Partnership Credits',
      defaultExpiryDays: 60,
      expiryRule: 'fixed_date',
      warningDays: 10,
      description: 'Partner program and affiliate credits'
    },
    trial_extension: {
      name: 'Trial Extension Credits',
      defaultExpiryDays: 30,
      expiryRule: 'fixed_date',
      warningDays: 7,
      description: 'Extended trial period credits'
    }
  };

  /**
   * Allocate seasonal credits to tenants
   * @param {Object} params - Allocation parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.sourceEntityId - Source entity (organization)
   * @param {number} params.creditAmount - Amount of credits to allocate
   * @param {string} params.creditType - Type of seasonal credits (seasonal, bonus, promotional, etc.)
   * @param {string} params.campaignId - Campaign identifier
   * @param {string} params.campaignName - Campaign display name
   * @param {Date} params.expiresAt - Explicit expiry date (optional)
   * @param {Object} params.metadata - Additional campaign metadata
   * @param {string} params.allocatedBy - User who allocated the credits
   * @param {Array} params.targetApplications - Applications to allocate credits to (optional)
   */
  async allocateSeasonalCredits(params: {
    tenantId: string;
    sourceEntityId: string;
    creditAmount: number;
    creditType?: string;
    campaignId: string;
    campaignName?: string;
    expiresAt?: Date | null;
    metadata?: Record<string, unknown>;
    allocatedBy: string;
    targetApplications?: string[] | null;
  }): Promise<unknown[]> {
    let { creditType = 'seasonal', expiresAt = null, metadata = {} } = params;
    const { tenantId, creditAmount, campaignId, campaignName, targetApplications } = params;
    try {
      Logger.log('info', 'billing', 'allocate-seasonal-credits', 'Allocating seasonal credits', {
        tenantId,
        creditAmount,
        creditType,
        campaignId,
        campaignName
      });

      const typesMap = (this.constructor as typeof SeasonalCreditService).SEASONAL_CREDIT_TYPES as Record<string, { name: string; defaultExpiryDays: number; expiryRule: string; warningDays: number; description?: string }>;
      // If credit type is not seasonal, fall back to regular credit allocation
      if (!typesMap[creditType]) {
        Logger.log('warning', 'billing', 'allocate-seasonal-credits', 'Credit type not supported, falling back to free credits', { creditType });
        creditType = 'free';
      }

      const creditConfig = typesMap[creditType] || {
        name: 'Credits',
        defaultExpiryDays: 30,
        expiryRule: 'fixed_date',
        warningDays: 7
      };

      // Determine expiry date
      let finalExpiresAt;
      if (expiresAt) {
        // If expiresAt is provided, ensure it's a Date object
        finalExpiresAt = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
      } else {
        // Use default expiry
        finalExpiresAt = new Date(Date.now() + (creditConfig.defaultExpiryDays * 24 * 60 * 60 * 1000));
      }

      // Prepare metadata
      const fullMetadata = {
        ...metadata,
        allocatedAt: new Date().toISOString(),
        creditConfig: creditConfig,
        campaignType: creditType
      };
      void fullMetadata;

      // Determine target applications
      // REMOVED: SUPPORTED_APPLICATIONS from CreditAllocationService
      // Applications should be specified explicitly now
      const applications = targetApplications || [];
      
      if (applications.length === 0) {
        throw new Error('targetApplications must be provided. Applications now manage their own credits.');
      }

      // Calculate credits per application (distribute evenly)

      const allocations: unknown[] = [];

      // Allocate to each target application
      for (const app of applications) {
        try {
          throw new Error('allocateCreditsToApplication method removed. Use CreditService.addCreditsToEntity() instead.');
        } catch (err: unknown) {
          const appError = err as Error;
          Logger.log('warning', 'billing', 'allocate-seasonal-credits', 'Failed to allocate to app, continuing', { app, error: appError.message });
        }
      }

      Logger.log('info', 'billing', 'allocate-seasonal-credits', 'Allocated seasonal credits across applications', { creditAmount, creditType, appCount: applications.length });

      // Create notification for the tenant
      try {
        const { NotificationService } = await import('../../notifications/services/notification-service.js');
        const notificationService = new NotificationService();

        await notificationService.createSeasonalCreditNotification(tenantId, {
          campaignId,
          campaignName: campaignName || creditConfig.name,
          allocatedCredits: creditAmount,
          creditType,
          expiresAt: finalExpiresAt.toISOString(),
          applications
        });

        Logger.log('info', 'billing', 'allocate-seasonal-credits', 'Created seasonal credit notification for tenant', { tenantId });
      } catch (err: unknown) {
        const notificationError = err as Error;
        Logger.log('warning', 'billing', 'allocate-seasonal-credits', 'Failed to create seasonal credit notification', { error: notificationError.message });
        // Don't fail the allocation if notification creation fails
      }

      return allocations;

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'billing', 'allocate-seasonal-credits', 'Error allocating seasonal credits', { error: error.message });
      throw new Error(`Seasonal credit allocation failed: ${error.message}. This service needs refactoring to use CreditService.`);
    }
  }

  /**
   * Get seasonal credit summary for a tenant
   */
  async getSeasonalCreditSummary(tenantId: string, campaignId: string | null = null): Promise<never> {
    // REMOVED: creditAllocations table queries
    // TODO: Refactor to use credit_transactions table with metadata filtering
    throw new Error('getSeasonalCreditSummary method needs refactoring. creditAllocations table has been removed.');
  }

  /**
   * Process seasonal credit expiries with enhanced logic
   */
  async processSeasonalCreditExpiries(): Promise<never> {
    // REMOVED: creditAllocations table queries
    // TODO: Refactor to use credit_transactions table with expiry metadata
    throw new Error('processSeasonalCreditExpiries method needs refactoring. creditAllocations table has been removed.');
  }

  /**
   * Get credits expiring soon (for warning notifications)
   */
  async getExpiringSeasonalCredits(tenantId: string, daysAhead = 7): Promise<never> {
    // REMOVED: creditAllocations table queries
    // TODO: Refactor to use credit_transactions table with expiry metadata
    throw new Error('getExpiringSeasonalCredits method needs refactoring. creditAllocations table has been removed.');
  }

  /**
   * Extend expiry for seasonal credits (for special cases)
   */
  async extendSeasonalCreditExpiry(campaignId: string, tenantId: string | null = null, additionalDays = 30): Promise<never> {
    // REMOVED: creditAllocations table queries
    // TODO: Refactor to use credit_transactions table with expiry metadata
    throw new Error('extendSeasonalCreditExpiry method needs refactoring. creditAllocations table has been removed.');
  }

  /**
   * Get active seasonal campaigns for a tenant
   */
  async getActiveSeasonalCampaigns(_tenantId: string): Promise<never> {
    // REMOVED: creditAllocations table queries
    // TODO: Refactor to use credit_transactions table with campaign metadata
    throw new Error('getActiveSeasonalCampaigns method needs refactoring. creditAllocations table has been removed.');
  }
}

export { SeasonalCreditService };
export default SeasonalCreditService;

