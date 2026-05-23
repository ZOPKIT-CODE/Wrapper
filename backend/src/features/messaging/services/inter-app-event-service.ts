import { db } from '../../../db/index.js';
import { eventTracking } from '../../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { snsSqsPublisher } from '../utils/sns-sqs-publisher.js';
import { EventTrackingService } from './event-tracking-service.js';
import Logger from '../../../utils/logger.js';

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
        Logger.log('info', 'general', 'publishEvent', `Inter-app event published: ${sourceApplication} → ${targetApplication} (${eventType})`);
        return publishResult;
      }
    } catch (err: unknown) {
      const error = err as Error;
      await EventTrackingService.markEventFailed(eventId, error.message, true).catch(() => {});
      Logger.log('error', 'general', 'publishEvent', `Failed to publish inter-app event ${sourceApplication} → ${targetApplication}`, { error: error.message });
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
      // Dynamic query: group by actual source/target pairs in the DB instead of
      // hardcoded app codes (previously referenced stale codes: hr, affiliate, system).
      const rows = await db
        .select({
          sourceApplication: eventTracking.sourceApplication,
          targetApplication: eventTracking.targetApplication,
          total: sql`count(*)`,
          acknowledged: sql`count(case when acknowledged = true then 1 end)`,
        })
        .from(eventTracking)
        .where(and(
          eq(eventTracking.tenantId, tenantId),
          sql`${eventTracking.streamKey} = 'inter-app-events'`,
        ))
        .groupBy(eventTracking.sourceApplication, eventTracking.targetApplication);

      const communicationFlows: Record<string, { events: number; acknowledged: number; successRate: string }> = {};
      let totalEvents = 0;
      let totalAcknowledged = 0;

      for (const row of rows) {
        const src = row.sourceApplication ?? 'unknown';
        const tgt = row.targetApplication ?? 'unknown';
        const events = Number(row.total) || 0;
        const acked = Number(row.acknowledged) || 0;
        communicationFlows[`${src.toUpperCase()} → ${tgt.toUpperCase()}`] = {
          events,
          acknowledged: acked,
          successRate: events > 0 ? ((acked / events) * 100).toFixed(2) : '0.00',
        };
        totalEvents += events;
        totalAcknowledged += acked;
      }

      return {
        tenantId,
        totalInterAppEvents: totalEvents,
        communicationFlows,
        overallSuccessRate: totalEvents > 0
          ? ((totalAcknowledged / totalEvents) * 100).toFixed(2)
          : '0.00',
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getCommunicationMatrix', `Failed to get communication matrix for tenant ${tenantId}`, { error: error.message });
      throw error;
    }
  }
}
