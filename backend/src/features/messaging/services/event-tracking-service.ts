import { db } from '../../../db/index.js';
import { eventTracking } from '../../../db/schema/index.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { snsSqsPublisher } from '../utils/sns-sqs-publisher.js';

// Maximum rows returned by getUnacknowledgedEvents to prevent OOM on large tenants.
const UNACKNOWLEDGED_EVENTS_LIMIT = Number(process.env.UNACKNOWLEDGED_EVENTS_LIMIT || 500);

export interface TrackPublishedEventParams {
  eventId: string;
  eventType: string;
  tenantId: string;
  entityId?: string | null;
  streamKey: string;
  sourceApplication?: string;
  targetApplication: string;
  eventData?: Record<string, unknown>;
  publishedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Event Tracking Service
 * Tracks events published to external systems and handles acknowledgments
 */
export class EventTrackingService {

  /**
   * Outbox write: persist event as pending before broker publish.
   */
  static async trackPublishedEvent({
    eventId,
    eventType,
    tenantId,
    entityId,
    streamKey,
    sourceApplication = 'wrapper',
    targetApplication,
    eventData,
    publishedBy,
    metadata = {}
  }: TrackPublishedEventParams): Promise<{ tracked: boolean; storage: string }> {
    await db.insert(eventTracking).values({
      eventId,
      eventType,
      tenantId,
      entityId: entityId ?? null,
      streamKey,
      sourceApplication,
      targetApplication,
      eventData: eventData ?? {},
      publishedBy: publishedBy ?? 'system',
      metadata: {
        ...(metadata ?? {}),
        outbox: true,
      },
      status: 'pending',
      acknowledged: false,
    });
    return { tracked: true, storage: 'database' };
  }

