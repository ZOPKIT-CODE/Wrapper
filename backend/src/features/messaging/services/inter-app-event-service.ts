import { db } from '../../../db/index.js';
import { eventTracking } from '../../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { snsSqsPublisher } from '../utils/sns-sqs-publisher.js';
import { EventTrackingService } from './event-tracking-service.js';

export interface PublishEventParams {
  eventType: string;
  sourceApplication: string;
  targetApplication: string;
  tenantId: string;
  entityId?: string;
  eventData?: Record<string, unknown>;
  publishedBy?: string;
}

export interface TrackPublishedEventParams {
  eventId: string;
  eventType: string;
  tenantId: string;
  entityId?: string;
  streamKey: string;
  sourceApplication: string;
  targetApplication: string;
  eventData?: Record<string, unknown>;
  publishedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Inter-Application Event Service
 * Handles event communication between all business suite applications
 */
export class InterAppEventService {

  /**
   * Publish an event from any app to any other app
   */
  static async publishEvent({
    eventType,
    sourceApplication,
    targetApplication,
    tenantId,
    entityId,
    eventData = {},
    publishedBy = 'system'
  }: PublishEventParams): Promise<Record<string, unknown> | undefined> {
    const eventId = `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      await EventTrackingService.trackPublishedEvent({
        eventId,
        eventType,
        tenantId,
        entityId,
        streamKey: 'inter-app-events',
        sourceApplication,
        targetApplication,
        eventData,
        publishedBy
      });

      const publishResult = await snsSqsPublisher.publishInterAppEvent({
        eventId,
        eventType,
        sourceApplication,
        targetApplication,
        tenantId,
        entityId: entityId ?? '',
        eventData,
        publishedBy
      });

      if (publishResult && publishResult.success) {
        await EventTrackingService.markEventPublished(eventId, {
          routingKey: publishResult.routingKey,
          messageId: publishResult.messageId,
        });
        console.log(`✅ Inter-app event published: ${sourceApplication} → ${targetApplication} (${eventType})`);
        return publishResult;
      }
    } catch (err: unknown) {
      const error = err as Error;
      await EventTrackingService.markEventFailed(eventId, error.message, true).catch(() => {});
      console.error(`❌ Failed to publish inter-app event ${sourceApplication} → ${targetApplication}:`, error);
      throw error;
    }
  }

  /**
   * Track a published inter-app event
   */
  static async trackPublishedEvent({
    eventId,
    eventType,
    tenantId,
    entityId,
    streamKey,
    sourceApplication,
    targetApplication,
    eventData,
    publishedBy,
    metadata = {}
  }: TrackPublishedEventParams): Promise<Record<string, unknown> | undefined> {
    await EventTrackingService.trackPublishedEvent({
      eventId,
      eventType,
      tenantId,
      entityId,
      streamKey,
      sourceApplication,
      targetApplication,
      eventData,
      publishedBy,
      metadata,
    });
    return { eventId, status: 'pending' };
  }

  /**
   * Acknowledge processing of an inter-app event
   */
  static async acknowledgeInterAppEvent(eventId: string, acknowledgmentData: Record<string, unknown> = {}): Promise<unknown> {
    // Use EventTrackingService with deleteAfterAck=true for storage optimization
    const { EventTrackingService } = await import('./event-tracking-service.js');
    return await EventTrackingService.acknowledgeEvent(eventId, acknowledgmentData);
  }

  /**
   * Get inter-application communication matrix for a tenant
   */
  static async getCommunicationMatrix(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const [matrix] = await db
        .select({
          totalEvents: sql`count(*)`,
          // All possible app-to-app combinations
          crmToHr: sql`count(case when source_application = 'crm' and target_application = 'hr' then 1 end)`,
          crmToAffiliate: sql`count(case when source_application = 'crm' and target_application = 'affiliate' then 1 end)`,
          crmToSystem: sql`count(case when source_application = 'crm' and target_application = 'system' then 1 end)`,
          hrToCrm: sql`count(case when source_application = 'hr' and target_application = 'crm' then 1 end)`,
          hrToAffiliate: sql`count(case when source_application = 'hr' and target_application = 'affiliate' then 1 end)`,
          hrToSystem: sql`count(case when source_application = 'hr' and target_application = 'system' then 1 end)`,
          affiliateToCrm: sql`count(case when source_application = 'affiliate' and target_application = 'crm' then 1 end)`,
          affiliateToHr: sql`count(case when source_application = 'affiliate' and target_application = 'hr' then 1 end)`,
          affiliateToSystem: sql`count(case when source_application = 'affiliate' and target_application = 'system' then 1 end)`,
          systemToCrm: sql`count(case when source_application = 'system' and target_application = 'crm' then 1 end)`,
          systemToHr: sql`count(case when source_application = 'system' and target_application = 'hr' then 1 end)`,
          systemToAffiliate: sql`count(case when source_application = 'system' and target_application = 'affiliate' then 1 end)`,

          // Acknowledgment counts
          acknowledged: sql`count(case when acknowledged = true then 1 end)`,
          crmToHrAck: sql`count(case when source_application = 'crm' and target_application = 'hr' and acknowledged = true then 1 end)`,
          crmToAffiliateAck: sql`count(case when source_application = 'crm' and target_application = 'affiliate' and acknowledged = true then 1 end)`,
          crmToSystemAck: sql`count(case when source_application = 'crm' and target_application = 'system' and acknowledged = true then 1 end)`,
          hrToCrmAck: sql`count(case when source_application = 'hr' and target_application = 'crm' and acknowledged = true then 1 end)`,
          hrToAffiliateAck: sql`count(case when source_application = 'hr' and target_application = 'affiliate' and acknowledged = true then 1 end)`,
          hrToSystemAck: sql`count(case when source_application = 'hr' and target_application = 'system' and acknowledged = true then 1 end)`,
          affiliateToCrmAck: sql`count(case when source_application = 'affiliate' and target_application = 'crm' and acknowledged = true then 1 end)`,
          affiliateToHrAck: sql`count(case when source_application = 'affiliate' and target_application = 'hr' and acknowledged = true then 1 end)`,
          affiliateToSystemAck: sql`count(case when source_application = 'affiliate' and target_application = 'system' and acknowledged = true then 1 end)`,
          systemToCrmAck: sql`count(case when source_application = 'system' and target_application = 'crm' and acknowledged = true then 1 end)`,
          systemToHrAck: sql`count(case when source_application = 'system' and target_application = 'hr' and acknowledged = true then 1 end)`,
          systemToAffiliateAck: sql`count(case when source_application = 'system' and target_application = 'affiliate' and acknowledged = true then 1 end)`
        })
        .from(eventTracking)
        .where(and(
          eq(eventTracking.tenantId, tenantId),
          sql`${eventTracking.streamKey} = 'inter-app-events'` // Only inter-app events
        ));

      // Transform into readable matrix (counts from sql can be string or number)
      const totalEvents = Number(matrix.totalEvents) || 0;
      const acknowledged = Number(matrix.acknowledged) || 0;
      const communicationMatrix = {
        tenantId,
        totalInterAppEvents: totalEvents,
        communicationFlows: {
          'CRM → HR': {
            events: Number(matrix.crmToHr) || 0,
            acknowledged: Number(matrix.crmToHrAck) || 0,
            successRate: Number(matrix.crmToHr) > 0 ?
              ((Number(matrix.crmToHrAck) / Number(matrix.crmToHr)) * 100).toFixed(2) : '0.00'
          },
          'CRM → Affiliate': {
            events: Number(matrix.crmToAffiliate) || 0,
            acknowledged: Number(matrix.crmToAffiliateAck) || 0,
            successRate: Number(matrix.crmToAffiliate) > 0 ?
              ((Number(matrix.crmToAffiliateAck) / Number(matrix.crmToAffiliate)) * 100).toFixed(2) : '0.00'
          },
          'CRM → System': {
            events: Number(matrix.crmToSystem) || 0,
            acknowledged: Number(matrix.crmToSystemAck) || 0,
            successRate: Number(matrix.crmToSystem) > 0 ?
              ((Number(matrix.crmToSystemAck) / Number(matrix.crmToSystem)) * 100).toFixed(2) : '0.00'
          },
          'HR → CRM': {
            events: Number(matrix.hrToCrm) || 0,
            acknowledged: Number(matrix.hrToCrmAck) || 0,
            successRate: Number(matrix.hrToCrm) > 0 ?
              ((Number(matrix.hrToCrmAck) / Number(matrix.hrToCrm)) * 100).toFixed(2) : '0.00'
          },
          'HR → Affiliate': {
            events: Number(matrix.hrToAffiliate) || 0,
            acknowledged: Number(matrix.hrToAffiliateAck) || 0,
            successRate: Number(matrix.hrToAffiliate) > 0 ?
              ((Number(matrix.hrToAffiliateAck) / Number(matrix.hrToAffiliate)) * 100).toFixed(2) : '0.00'
          },
          'HR → System': {
            events: Number(matrix.hrToSystem) || 0,
            acknowledged: Number(matrix.hrToSystemAck) || 0,
            successRate: Number(matrix.hrToSystem) > 0 ?
              ((Number(matrix.hrToSystemAck) / Number(matrix.hrToSystem)) * 100).toFixed(2) : '0.00'
          },
          'Affiliate → CRM': {
            events: Number(matrix.affiliateToCrm) || 0,
            acknowledged: Number(matrix.affiliateToCrmAck) || 0,
            successRate: Number(matrix.affiliateToCrm) > 0 ?
              ((Number(matrix.affiliateToCrmAck) / Number(matrix.affiliateToCrm)) * 100).toFixed(2) : '0.00'
          },
          'Affiliate → HR': {
            events: Number(matrix.affiliateToHr) || 0,
            acknowledged: Number(matrix.affiliateToHrAck) || 0,
            successRate: Number(matrix.affiliateToHr) > 0 ?
              ((Number(matrix.affiliateToHrAck) / Number(matrix.affiliateToHr)) * 100).toFixed(2) : '0.00'
          },
          'Affiliate → System': {
            events: Number(matrix.affiliateToSystem) || 0,
            acknowledged: Number(matrix.affiliateToSystemAck) || 0,
            successRate: Number(matrix.affiliateToSystem) > 0 ?
              ((Number(matrix.affiliateToSystemAck) / Number(matrix.affiliateToSystem)) * 100).toFixed(2) : '0.00'
          },
          'System → CRM': {
            events: Number(matrix.systemToCrm) || 0,
            acknowledged: Number(matrix.systemToCrmAck) || 0,
            successRate: Number(matrix.systemToCrm) > 0 ?
              ((Number(matrix.systemToCrmAck) / Number(matrix.systemToCrm)) * 100).toFixed(2) : '0.00'
          },
          'System → HR': {
            events: Number(matrix.systemToHr) || 0,
            acknowledged: Number(matrix.systemToHrAck) || 0,
            successRate: Number(matrix.systemToHr) > 0 ?
              ((Number(matrix.systemToHrAck) / Number(matrix.systemToHr)) * 100).toFixed(2) : '0.00'
          },
          'System → Affiliate': {
            events: Number(matrix.systemToAffiliate) || 0,
            acknowledged: Number(matrix.systemToAffiliateAck) || 0,
            successRate: Number(matrix.systemToAffiliate) > 0 ?
              ((Number(matrix.systemToAffiliateAck) / Number(matrix.systemToAffiliate)) * 100).toFixed(2) : '0.00'
          }
        },
        overallSuccessRate: totalEvents > 0 ?
          ((acknowledged / totalEvents) * 100).toFixed(2) : '0.00'
      };

      return communicationMatrix as Record<string, unknown>;
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Failed to get communication matrix for tenant ${tenantId}:`, error);
      throw error;
    }
  }
}
