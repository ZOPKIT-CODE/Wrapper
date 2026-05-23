import { sql as drizzleSql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import Logger from '../../../utils/logger.js';
import { snsSqsPublisher } from '../utils/sns-sqs-publisher.js';

/**
 * OutboxPoller — durability layer for inter-app SNS events.
 *
 * The publisher writes every event to inter_app_outbox first, then attempts
 * the SNS publish. If the publish fails (circuit breaker open, network error)
 * the outbox row remains with published_at = NULL. This poller picks those
 * rows up on its tick and retries them.
 *
 * Cluster-wide single-runner is enforced via pg_try_advisory_lock(8001) — only
 * one wrapper pod ever processes outbox rows on a given tick.
 */

// Lock key chosen to not collide with existing advisory locks in the wrapper:
//   7001/7002/7003 — trial-manager (utils/trial-manager.ts)
//   719_001       — event_tracking nightly cleanup (app-fastify.ts)
//   8001          — this poller
const OUTBOX_POLLER_LOCK_KEY = Number(process.env.OUTBOX_POLLER_LOCK_KEY ?? 8001);

// Don't keep retrying forever. Beyond this attempts/row the operator should
// intervene — we still log an error each tick so the row stays visible.
const ALERT_AT_ATTEMPTS = 100;

// Minimum gap between retry attempts for the same row, so we don't spin on a
// persistent failure (e.g. circuit breaker open the entire window).
const RETRY_BACKOFF_SECONDS = Number(process.env.OUTBOX_RETRY_BACKOFF_SECONDS ?? 30);

interface OutboxRow {
  id: string;
  eventId: string;
  eventType: string;
  targetApplication: string;
  payload: Record<string, unknown>;
  messageAttributes: Record<string, { DataType: string; StringValue: string }> | null;
  attemptCount: number;
}

export class OutboxPoller {
  private intervalMs: number;
  private maxBatch: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(opts: { intervalMs?: number; maxBatch?: number } = {}) {
    this.intervalMs = opts.intervalMs ?? Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 10_000);
    this.maxBatch = opts.maxBatch ?? Number(process.env.OUTBOX_POLL_BATCH ?? 50);
  }

  start(): void {
    if (this.timer) return; // already started
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    Logger.log('info', 'general', 'outbox-poller', 'Outbox poller started', {
      intervalMs: this.intervalMs,
      maxBatch: this.maxBatch,
      lockKey: OUTBOX_POLLER_LOCK_KEY,
    });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Single poll iteration. Acquires an advisory lock so only one pod processes
   * outbox rows at a time, then drains up to maxBatch unpublished rows.
   * Never throws — failures are logged and the next tick retries.
   */
  private async tick(): Promise<void> {
    if (this.running) {
      // Previous tick still in flight — skip to avoid pile-up.
      return;
    }
    this.running = true;

    let lockAcquired = false;
    try {
      const lockRows = await db.execute(
        drizzleSql`SELECT pg_try_advisory_lock(${drizzleSql.raw(String(OUTBOX_POLLER_LOCK_KEY))}) AS acquired`,
      );
      // Postgres returns the value as boolean; node-postgres types it loosely.
      lockAcquired = !!(lockRows as any)?.[0]?.acquired;

      if (!lockAcquired) {
        // Another pod is processing — that's fine.
        return;
      }

      const rows = await this.fetchBatch();
      if (rows.length === 0) return;

      Logger.log('info', 'general', 'outbox-poller', `Processing ${rows.length} unpublished outbox rows`);

      for (const row of rows) {
        await this.processRow(row);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      Logger.log('error', 'general', 'outbox-poller', 'Tick failed (non-fatal — next tick will retry)', { error: errMsg });
    } finally {
      if (lockAcquired) {
        try {
          await db.execute(
            drizzleSql`SELECT pg_advisory_unlock(${drizzleSql.raw(String(OUTBOX_POLLER_LOCK_KEY))})`,
          );
        } catch {
          // No-op: a lock we never acquired can't be released.
        }
      }
      this.running = false;
    }
  }

  private async fetchBatch(): Promise<OutboxRow[]> {
    const result = await db.execute(drizzleSql`
      SELECT id,
             event_id            AS "eventId",
             event_type          AS "eventType",
             target_application  AS "targetApplication",
             payload,
             message_attributes  AS "messageAttributes",
             attempt_count       AS "attemptCount"
      FROM   inter_app_outbox
      WHERE  published_at IS NULL
        AND  (last_attempt_at IS NULL
              OR last_attempt_at < now() - (${RETRY_BACKOFF_SECONDS}::int || ' seconds')::interval)
      ORDER  BY created_at
      LIMIT  ${this.maxBatch}
    `);
    return (result as unknown as OutboxRow[]) ?? [];
  }

  private async processRow(row: OutboxRow): Promise<void> {
    // Defensive parsing — jsonb columns can come back as objects or strings
    // depending on the driver path.
    const message =
      typeof row.payload === 'string'
        ? (JSON.parse(row.payload) as Record<string, unknown>)
        : row.payload;
    const attrs =
      row.messageAttributes && typeof row.messageAttributes === 'string'
        ? (JSON.parse(row.messageAttributes) as Record<string, { DataType: string; StringValue: string }>)
        : (row.messageAttributes ?? {});

    try {
      const snsMessageId = await snsSqsPublisher.publishOutboxRow({
        eventId: row.eventId,
        message,
        messageAttributes: attrs,
      });

      await db.execute(drizzleSql`
        UPDATE inter_app_outbox
        SET published_at    = now(),
            attempt_count   = attempt_count + 1,
            last_attempt_at = now(),
            last_error      = NULL
        WHERE id = ${row.id}
          AND published_at IS NULL
      `);

      Logger.log('info', 'general', 'outbox-poller', `Re-published from outbox: ${row.eventType} → ${row.targetApplication}`, {
        eventId: row.eventId,
        snsMessageId,
        attemptCount: row.attemptCount + 1,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const nextAttempt = row.attemptCount + 1;

      try {
        await db.execute(drizzleSql`
          UPDATE inter_app_outbox
          SET attempt_count   = attempt_count + 1,
              last_attempt_at = now(),
              last_error      = ${errMsg}
          WHERE id = ${row.id}
        `);
      } catch (updateErr) {
        const updateErrMsg = updateErr instanceof Error ? updateErr.message : String(updateErr);
        Logger.log('warning', 'general', 'outbox-poller', 'Failed to update outbox row after failed retry', {
          eventId: row.eventId,
          error: updateErrMsg,
        });
      }

      if (nextAttempt > ALERT_AT_ATTEMPTS) {
        Logger.log('error', 'general', 'outbox-poller', `Outbox row stuck after ${nextAttempt} attempts — operator intervention required`, {
          eventId: row.eventId,
          eventType: row.eventType,
          targetApplication: row.targetApplication,
          error: errMsg,
        });
      } else {
        Logger.log('warning', 'general', 'outbox-poller', `Retry failed (will try again next tick): ${row.eventType} → ${row.targetApplication}`, {
          eventId: row.eventId,
          attemptCount: nextAttempt,
          error: errMsg,
        });
      }
    }
  }
}