  /**
   * Mark an event as acknowledged.
   */
  static async acknowledgeEvent(eventId: string, acknowledgmentData: Record<string, unknown> = {}): Promise<{ acknowledged: boolean; storage: string }> {
    try {
      await db
        .update(eventTracking)
        .set({
          acknowledged: true,
          acknowledgedAt: new Date(),
          status: 'acknowledged',
          metadata: sql`COALESCE(${eventTracking.metadata}, '{}'::jsonb) || ${JSON.stringify({ acknowledgmentData })}::jsonb`,
          updatedAt: new Date(),
        } as any)
        .where(eq(eventTracking.eventId, eventId));
      return { acknowledged: true, storage: 'database' };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Failed to acknowledge event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Mark pending outbox record as published after broker confirms.
   */
  static async markEventPublished(eventId: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await db
      .update(eventTracking)
      .set({
        status: 'published',
        metadata: sql`COALESCE(${eventTracking.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb`,
        updatedAt: new Date(),
      } as any)
      .where(eq(eventTracking.eventId, eventId));
  }

  /**
   * Mark an event as failed.
   * Uses a single atomic UPDATE with inline COALESCE to avoid the SELECT+UPDATE race
   * (previously two round-trips; now one).
   */
  static async markEventFailed(eventId: string, errorMessage: string, incrementRetry = true): Promise<unknown> {
    try {
      const now = new Date();
      const [record] = await db
        .update(eventTracking)
        .set({
          status: 'failed',
          errorMessage,
          // Inline retry-count increment — no separate SELECT needed.
          retryCount: incrementRetry
            ? sql`COALESCE(${eventTracking.retryCount}, 0) + 1`
            : sql`COALESCE(${eventTracking.retryCount}, 0)`,
          lastRetryAt: incrementRetry ? now : sql`${eventTracking.lastRetryAt}`,
          updatedAt: now,
        } as any)
        .where(eq(eventTracking.eventId, eventId))
        .returning();
      return record;
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Failed to mark event ${eventId} as failed:`, error);
      throw error;
    }
  }

  /**
   * Get event status by eventId
   */
  static async getEventStatus(eventId: string): Promise<unknown> {
    try {
      const [record] = await db
        .select()
        .from(eventTracking)
        .where(eq(eventTracking.eventId, eventId))
        .limit(1);

      return record || null;
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Failed to get event status for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get unacknowledged events for a tenant (for reconciliation).
   *
   * Scalability fix: added `.limit(UNACKNOWLEDGED_EVENTS_LIMIT)` to prevent
   * unbounded memory growth when a tenant has thousands of stale events.
   * Callers that need pagination can call repeatedly with an `offset` or
   * narrow the `hoursOld` window.
   */
  static async getUnacknowledgedEvents(
    tenantId: string,
    hoursOld = 24,
    limit = UNACKNOWLEDGED_EVENTS_LIMIT
  ): Promise<unknown[]> {
    try {
      const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));

      const records = await db
        .select()
        .from(eventTracking)
        .where(and(
          eq(eventTracking.tenantId, tenantId),
          eq(eventTracking.acknowledged, false),
          sql`${eventTracking.publishedAt} < ${cutoffTime}`
        ))
        .orderBy(eventTracking.publishedAt)
        .limit(limit);

      return records;
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Failed to get unacknowledged events for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get sync health metrics for a tenant (zero-db-success storage)
   */
  static async getSyncHealthMetrics(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const [dbStats] = await db
        .select({
          failedCount: sql<number>`count(case when status = 'failed' then 1 end)`,
          pendingCount: sql<number>`count(case when status = 'pending' then 1 end)`,
          publishedCount: sql<number>`count(case when status = 'published' then 1 end)`,
          retryingCount: sql<number>`count(case when retry_count > 0 then 1 end)`
        })
        .from(eventTracking)
        .where(eq(eventTracking.tenantId, tenantId));

      const failedCount = parseInt(String(dbStats?.failedCount ?? 0)) || 0;
      const pendingCount = parseInt(String(dbStats?.pendingCount ?? 0)) || 0;
      const publishedCount = parseInt(String(dbStats?.publishedCount ?? 0)) || 0;
      const retryingCount = parseInt(String(dbStats?.retryingCount ?? 0)) || 0;

      const totalEvents = pendingCount + publishedCount + failedCount;
      const failureRate = totalEvents > 0 ? (failedCount / totalEvents) * 100 : 0;
      const healthStatus = failureRate > 20 ? 'degraded' :
                          failureRate > 5 ? 'warning' : 'healthy';

      const metrics = {
        tenantId,
        storageMode: 'database-outbox',
        current: {
          totalPendingEvents: pendingCount,
          failedStoredInDb: failedCount,
          publishedEvents: publishedCount,
          retrying: retryingCount,
          failureRate: failureRate.toFixed(2) + '%'
        },
        channelBreakdown: {},
        health: {
          status: healthStatus,
          message: pendingCount === 0 && failedCount === 0 ?
            'All systems healthy - zero pending events' :
            pendingCount > 0 ?
            `${pendingCount} events pending acknowledgment` :
            `${failedCount} failed events need attention`,
          recommendations: healthStatus === 'degraded' ?
            ['Check consumer processes', 'Review Redis connectivity', 'Check application logs'] :
            []
        },
        performance: {
          databaseStorage: 'Outbox + delivery states',
          redisUsage: 'Not used',
          querySpeed: 'Indexed by tenant + status',
          storageCost: 'Moderate'
        }
      };

      return metrics;
    } catch (error) {
      console.error(`❌ Failed to get sync health metrics for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get inter-application sync health metrics (zero-db-success storage)
   */
  static async getInterAppSyncHealth(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const channelRows = await db
        .select({
          source: eventTracking.sourceApplication,
          target: eventTracking.targetApplication,
          pending: sql<number>`count(case when status = 'pending' then 1 end)`,
          failed: sql<number>`count(case when status = 'failed' then 1 end)`,
          published: sql<number>`count(case when status = 'published' then 1 end)`,
        })
        .from(eventTracking)
        .where(eq(eventTracking.tenantId, tenantId))
        .groupBy(eventTracking.sourceApplication, eventTracking.targetApplication);

      const channels: Record<string, { pending: number; failed: number; published: number; total: number; failureRate: string; health: string }> = {};
      let totalPending = 0;
      let totalFailed = 0;
      let totalPublished = 0;
      for (const row of channelRows) {
        const pCount = Number(row.pending) || 0;
        const failedCount = Number(row.failed) || 0;
        const publishedCount = Number(row.published) || 0;
        const channelKey = `${row.source} → ${row.target}`;
        totalPending += pCount;
        totalFailed += failedCount;
        totalPublished += publishedCount;
        channels[channelKey] = {
          pending: pCount,
          failed: failedCount,
          published: publishedCount,
          total: pCount + failedCount + publishedCount,
          failureRate: (pCount + failedCount) > 0 ?
            (failedCount / (pCount + failedCount) * 100).toFixed(2) + '%' : '0%',
          health: (pCount + failedCount) > 0 && (failedCount / (pCount + failedCount)) > 0.1 ?
            'degraded' : 'healthy'
        };
      }

      return {
        tenantId,
        storageMode: 'database-outbox',
        summary: {
          totalPendingEvents: totalPending,
          totalFailedEventsStored: totalFailed,
          totalPublishedEvents: totalPublished,
          overallFailureRate: (totalPending + totalFailed + totalPublished) > 0 ?
            (totalFailed / (totalPending + totalFailed + totalPublished) * 100).toFixed(2) + '%' : '0%'
        },
        byChannel: channels,
        insights: {
          message: totalPending === 0 && totalFailed === 0 ?
            'All inter-app communication healthy' :
            totalPending > 0 ?
            `${totalPending} events pending between apps` :
            `${totalFailed} failed inter-app communications`,
          recommendations: totalFailed > 3 ?
            ['Check inter-app consumer processes', 'Review DLQ and outbox replay worker', 'Check application connectivity'] :
            []
        }
      };
    } catch (error) {
      console.error(`❌ Failed to get inter-app sync health for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Replay pending/failed outbox events with bounded retries.
   *
   * Scalability fix: instead of one DB write per event (N+1), we now collect
   * succeeded / failed event IDs and flush them with two bulk UPDATE statements
   * (at most 2 round-trips regardless of batch size).
   */
  static async replayPendingEvents(maxBatchSize = 100, maxRetries = 10): Promise<number> {
    const rows = await db
      .select()
      .from(eventTracking)
      .where(
        and(
          sql`${eventTracking.status} in ('pending','failed')`,
          sql`COALESCE(${eventTracking.retryCount}, 0) < ${maxRetries}`
        )
      )
      .limit(maxBatchSize);

    if (rows.length === 0) return 0;

    const succeededIds: string[] = [];
    const failedMap = new Map<string, string>(); // eventId → error message

    // Publish all events concurrently (broker publish is I/O bound, not DB bound).
    // Use allSettled so one failure does not abort the rest.
    const publishResults = await Promise.allSettled(
      rows.map((row) =>
        snsSqsPublisher.publishInterAppEvent({
          eventId: row.eventId,
          eventType: row.eventType,
          sourceApplication: row.sourceApplication,
          targetApplication: row.targetApplication,
          tenantId: row.tenantId,
          entityId: row.entityId || '',
          eventData: (row.eventData as Record<string, unknown>) || {},
          publishedBy: row.publishedBy || 'outbox-replay-worker',
        })
      )
    );

    publishResults.forEach((result, i) => {
      const row = rows[i];
      if (result.status === 'fulfilled') {
        succeededIds.push(row.eventId);
      } else {
        failedMap.set(
          row.eventId,
          (result.reason as Error)?.message || 'Replay failed'
        );
      }
    });

    const now = new Date();
    const replayedAt = now.toISOString();

    // Bulk UPDATE succeeded events (1 round-trip for up to maxBatchSize rows).
    if (succeededIds.length > 0) {
      await db
        .update(eventTracking)
        .set({
          status: 'published',
          metadata: sql`COALESCE(${eventTracking.metadata}, '{}'::jsonb) || ${JSON.stringify({ replayedAt })}::jsonb`,
          updatedAt: now,
        } as any)
        .where(inArray(eventTracking.eventId, succeededIds));
    }

    // Bulk UPDATE failed events — increment retry_count inline with CASE expression.
    if (failedMap.size > 0) {
      const failedIds = Array.from(failedMap.keys());
      // Use a single UPDATE with CASE to set individual error messages per row.
      const caseExpr = sql.raw(
        failedIds
          .map((id) => `WHEN event_id = '${id.replace(/'/g, "''")}' THEN ${JSON.stringify(failedMap.get(id) ?? 'Replay failed').replace(/'/g, "''")}`)
          .join(' ')
      );
      await db
        .update(eventTracking)
        .set({
          status: 'failed',
          errorMessage: sql`CASE ${caseExpr} ELSE error_message END`,
          retryCount: sql`COALESCE(${eventTracking.retryCount}, 0) + 1`,
          lastRetryAt: now,
          updatedAt: now,
        } as any)
        .where(inArray(eventTracking.eventId, failedIds));
    }

    return succeededIds.length;
  }

  /**
   * Reprocess events that were marked as 'published' in the outbox but were
   * never acknowledged by downstream consumers (acknowledged=false).
   * This handles the case where MQ was disconnected at publish time and the
   * fire-and-forget publisher wrote 'published' status without broker delivery.
   *
   * Runs separately from replayPendingEvents which only handles 'pending'/'failed'.
   */
  static async replayUnacknowledgedPublishedEvents(
    staleSinceMs = 5 * 60 * 1000, // default: older than 5 minutes
    maxBatchSize = 50
  ): Promise<number> {
    const cutoff = new Date(Date.now() - staleSinceMs);
    const rows = await db
      .select()
      .from(eventTracking)
      .where(
        and(
          eq(eventTracking.acknowledged, false),
          eq(eventTracking.status, 'published'),
          sql`${eventTracking.createdAt} < ${cutoff}`
        )
      )
      .limit(maxBatchSize);

    if (rows.length === 0) return 0;

    const succeededIds: string[] = [];
    const failedMap = new Map<string, string>();

    const results = await Promise.allSettled(
      rows.map((row) =>
        snsSqsPublisher.publishInterAppEvent({
          eventId: row.eventId,
          eventType: row.eventType,
          sourceApplication: row.sourceApplication,
          targetApplication: row.targetApplication,
          tenantId: row.tenantId,
          entityId: row.entityId || '',
          eventData: (row.eventData as Record<string, unknown>) || {},
          publishedBy: row.publishedBy || 'outbox-unack-reprocessor',
        })
      )
    );

    results.forEach((result, i) => {
      const row = rows[i];
      if (result.status === 'fulfilled') {
        succeededIds.push(row.eventId);
      } else {
        failedMap.set(row.eventId, (result.reason as Error)?.message || 'Reprocess failed');
      }
    });

    const now = new Date();
    if (succeededIds.length > 0) {
      await db
        .update(eventTracking)
        .set({
          retryCount: sql`COALESCE(${eventTracking.retryCount}, 0) + 1`,
          lastRetryAt: now,
          updatedAt: now,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .where(inArray(eventTracking.eventId, succeededIds));
    }
    if (failedMap.size > 0) {
      const failedIds = Array.from(failedMap.keys());
      await db
        .update(eventTracking)
        .set({
          status: 'failed',
          retryCount: sql`COALESCE(${eventTracking.retryCount}, 0) + 1`,
          lastRetryAt: now,
          updatedAt: now,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .where(inArray(eventTracking.eventId, failedIds));
    }

    return succeededIds.length;
  }

  /**
   * Clean up old events
   */
  static async cleanupOldEvents(daysOld = 7): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));

      const deleteResult = await db
        .delete(eventTracking)
        .where(sql`${eventTracking.publishedAt} < ${cutoffDate}`);
      const totalCleaned = (deleteResult as { rowCount?: number })?.rowCount ?? 0;

      console.log(`🧹 Cleaned up ${totalCleaned} old tracked events from database`);
      return totalCleaned;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to cleanup old events:', error);
      throw error;
    }
  }
}
