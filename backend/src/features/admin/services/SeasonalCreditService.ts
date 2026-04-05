import { db } from '../../../db/index.js';
import { 
  seasonalCreditCampaigns, 
  seasonalCreditAllocations,
  tenants,
  entities,
  credits,
  creditTransactions,
  notifications
} from '../../../db/schema/index.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../../../db/schema/notifications/notifications.js';

/**
 * Seasonal Credit Service
 * Handles distribution of free credits to tenants through campaigns
 */
export class SeasonalCreditService {
  
  /**
   * Validate campaign data before creation
   */
  static async validateCampaignData(campaignData: Record<string, unknown>): Promise<void> {
    const errors: string[] = [];
    const name = String(campaignData.campaignName ?? '');
    const creditType = String(campaignData.creditType ?? '');
    const totalCredits = campaignData.totalCredits;
    const expiresAt = campaignData.expiresAt;
    const targetTenantIds = campaignData.targetTenantIds as unknown[] | undefined;
    
    if (!name || name.length > 255) {
      errors.push('Campaign name must be between 1-255 characters');
    }
    
    const validCreditTypes = ['free_distribution', 'promotional', 'holiday', 'bonus', 'event'];
    if (!creditType || !validCreditTypes.includes(creditType)) {
      errors.push('Invalid credit type. Must be one of: ' + validCreditTypes.join(', '));
    }
    
    if (totalCredits == null || parseFloat(String(totalCredits)) <= 0) {
      errors.push('Total credits must be greater than 0');
    }
    
    if (!expiresAt || new Date(expiresAt as string | Date) < new Date()) {
      errors.push('Expiry date must be in the future');
    }
    
    if (!campaignData.targetAllTenants && (!targetTenantIds || targetTenantIds.length === 0)) {
      errors.push('Must either target all tenants or specify target tenant IDs');
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }
  
  /**
   * Create a new distribution campaign
   * @param {Object} campaignData - Campaign data
   * @param {string} campaignData.allocationMode - 'primary_org' or 'application_specific'
   * @param {Array<string>} campaignData.targetApplications - Required if allocationMode is 'application_specific'
   */
  static async createDistributionCampaign(campaignData: Record<string, unknown>): Promise<typeof seasonalCreditCampaigns.$inferSelect> {
    // Validate campaign data
    await this.validateCampaignData(campaignData);
    
    const allocationMode = String(campaignData.allocationMode ?? 'primary_org');
    const targetApplications = (campaignData.targetApplications ?? []) as string[];
    if (allocationMode === 'application_specific') {
      if (!targetApplications.length) {
        throw new Error('targetApplications is required when allocationMode is "application_specific"');
      }
      const validApps = ['crm', 'hr', 'affiliate', 'system', 'operations'];
      const invalidApps = targetApplications.filter((app: string) => !validApps.includes(app));
      if (invalidApps.length > 0) {
        throw new Error(`Invalid application codes: ${invalidApps.join(', ')}. Valid codes: ${validApps.join(', ')}`);
      }
    }
    
    let normalizedTargetApplications: string[] = targetApplications;
    if (allocationMode === 'primary_org') {
      normalizedTargetApplications = ['crm', 'hr', 'affiliate', 'system'];
    }
    
    const [campaign] = await db.insert(seasonalCreditCampaigns)
      .values({
        ...(campaignData as Record<string, unknown>),
        targetApplications: normalizedTargetApplications,
        metadata: {
          ...((campaignData.metadata as Record<string, unknown>) || {}),
          allocationMode,
          originalTargetApplications: targetApplications
        },
        distributionStatus: 'pending',
        distributedCount: 0,
        failedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)
      .returning();
    
    console.log('✅ Created seasonal credit campaign:', {
      campaignId: campaign.campaignId,
      allocationMode,
      targetApplications: normalizedTargetApplications
    });
    return campaign;
  }
  
  /**
   * Get all campaigns
   */
  static async getCampaigns(filters: Record<string, unknown> = {}): Promise<Array<typeof seasonalCreditCampaigns.$inferSelect>> {
    const conditions: unknown[] = [];
    
    if ((filters as Record<string, unknown>).isActive !== undefined) {
      conditions.push(eq(seasonalCreditCampaigns.isActive, (filters as Record<string, unknown>).isActive as boolean));
    }
    
    if ((filters as Record<string, unknown>).distributionStatus) {
      conditions.push(eq(seasonalCreditCampaigns.distributionStatus, (filters as Record<string, unknown>).distributionStatus as string));
    }
    
    const campaigns = await db
      .select()
      .from(seasonalCreditCampaigns)
      .where(conditions.length > 0 ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])) : undefined)
      .orderBy(desc(seasonalCreditCampaigns.createdAt));
    
