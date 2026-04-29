import { db } from '../../../db/index.js';
import {
  seasonalCreditCampaigns,
  creditBatches,
  creditExpiryRuns,
  tenants,
  entities,
  credits,
  creditTransactions,
  notifications
} from '../../../db/schema/index.js';
import { eq, and, desc, asc, gte, lte, isNull, isNotNull, inArray, sql, lt } from 'drizzle-orm';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../../../db/schema/notifications/notifications.js';
import { addCreditsToEntity } from '../../credits/services/credit-operations.js';
import { CreditExpiryService } from '../../credits/services/credit-expiry-service.js';

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
    
    const minutesUntilExpiry = campaignData.minutesUntilExpiry;
    if (!expiresAt && !minutesUntilExpiry) {
      errors.push('Expiry date is required');
    } else if (expiresAt && new Date(expiresAt as string | Date) < new Date()) {
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
        expiresAt: new Date(campaignData.expiresAt as string),
        startsAt: campaignData.startsAt ? new Date(campaignData.startsAt as string) : new Date(),
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
      .orderBy(entities.createdAt);
    
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
        transactionType: 'allocation',
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

    const campaignMeta = (campaign.metadata ?? {}) as Record<string, unknown>;

    await db.insert(notifications)
      .values({
        tenantId,
        type: NOTIFICATION_TYPES.SEASONAL_CREDITS,
        priority: NOTIFICATION_PRIORITIES.MEDIUM,
        title: `New Credits Available: ${campaignName}`,
        message,
        actionUrl: `/dashboard/billing?campaign=${campaignId}`,
        actionLabel: 'View Credits',
        metadata: {
          campaignId,
          campaignName,
          creditAmount,
          expiresAt: campaign.expiresAt,
          modalConfig: campaignMeta.modalConfig ?? undefined,
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
          // Skip batch insert — no valid entityId to use (entityId FK requires a real entity row)
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
          await db.insert(creditBatches)
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
            await db.insert(creditBatches)
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
        // Do not insert a failed batch record — entityId FK requires a real entity row
        failedCount++;
        failedTenants.push({ tenantId, error: error.message });
      }
    }
    
    const finalStatus = failedCount === 0 ? 'completed' :
                       distributedCount === 0 ? 'failed' : 'partial_success';

    // Persist failedTenants in campaign metadata so the detail page can surface them
    const existingMeta = (campaign.metadata ?? {}) as Record<string, unknown>;
    await db.update(seasonalCreditCampaigns)
      .set({
        distributionStatus: finalStatus,
        distributedCount,
        failedCount,
        distributedAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...existingMeta,
          failedTenants: failedTenants.length > 0 ? failedTenants : [],
          lastDistributedAt: new Date().toISOString(),
        },
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
      .from(creditBatches)
      .where(eq(creditBatches.campaignId, String(campaignId)))
      .orderBy(desc(creditBatches.allocatedAt));
    
    // Filter out app-specific batches — they are internal tracking records created
    // when credits are allocated to downstream apps. They share the campaign_id
    // but should not inflate distribution totals.
    const orgPoolAllocations = allocations.filter(a => !a.targetApplication);

    const totalCreditsDistributed = orgPoolAllocations.reduce((sum: number, a: { allocatedCredits?: string | null }) =>
      sum + parseFloat(String(a.allocatedCredits ?? 0)), 0
    );

    const totalCreditsUsed = orgPoolAllocations.reduce((sum: number, a: { usedCredits?: string | null }) =>
      sum + parseFloat(String(a.usedCredits ?? 0)), 0
    );
    
    return {
      campaign,
      allocations,
      summary: {
        totalTargeted: campaign.targetAllTenants ? 'All Tenants' : campaign.targetTenantIds?.length || 0,
        successfullyDistributed: orgPoolAllocations.filter(a => a.distributionStatus === 'completed').length,
        failedDistributions: orgPoolAllocations.filter(a => a.distributionStatus === 'failed').length,
        pendingDistributions: orgPoolAllocations.filter(a => a.distributionStatus === 'pending').length,
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
  static async getTenantAllocations(tenantId: string): Promise<Array<{
    allocation: typeof creditBatches.$inferSelect;
    campaign: typeof seasonalCreditCampaigns.$inferSelect | null;
    entity: { entityId: string; entityName: string; entityType: string } | null;
  }>> {
    const allocations = await db
      .select({
        allocation: creditBatches,
        campaign: seasonalCreditCampaigns,
        entity: {
          entityId: entities.entityId,
          entityName: entities.entityName,
          entityType: entities.entityType,
        },
      })
      .from(creditBatches)
      .leftJoin(
        seasonalCreditCampaigns,
        eq(creditBatches.campaignId, seasonalCreditCampaigns.campaignId)
      )
      .leftJoin(entities, eq(creditBatches.entityId, entities.entityId))
      .where(eq(creditBatches.tenantId, tenantId))
      .orderBy(asc(creditBatches.expiresAt), desc(creditBatches.allocatedAt));

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
        allocation: creditBatches,
        campaign: seasonalCreditCampaigns
      })
      .from(creditBatches)
      .leftJoin(
        seasonalCreditCampaigns,
        eq(creditBatches.campaignId, seasonalCreditCampaigns.campaignId)
      )
      .where(and(
        eq(creditBatches.isActive, true),
        eq(creditBatches.isExpired, false),
        lte(creditBatches.expiresAt, futureDate),
        gte(creditBatches.expiresAt, new Date())
      ))
      .orderBy(creditBatches.expiresAt);
    
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
    
    await db.update(creditBatches)
      .set({
        expiresAt: newExpiryDate,
        updatedAt: new Date()
      })
      .where(eq(creditBatches.campaignId, String(campaignId)));
    
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
            actionUrl: `/dashboard/billing?campaign=${String(allocation.campaignId)}`,
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
      .from(creditBatches)
      .where(and(
        eq(creditBatches.isActive, true),
        eq(creditBatches.isExpired, false),
        lte(creditBatches.expiresAt, now)
      ));
    
    let processedCount = 0;
    
    for (const allocation of expiredAllocations) {
      try {
        // Mark allocation as expired
        await db.update(creditBatches)
          .set({
            isExpired: true,
            isActive: false,
            updatedAt: new Date()
          })
          .where(eq(creditBatches.allocationId, allocation.allocationId));
        
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
                operationCode: `expiry:seasonal_campaign:${String(allocation.campaignId ?? '')}`,
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

  // ─── New admin management methods ────────────────────────────────────────────

  /**
   * Cancel a campaign by marking all pending batches inactive.
   * Returns a warning if completed batches exist (those cannot be cancelled).
   */
  static async cancelCampaign(campaignId: string): Promise<Record<string, unknown>> {
    const [campaign] = await db
      .select()
      .from(seasonalCreditCampaigns)
      .where(eq(seasonalCreditCampaigns.campaignId, campaignId));

    if (!campaign) throw new Error('Campaign not found');
    if (campaign.distributionStatus === 'cancelled') throw new Error('Campaign is already cancelled');

    // Cancel pending batches
    const result = await db
      .update(creditBatches)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(creditBatches.campaignId, campaignId),
        eq(creditBatches.distributionStatus, 'pending'),
        eq(creditBatches.isExpired, false),
      ))
      .returning({ allocationId: creditBatches.allocationId });

    // Mark campaign cancelled
    await db
      .update(seasonalCreditCampaigns)
      .set({ distributionStatus: 'cancelled', isActive: false, updatedAt: new Date() })
      .where(eq(seasonalCreditCampaigns.campaignId, campaignId));

    return {
      cancelled: result.length,
      campaignId,
      message: result.length > 0
        ? `Cancelled ${result.length} pending batch(es).`
        : 'Campaign cancelled; no pending batches to deactivate.',
    };
  }

  /**
   * Delete failed batches for a campaign and re-distribute to those tenants.
   */
  static async rerunFailedDistributions(campaignId: string): Promise<Record<string, unknown>> {
    const [campaign] = await db
      .select()
      .from(seasonalCreditCampaigns)
      .where(eq(seasonalCreditCampaigns.campaignId, campaignId));

    if (!campaign) throw new Error('Campaign not found');

    // Find batches with distribution errors
    const failedBatches = await db
      .select()
      .from(creditBatches)
      .where(and(
        eq(creditBatches.campaignId, campaignId),
        eq(creditBatches.distributionStatus, 'failed'),
      ));

    if (!failedBatches.length) {
      return { requeued: 0, message: 'No failed batches to rerun.' };
    }

    // Reset to pending so the next distribute call picks them up
    const ids = failedBatches.map((b) => b.allocationId);
    await db
      .update(creditBatches)
      .set({ distributionStatus: 'pending', distributionError: null, updatedAt: new Date() })
      .where(inArray(creditBatches.allocationId, ids));

    // Reset campaign status so distribute() can proceed
    await db
      .update(seasonalCreditCampaigns)
      .set({ distributionStatus: 'pending', updatedAt: new Date() })
      .where(eq(seasonalCreditCampaigns.campaignId, campaignId));

    return {
      requeued: ids.length,
      message: `Re-queued ${ids.length} failed batch(es). Call distribute to retry.`,
    };
  }

  /**
   * Paginated, filterable list of all active credit batches across all tenants.
   */
  static async getAllActiveBatches(filters: {
    creditType?: string;
    expiresWithin?: number; // days
    tenantId?: string;
    campaignId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ batches: unknown[]; total: number }> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const now = new Date();

    const conditions = [
      eq(creditBatches.isActive, true),
      eq(creditBatches.isExpired, false),
    ];

    if (filters.creditType) conditions.push(eq(creditBatches.creditType, filters.creditType));
    if (filters.tenantId) conditions.push(eq(creditBatches.tenantId, filters.tenantId));
    if (filters.campaignId) conditions.push(eq(creditBatches.campaignId, filters.campaignId));
    if (filters.expiresWithin) {
      const cutoff = new Date(now.getTime() + filters.expiresWithin * 86_400_000);
      conditions.push(lte(creditBatches.expiresAt, cutoff));
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creditBatches)
      .where(and(...conditions));

    const rows = await db
      .select({
        allocationId: creditBatches.allocationId,
        tenantId: creditBatches.tenantId,
        tenantName: tenants.companyName,
        creditType: creditBatches.creditType,
        totalCredits: creditBatches.allocatedCredits,
        usedCredits: creditBatches.usedCredits,
        campaignId: creditBatches.campaignId,
        campaignName: seasonalCreditCampaigns.campaignName,
        targetApplication: creditBatches.targetApplication,
        expiresAt: creditBatches.expiresAt,
        isActive: creditBatches.isActive,
        isExpired: creditBatches.isExpired,
        createdAt: creditBatches.createdAt,
      })
      .from(creditBatches)
      .leftJoin(tenants, eq(creditBatches.tenantId, tenants.tenantId))
      .leftJoin(seasonalCreditCampaigns, eq(creditBatches.campaignId, seasonalCreditCampaigns.campaignId))
      .where(and(...conditions))
      .orderBy(asc(creditBatches.expiresAt))
      .limit(limit)
      .offset(offset);

    return {
      batches: rows.map((r) => ({
        ...r,
        remainingCredits: Math.max(0, parseFloat(String(r.totalCredits ?? 0)) - parseFloat(String(r.usedCredits ?? 0))),
      })),
      total: count,
    };
  }

  /**
   * Paginated expired batch history with optional date range.
   */
  static async getExpiredBatchHistory(filters: {
    tenantId?: string;
    campaignId?: string;
    creditType?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ batches: unknown[]; total: number }> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const conditions = [eq(creditBatches.isExpired, true)];
    if (filters.creditType) conditions.push(eq(creditBatches.creditType, filters.creditType));
    if (filters.tenantId) conditions.push(eq(creditBatches.tenantId, filters.tenantId));
    if (filters.campaignId) conditions.push(eq(creditBatches.campaignId, filters.campaignId));
    if (filters.from) conditions.push(gte(creditBatches.expiresAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(creditBatches.expiresAt, new Date(filters.to)));

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creditBatches)
      .where(and(...conditions));

    const rows = await db
      .select({
        allocationId: creditBatches.allocationId,
        tenantId: creditBatches.tenantId,
        tenantName: tenants.companyName,
        creditType: creditBatches.creditType,
        totalCredits: creditBatches.allocatedCredits,
        usedCredits: creditBatches.usedCredits,
        campaignId: creditBatches.campaignId,
        campaignName: seasonalCreditCampaigns.campaignName,
        targetApplication: creditBatches.targetApplication,
        expiresAt: creditBatches.expiresAt,
        isActive: creditBatches.isActive,
        isExpired: creditBatches.isExpired,
        createdAt: creditBatches.createdAt,
      })
      .from(creditBatches)
      .leftJoin(tenants, eq(creditBatches.tenantId, tenants.tenantId))
      .leftJoin(seasonalCreditCampaigns, eq(creditBatches.campaignId, seasonalCreditCampaigns.campaignId))
      .where(and(...conditions))
      .orderBy(desc(creditBatches.expiresAt))
      .limit(limit)
      .offset(offset);

    return {
      batches: rows.map((r) => ({
        ...r,
        remainingCredits: Math.max(0, parseFloat(String(r.totalCredits ?? 0)) - parseFloat(String(r.usedCredits ?? 0))),
      })),
      total: count,
    };
  }

  /**
   * Force-expire a list of allocation IDs by delegating to the expiry service.
   */
  static async bulkExpireBatches(
    allocationIds: string[],
    triggeredBy: string,
  ): Promise<Record<string, unknown>> {
    let processedCount = 0;
    let errorCount = 0;

    const batches = await db
      .select()
      .from(creditBatches)
      .where(inArray(creditBatches.allocationId, allocationIds));

    for (const batch of batches) {
      try {
        await CreditExpiryService.processExpiredAllocation(batch);
        processedCount++;
      } catch (err: unknown) {
        errorCount++;
        console.error('[SeasonalCreditService.bulkExpireBatches] Error:', err);
      }
    }

    return { processedCount, errorCount, triggeredBy };
  }

  /**
   * Full credit summary for a specific tenant: breakdown by type + active batch list.
   */
  static async getTenantCreditSummary(tenantId: string): Promise<Record<string, unknown>> {
    const activeBatches = await db
      .select({
        allocationId: creditBatches.allocationId,
        creditType: creditBatches.creditType,
        totalCredits: creditBatches.allocatedCredits,
        usedCredits: creditBatches.usedCredits,
        targetApplication: creditBatches.targetApplication,
        expiresAt: creditBatches.expiresAt,
        isActive: creditBatches.isActive,
        isExpired: creditBatches.isExpired,
        createdAt: creditBatches.createdAt,
      })
      .from(creditBatches)
      .where(and(
        eq(creditBatches.tenantId, tenantId),
        eq(creditBatches.isActive, true),
        eq(creditBatches.isExpired, false),
      ))
      .orderBy(asc(creditBatches.expiresAt));

    const sevenDaysLater = new Date(Date.now() + 7 * 86_400_000);

    // Build per-type summary
    const summary: Record<string, { total: number; available: number; expiringSoonCount: number }> = {};
    for (const b of activeBatches) {
      const type = b.creditType ?? 'unknown';
      const allocated = parseFloat(String(b.totalCredits ?? 0));
      const used = parseFloat(String(b.usedCredits ?? 0));
      const remaining = Math.max(0, allocated - used);
      if (!summary[type]) summary[type] = { total: 0, available: 0, expiringSoonCount: 0 };
      summary[type].total += allocated;
      summary[type].available += remaining;
      if (b.expiresAt && new Date(b.expiresAt) <= sevenDaysLater) {
        summary[type].expiringSoonCount++;
      }
    }

    return {
      summary,
      activeBatches: activeBatches.map((b) => ({
        ...b,
        remainingCredits: Math.max(0, parseFloat(String(b.totalCredits ?? 0)) - parseFloat(String(b.usedCredits ?? 0))),
      })),
    };
  }

  /**
   * Manually grant seasonal credits to a specific tenant (creates a credit batch + updates balance).
   */
  static async grantSeasonalCreditsToTenant(params: {
    tenantId: string;
    creditAmount: number;
    expiresAt: Date;
    initiatedBy: string;
    reason?: string;
  }): Promise<Record<string, unknown>> {
    const { tenantId, creditAmount, expiresAt, initiatedBy, reason } = params;

    // Find the root entity for this tenant
    const [rootEntity] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        isNull(entities.parentEntityId),
        eq(entities.isActive, true),
      ))
      .orderBy(asc(entities.createdAt))
      .limit(1);

    const entityId = rootEntity?.entityId ?? tenantId;

    // Insert the credit batch
    const [batch] = await db
      .insert(creditBatches)
      .values({
        tenantId,
        entityId,
        entityType: 'organization',
        creditType: 'seasonal',
        allocatedCredits: creditAmount.toString(),
        usedCredits: '0',
        expiresAt,
        isActive: true,
        isExpired: false,
        distributionStatus: 'completed',
      })
      .returning();

    // Update credit balance
    await addCreditsToEntity({
      tenantId,
      entityId,
      creditAmount,
      source: 'admin_grant',
      sourceId: batch.allocationId,
      description: reason ?? 'Admin seasonal credit grant',
      initiatedBy,
    });

    return {
      allocationId: batch.allocationId,
      tenantId,
      creditAmount,
      expiresAt: expiresAt.toISOString(),
      reason: reason ?? null,
    };
  }

  /**
   * Returns last N cron run records + aggregate success stats for the admin dashboard.
   */
  static async getCronStatus(limit = 20): Promise<Record<string, unknown>> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const runs = await db
      .select()
      .from(creditExpiryRuns)
      .where(gte(creditExpiryRuns.ranAt, thirtyDaysAgo))
      .orderBy(desc(creditExpiryRuns.ranAt))
      .limit(limit);

    const total = runs.length;
    const successful = runs.filter((r) => r.status === 'success').length;
    const partial = runs.filter((r) => r.status === 'partial').length;
    const failed = runs.filter((r) => r.status === 'error').length;
    const avgDurationMs = total > 0
      ? Math.round(runs.reduce((acc, r) => acc + (r.durationMs ?? 0), 0) / total)
      : 0;

    return {
      lastRun: runs[0] ?? null,
      runs,
      stats: {
        total,
        successful,
        partial,
        failed,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 100,
        avgDurationMs,
      },
    };
  }

  /**
   * Per-tenant distribution breakdown for a campaign.
   *
   * Returns one row per TENANT (not per batch) with:
   * - Tenant company name
   * - Aggregated allocated / used / remaining credits
   * - Expiry date and urgency status (active / expiring_soon / expired)
   * - Whether the tenant's batch has already expired via the cron
   *
   * Also returns the list of tenants that failed during distribution
   * (sourced from campaign.metadata.failedTenants, persisted on distribute).
   */
  static async getCampaignTenantBreakdown(campaignId: string): Promise<Record<string, unknown>> {
    const campaign = await this.getCampaign(campaignId);

    // Fetch all batches for this campaign, joined with tenant name
    const rows = await db
      .select({
        allocationId: creditBatches.allocationId,
        tenantId: creditBatches.tenantId,
        tenantName: tenants.companyName,
        allocatedCredits: creditBatches.allocatedCredits,
        usedCredits: creditBatches.usedCredits,
        expiresAt: creditBatches.expiresAt,
        isActive: creditBatches.isActive,
        isExpired: creditBatches.isExpired,
        distributionStatus: creditBatches.distributionStatus,
        targetApplication: creditBatches.targetApplication,
        allocatedAt: creditBatches.allocatedAt,
      })
      .from(creditBatches)
      .leftJoin(tenants, eq(creditBatches.tenantId, tenants.tenantId))
      .where(eq(creditBatches.campaignId, campaignId))
      .orderBy(asc(creditBatches.expiresAt));

    const now = Date.now();

    // Group by tenant — one tenant may have multiple batches (app-specific mode)
    const byTenant = new Map<string, {
      tenantId: string;
      tenantName: string | null;
      allocated: number;
      used: number;
      expiresAt: Date;
      isExpired: boolean;
      isActive: boolean;
      distributionStatus: string;
      batches: number;
    }>();

    for (const row of rows) {
      // Skip app-specific batches — these are internal tracking records created
      // when credits are allocated to downstream apps (e.g. accounting). They
      // share the campaign_id but should not inflate the campaign's allocated totals.
      if (row.targetApplication) continue;

      const tid = row.tenantId;
      const allocated = parseFloat(String(row.allocatedCredits ?? 0));
      const used = parseFloat(String(row.usedCredits ?? 0));
      const existing = byTenant.get(tid);
      if (existing) {
        existing.allocated += allocated;
        existing.used += used;
        existing.batches += 1;
        // Track the earliest expiry (most urgent)
        if (row.expiresAt && new Date(row.expiresAt) < existing.expiresAt) {
          existing.expiresAt = new Date(row.expiresAt);
        }
        if (row.isExpired) existing.isExpired = true;
      } else {
        byTenant.set(tid, {
          tenantId: tid,
          tenantName: row.tenantName ?? null,
          allocated,
          used,
          expiresAt: row.expiresAt ? new Date(row.expiresAt) : new Date(0),
          isExpired: row.isExpired ?? false,
          isActive: row.isActive ?? true,
          distributionStatus: row.distributionStatus ?? 'completed',
          batches: 1,
        });
      }
    }

    const tenantRows = [...byTenant.values()].map((t) => {
      const remaining = Math.max(0, t.allocated - t.used);
      const msUntilExpiry = t.expiresAt.getTime() - now;
      const daysUntilExpiry = Math.ceil(msUntilExpiry / 86_400_000);

      let expiryStatus: 'expired' | 'expiring_soon' | 'active';
      if (t.isExpired || msUntilExpiry <= 0) {
        expiryStatus = 'expired';
      } else if (daysUntilExpiry <= 7) {
        expiryStatus = 'expiring_soon';
      } else {
        expiryStatus = 'active';
      }

      return {
        tenantId: t.tenantId,
        tenantName: t.tenantName ?? t.tenantId.slice(0, 8) + '…',
        allocatedCredits: t.allocated,
        usedCredits: t.used,
        remainingCredits: remaining,
        utilizationPct: t.allocated > 0 ? Math.round((t.used / t.allocated) * 100) : 0,
        expiresAt: t.expiresAt.toISOString(),
        daysUntilExpiry,
        expiryStatus,
        isExpired: t.isExpired,
        distributionStatus: t.distributionStatus,
        batchCount: t.batches,
      };
    });

    // Sort: expired last, then by expiresAt ascending (most urgent first)
    tenantRows.sort((a, b) => {
      if (a.expiryStatus === 'expired' && b.expiryStatus !== 'expired') return 1;
      if (a.expiryStatus !== 'expired' && b.expiryStatus === 'expired') return -1;
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    });

    // Pull failed tenants from campaign metadata (saved during distribution)
    const meta = (campaign.metadata ?? {}) as Record<string, unknown>;
    const failedTenants = (meta.failedTenants ?? []) as Array<{ tenantId: string; error: string }>;

    // Enrich failed tenants with company names
    const enrichedFailedTenants = failedTenants.length > 0
      ? await Promise.all(failedTenants.map(async (ft) => {
          const [t] = await db
            .select({ companyName: tenants.companyName })
            .from(tenants)
            .where(eq(tenants.tenantId, ft.tenantId));
          return { ...ft, tenantName: t?.companyName ?? ft.tenantId.slice(0, 8) + '…' };
        }))
      : [];

    return {
      campaignId,
      campaignName: campaign.campaignName,
      distributionStatus: campaign.distributionStatus,
      expiresAt: campaign.expiresAt,
      totalTenants: tenantRows.length + enrichedFailedTenants.length,
      successfulTenants: tenantRows.length,
      failedTenantCount: enrichedFailedTenants.length,
      tenants: tenantRows,
      failedTenants: enrichedFailedTenants,
      summary: {
        totalAllocated: tenantRows.reduce((s, t) => s + t.allocatedCredits, 0),
        totalUsed: tenantRows.reduce((s, t) => s + t.usedCredits, 0),
        totalRemaining: tenantRows.reduce((s, t) => s + t.remainingCredits, 0),
        expiredCount: tenantRows.filter((t) => t.expiryStatus === 'expired').length,
        expiringSoonCount: tenantRows.filter((t) => t.expiryStatus === 'expiring_soon').length,
        activeCount: tenantRows.filter((t) => t.expiryStatus === 'active').length,
      },
    };
  }
}