    return campaigns;
  }
  
  /**
   * Get a single campaign by ID
   */
  static async getCampaign(campaignId: string): Promise<typeof seasonalCreditCampaigns.$inferSelect> {
    const [campaign] = await db
      .select()
      .from(seasonalCreditCampaigns)
      .where(eq(seasonalCreditCampaigns.campaignId, campaignId));
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    return campaign;
  }
  
  /**
   * Get all active tenant IDs
   */
  static async getAllActiveTenantIds(): Promise<string[]> {
    const activeTenants = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.isActive, true));
    
    return activeTenants.map(t => t.tenantId);
  }
  
  /**
   * Get primary organization entity for a tenant
   */
  static async getPrimaryOrganizationEntity(tenantId: string): Promise<typeof entities.$inferSelect | null> {
    const entityList = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.entityType, 'organization'),
        eq(entities.isActive, true)
      ))
      .orderBy(desc(entities.isDefault));
    
    return entityList.length > 0 ? entityList[0] : null;
  }
  
  /**
   * Add credits to tenant's primary organization
   */
  static async addCreditsToOrganization(tenantId: string, entityId: string, creditAmount: number | string, campaignId: string, _campaignName: string): Promise<{ previousBalance: number; newBalance: number; creditAmount: number | string }> {
    // Get or create credit record for the entity
    let [creditRecord] = await db
      .select()
      .from(credits)
      .where(and(
        eq(credits.tenantId, tenantId),
        eq(credits.entityId, entityId)
      ));
    
    if (!creditRecord) {
      // Create new credit record
      [creditRecord] = await db.insert(credits)
        .values({
          tenantId,
          entityId,
          availableCredits: '0',
          isActive: true,
          createdAt: new Date(),
          lastUpdatedAt: new Date()
        })
        .returning();
    }
    
    const previousBalance = parseFloat(String(creditRecord.availableCredits ?? 0));
    const newBalance = previousBalance + parseFloat(String(creditAmount));
    
    // Update credit balance
    await db.update(credits)
      .set({
        availableCredits: newBalance.toString(),
        lastUpdatedAt: new Date()
      })
      .where(eq(credits.creditId, creditRecord.creditId));
    
    // Create transaction record
    await db.insert(creditTransactions)
      .values({
        tenantId,
        entityId,
        transactionType: 'seasonal_campaign',
        amount: creditAmount.toString(),
        previousBalance: previousBalance.toString(),
        newBalance: newBalance.toString(),
        operationCode: `seasonal_campaign:${campaignId}`,
        createdAt: new Date()
      });
    
    console.log(`✅ Added ${creditAmount} credits to tenant ${tenantId}, entity ${entityId}`);
    
    return {
      previousBalance,
      newBalance,
      creditAmount
    };
  }
  
  /**
   * Create notification for credit distribution
   */
  static async createCreditDistributionNotification(campaign: Record<string, unknown>, tenantId: string, creditAmount: number | string): Promise<void> {
    const notificationTemplate = (campaign.notificationTemplate != null ? String(campaign.notificationTemplate) : null) ||
      `You've received {creditAmount} free credits from the {campaignName} campaign!`;
    const campaignName = String(campaign.campaignName ?? '');
    const campaignId = String(campaign.campaignId ?? '');
    
    const message = notificationTemplate
      .replace('{creditAmount}', String(creditAmount))
      .replace('{campaignName}', campaignName);
    
    await db.insert(notifications)
      .values({
        tenantId,
        type: NOTIFICATION_TYPES.SEASONAL_CREDITS,
        priority: NOTIFICATION_PRIORITIES.MEDIUM,
        title: `New Credits Available: ${campaignName}`,
        message,
        actionUrl: `/credits?campaign=${campaignId}`,
        actionLabel: 'View Credits',
        metadata: {
          campaignId,
          campaignName,
          creditAmount,
          expiresAt: campaign.expiresAt
        },
        isRead: false,
        isDismissed: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    
    console.log(`✅ Created notification for tenant ${tenantId}`);
  }
  
  /**
   * Distribute credits to tenants
   */
  static async distributeCreditsToTenants(campaignId: string): Promise<Record<string, unknown>> {
    const campaign = await this.getCampaign(campaignId);
    
    if (campaign.distributionStatus === 'completed' || campaign.distributionStatus === 'cancelled') {
      throw new Error(`Campaign already completed or cancelled. Current status: ${campaign.distributionStatus}`);
    }
    
    // Update campaign status to processing
    await db.update(seasonalCreditCampaigns)
      .set({ 
        distributionStatus: 'processing', 
        updatedAt: new Date() 
      })
      .where(eq(seasonalCreditCampaigns.campaignId, String(campaignId)));
    
    console.log(`🚀 Starting credit distribution for campaign: ${campaign.campaignName}`);
    
    // Get target tenants
    const targetTenantIds = campaign.targetAllTenants 
      ? await this.getAllActiveTenantIds()
      : campaign.targetTenantIds || [];
    
    console.log(`📊 Distributing to ${targetTenantIds.length} tenants`);
    
    let distributedCount = 0;
    let failedCount = 0;
    const failedTenants: Array<{ tenantId: string; error: string }> = [];
    
    // Process each tenant
    for (const tenantId of targetTenantIds) {
      try {
        // Get tenant's primary organization entity
        const primaryEntity = await this.getPrimaryOrganizationEntity(tenantId);
        
        if (!primaryEntity) {
          console.warn(`⚠️ No primary organization found for tenant ${tenantId}`);
          failedCount++;
          failedTenants.push({ tenantId, error: 'No primary organization found' });
          
          // Record failed allocation
          await db.insert(seasonalCreditAllocations)
            .values({
              campaignId: String(campaignId),
              tenantId,
              entityId: tenantId, // Use tenantId as fallback
              allocatedCredits: '0',
              expiresAt: campaign.expiresAt,
              distributionStatus: 'failed',
              distributionError: 'No primary organization found',
              createdAt: new Date(),
              updatedAt: new Date()
            });
          
          continue;
        }
        
        // Determine allocation mode from campaign metadata
        const campaignMeta = campaign.metadata as Record<string, unknown> | undefined;
        const allocationMode = (campaignMeta?.allocationMode ?? campaign.targetApplications ?? 'primary_org') as string;
        const targetApplications = (campaignMeta?.originalTargetApplications ?? campaign.targetApplications ?? []) as string[];
        
        const creditsPerTenant = campaign.creditsPerTenant;
        const totalCredits = campaign.totalCredits;
        const creditsToAllocate = creditsPerTenant != null
          ? parseFloat(String(creditsPerTenant))
          : (campaign.distributionMethod === 'equal'
            ? parseFloat(String(totalCredits)) / targetTenantIds.length
            : parseFloat(String(totalCredits)));
        
        if (allocationMode === 'primary_org') {
          await this.addCreditsToOrganization(
            tenantId,
            primaryEntity.entityId,
            creditsToAllocate,
            String(campaign.campaignId ?? ''),
            String(campaign.campaignName ?? '')
          );
          
          // Create single allocation record for primary org
          await db.insert(seasonalCreditAllocations)
            .values({
              campaignId: String(campaignId),
              tenantId,
              entityId: primaryEntity.entityId,
              entityType: 'organization',
              targetApplication: null, // NULL = primary org allocation
              allocatedCredits: creditsToAllocate.toString(),
              usedCredits: '0',
              expiresAt: campaign.expiresAt,
              distributionStatus: 'completed',
              isActive: true,
              isExpired: false,
              allocatedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .onConflictDoNothing();
        } else {
          // Application-specific allocation
          // Calculate credits per application (distribute evenly)
          const creditsPerApp = creditsToAllocate / targetApplications.length;
          
          // Allocate credits to organization (they'll be tracked per application)
          await this.addCreditsToOrganization(
            tenantId,
            primaryEntity.entityId,
            creditsToAllocate,
            String(campaignId),
            String(campaign.campaignName ?? '')
          );
          
          // Create separate allocation record for each target application
          for (const targetApp of targetApplications) {
            await db.insert(seasonalCreditAllocations)
              .values({
                campaignId: String(campaignId),
                tenantId,
                entityId: primaryEntity.entityId,
                entityType: 'organization',
                targetApplication: targetApp, // Specific application
                allocatedCredits: creditsPerApp.toString(),
                usedCredits: '0',
                expiresAt: campaign.expiresAt,
                distributionStatus: 'completed',
                isActive: true,
                isExpired: false,
                allocatedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
              })
              .onConflictDoNothing();
          }
          
          console.log(`✅ Created ${targetApplications.length} application-specific allocations for tenant ${tenantId}`);
        }
        
        // Create notification for tenant
        if (campaign.sendNotifications) {
          await this.createCreditDistributionNotification(campaign, tenantId, creditsToAllocate);
        }
        
        distributedCount++;
        console.log(`✅ Distributed ${creditsToAllocate} credits to tenant ${tenantId}`);
        
      } catch (err: unknown) {
        const error = err as Error;
        console.error(`❌ Failed to distribute credits to tenant ${tenantId}:`, error);
        
        await db.insert(seasonalCreditAllocations)
          .values({
            campaignId: String(campaignId),
            tenantId,
            entityId: tenantId,
            allocatedCredits: '0',
            expiresAt: campaign.expiresAt,
            distributionStatus: 'failed',
            distributionError: error.message,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        
        failedCount++;
        failedTenants.push({ tenantId, error: error.message });
      }
    }
    
    const finalStatus = failedCount === 0 ? 'completed' :
                       distributedCount === 0 ? 'failed' : 'partial_success';
    
    await db.update(seasonalCreditCampaigns)
      .set({
        distributionStatus: finalStatus,
        distributedCount,
        failedCount,
        distributedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(seasonalCreditCampaigns.campaignId, String(campaignId)));
    
    console.log(`🎉 Distribution complete: ${distributedCount} successful, ${failedCount} failed`);
    
    return {
      campaignId,
      distributedCount,
      failedCount,
      status: finalStatus,
      failedTenants: failedTenants.length > 0 ? failedTenants : undefined
    };
  }
  
  /**
   * Get campaign distribution status
   */
  static async getCampaignDistributionStatus(campaignId: string): Promise<Record<string, unknown>> {
    const campaign = await this.getCampaign(campaignId);
    
    const allocations = await db
      .select()
      .from(seasonalCreditAllocations)
      .where(eq(seasonalCreditAllocations.campaignId, String(campaignId)))
      .orderBy(desc(seasonalCreditAllocations.allocatedAt));
    
    const totalCreditsDistributed = allocations.reduce((sum: number, a: { allocatedCredits?: string | null }) => 
      sum + parseFloat(String(a.allocatedCredits ?? 0)), 0
    );
    
    const totalCreditsUsed = allocations.reduce((sum: number, a: { usedCredits?: string | null }) => 
      sum + parseFloat(String(a.usedCredits ?? 0)), 0
    );
    
    return {
      campaign,
      allocations,
      summary: {
        totalTargeted: campaign.targetAllTenants ? 'All Tenants' : campaign.targetTenantIds?.length || 0,
        successfullyDistributed: allocations.filter(a => a.distributionStatus === 'completed').length,
        failedDistributions: allocations.filter(a => a.distributionStatus === 'failed').length,
        pendingDistributions: allocations.filter(a => a.distributionStatus === 'pending').length,
        totalCreditsDistributed,
        totalCreditsUsed,
        utilizationRate: Number(totalCreditsDistributed) > 0 
          ? ((Number(totalCreditsUsed) / Number(totalCreditsDistributed)) * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }
  
  /**
   * Get tenant's seasonal credit allocations
   */
  static async getTenantAllocations(tenantId: string): Promise<Array<{ allocation: typeof seasonalCreditAllocations.$inferSelect; campaign: typeof seasonalCreditCampaigns.$inferSelect | null }>> {
    const allocations = await db
      .select({
        allocation: seasonalCreditAllocations,
        campaign: seasonalCreditCampaigns
      })
      .from(seasonalCreditAllocations)
      .leftJoin(
        seasonalCreditCampaigns,
        eq(seasonalCreditAllocations.campaignId, seasonalCreditCampaigns.campaignId)
      )
      .where(eq(seasonalCreditAllocations.tenantId, tenantId))
      .orderBy(desc(seasonalCreditAllocations.allocatedAt));
    
    return allocations;
  }
  
  /**
   * Get expiring allocations
   */
  static async getExpiringAllocations(daysAhead = 30): Promise<Array<Record<string, unknown>>> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    const expiringAllocations = await db
      .select({
        allocation: seasonalCreditAllocations,
        campaign: seasonalCreditCampaigns
      })
      .from(seasonalCreditAllocations)
      .leftJoin(
        seasonalCreditCampaigns,
        eq(seasonalCreditAllocations.campaignId, seasonalCreditCampaigns.campaignId)
      )
      .where(and(
        eq(seasonalCreditAllocations.isActive, true),
        eq(seasonalCreditAllocations.isExpired, false),
        lte(seasonalCreditAllocations.expiresAt, futureDate),
        gte(seasonalCreditAllocations.expiresAt, new Date())
      ))
      .orderBy(seasonalCreditAllocations.expiresAt);
    
    return expiringAllocations.map(item => {
      const daysUntilExpiry = Math.ceil(
        (new Date(item.allocation.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        ...item.allocation,
        campaignName: item.campaign?.campaignName,
        creditType: item.campaign?.creditType,
        daysUntilExpiry
      };
    });
  }
  
  /**
   * Extend campaign expiry
   */
  static async extendCampaignExpiry(campaignId: string, additionalDays: number): Promise<Record<string, unknown>> {
    const campaign = await this.getCampaign(campaignId);
    
    const newExpiryDate = new Date(campaign.expiresAt);
    newExpiryDate.setDate(newExpiryDate.getDate() + additionalDays);
    
    // Update campaign expiry
    await db.update(seasonalCreditCampaigns)
      .set({
        expiresAt: newExpiryDate,
        updatedAt: new Date()
      })
      .where(eq(seasonalCreditCampaigns.campaignId, String(campaignId)));
    
    await db.update(seasonalCreditAllocations)
      .set({
        expiresAt: newExpiryDate,
        updatedAt: new Date()
      })
      .where(eq(seasonalCreditAllocations.campaignId, String(campaignId)));
    
    console.log(`✅ Extended campaign ${campaignId} expiry by ${additionalDays} days`);
    
    return {
      campaignId,
      oldExpiryDate: campaign.expiresAt,
      newExpiryDate,
      additionalDays
    };
  }
  
  /**
   * Send expiry warnings
   */
  static async sendExpiryWarnings(daysAhead = 7): Promise<Record<string, unknown>> {
    const expiringAllocations = await this.getExpiringAllocations(daysAhead);
    
    let emailsSent = 0;
    
    for (const allocation of expiringAllocations) {
      try {
        await db.insert(notifications)
          .values({
            tenantId: allocation.tenantId as string,
            type: NOTIFICATION_TYPES.CREDIT_EXPIRY_WARNING,
            priority: NOTIFICATION_PRIORITIES.HIGH,
            title: `Credits Expiring Soon: ${String(allocation.campaignName ?? '')}`,
            message: `Your ${String(allocation.allocatedCredits ?? '')} credits from ${String(allocation.campaignName ?? '')} will expire in ${Number((allocation as Record<string, unknown>).daysUntilExpiry ?? 0)} days. Use them before ${new Date(String(allocation.expiresAt)).toLocaleDateString()}!`,
            actionUrl: `/credits?campaign=${String(allocation.campaignId)}`,
            actionLabel: 'View Credits',
            metadata: {
              campaignId: String(allocation.campaignId ?? ''),
              allocationId: allocation.allocationId,
              expiresAt: allocation.expiresAt,
              daysUntilExpiry: (allocation as Record<string, unknown>).daysUntilExpiry
            } as Record<string, unknown>,
            isRead: false,
            isDismissed: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any);
        
        emailsSent++;
      } catch (err: unknown) {
        const error = err as Error;
        console.error(`Failed to send expiry warning for allocation ${allocation.allocationId}:`, error);
      }
    }
    
    console.log(`✅ Sent ${emailsSent} expiry warnings`);
    
    return {
      emailsSent,
      totalExpiring: expiringAllocations.length
    };
  }
  
  /**
   * Process expired credits
   */
  static async processExpiries(): Promise<Record<string, unknown>> {
    const now = new Date();
    
    // Find expired allocations
    const expiredAllocations = await db
      .select()
      .from(seasonalCreditAllocations)
      .where(and(
        eq(seasonalCreditAllocations.isActive, true),
        eq(seasonalCreditAllocations.isExpired, false),
        lte(seasonalCreditAllocations.expiresAt, now)
      ));
    
    let processedCount = 0;
    
    for (const allocation of expiredAllocations) {
      try {
        // Mark allocation as expired
        await db.update(seasonalCreditAllocations)
          .set({
            isExpired: true,
            isActive: false,
            updatedAt: new Date()
          })
          .where(eq(seasonalCreditAllocations.allocationId, allocation.allocationId));
        
        // Deduct unused credits from organization
        const unusedCredits = parseFloat(String(allocation.allocatedCredits)) - parseFloat(String(allocation.usedCredits ?? 0));
        
        if (unusedCredits > 0) {
          // Get current credit balance
          const [creditRecord] = await db
            .select()
            .from(credits)
            .where(and(
              eq(credits.tenantId, String(allocation.tenantId ?? '')),
              eq(credits.entityId, String(allocation.entityId ?? ''))
            ));
          
          if (creditRecord) {
            const previousBalance = parseFloat(String(creditRecord.availableCredits ?? 0));
            const newBalance = Math.max(0, previousBalance - unusedCredits);
            
            // Update credit balance
            await db.update(credits)
              .set({
                availableCredits: newBalance.toString(),
                lastUpdatedAt: new Date()
              })
              .where(eq(credits.creditId, creditRecord.creditId));
            
            // Create transaction record
            await db.insert(creditTransactions)
              .values({
                tenantId: String(allocation.tenantId),
                entityId: String(allocation.entityId),
                transactionType: 'expiry',
                amount: (-unusedCredits).toString(),
                previousBalance: previousBalance.toString(),
                newBalance: newBalance.toString(),
                operationCode: `seasonal_expiry:${String(allocation.campaignId ?? '')}`,
                createdAt: new Date()
              });
          }
        }
        
        processedCount++;
        console.log(`✅ Processed expiry for allocation ${allocation.allocationId}`);
        
      } catch (err: unknown) {
        const error = err as Error;
        console.error(`Failed to process expiry for allocation ${allocation.allocationId}:`, error);
      }
    }
    
    console.log(`✅ Processed ${processedCount} expired allocations`);
    
    return {
      processedCount,
      totalExpired: expiredAllocations.length
    };
  }
}
