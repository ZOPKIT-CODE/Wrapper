import { EventTrackingService } from './event-tracking-service.js';
import { db } from '../../../db/index.js';
import { sql } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';

// Stable 32-bit advisory lock key for the outbox replay worker.
// All Wrapper processes compete for the same lock; only one wins per cycle.
// Chosen to be unique within this application's lock namespace.
const OUTBOX_ADVISORY_LOCK_KEY = 0x57524b52; // ASCII "WRKR" as hex

// In-process guard — prevents spinning up multiple timers in the same process.
// The distributed Postgres advisory lock handles multi-process deduplication.
let replayWorkerStarted = false;

/**
 * Attempt to acquire a Postgres session-level advisory lock.
 * pg_try_advisory_lock returns true if acquired, false if another session
 * already holds it (non-blocking — never waits).
 */
async function tryAcquireAdvisoryLock(): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT pg_try_advisory_lock(${OUTBOX_ADVISORY_LOCK_KEY}) AS acquired`
    );
    const rows = result as unknown as Array<{ acquired: boolean }>;
    return rows[0]?.acquired === true;
  } catch {
    // If we can't reach the DB to acquire the lock, skip this cycle safely.
    return false;
  }
}

/**
 * Release the session-level advisory lock.
 * Called when this process is shutting down or loses the lock.
 */
async function releaseAdvisoryLock(): Promise<void> {
  try {
    await db.execute(
      sql`SELECT pg_advisory_unlock(${OUTBOX_ADVISORY_LOCK_KEY})`
    );
  } catch {
    // Best-effort release; Postgres releases session locks on disconnect anyway.
  }
}

export function startOutboxReplayWorker(): void {
  if (replayWorkerStarted) return;
  replayWorkerStarted = true;

  const intervalMs = Number(process.env.OUTBOX_REPLAY_INTERVAL_MS || 30000);
  const batchSize = Number(process.env.OUTBOX_REPLAY_BATCH_SIZE || 100);
  const maxRetries = Number(process.env.OUTBOX_MAX_RETRIES || 10);

  /**
   * Each cycle:
   * 1. Try to acquire the Postgres advisory lock (non-blocking).
   * 2. If acquired → run replay → keep lock for next cycle (session-level lock
   *    persists across transactions, so we hold it until process exit or
   *    explicit release). This means exactly one process runs replay at a time.
   * 3. If not acquired → another Wrapper instance already owns the lock → skip.
   */
  const runReplay = async () => {
    const acquired = await tryAcquireAdvisoryLock();
    if (!acquired) {
      // Another process is the designated replay worker this cycle.
      return;
    }

    try {
      const replayed = await EventTrackingService.replayPendingEvents(batchSize, maxRetries);
      if (replayed > 0) {
        Logger.log('info', 'general', 'startOutboxReplayWorker', `Outbox replay worker republished ${replayed} pending/failed event(s)`, { replayed });
      }
    } catch (error: unknown) {
      Logger.log('error', 'general', 'startOutboxReplayWorker', 'Outbox replay worker (pending) failed', { error: (error as Error)?.message || String(error) });
    }

    // 1 s gap: ensures the shared OUTBOX_REPLAY_MAX_TPS token budget refills between
    // the two replay paths so their chunk boundaries cannot produce a combined TPS burst.
    await new Promise((r) => setTimeout(r, 1000));

    // Also reprocess events stuck as published+unacknowledged (MQ was down at publish time)
    try {
      const reprocessed = await EventTrackingService.replayUnacknowledgedPublishedEvents();
      if (reprocessed > 0) {
        Logger.log('info', 'general', 'startOutboxReplayWorker', `Outbox unack reprocessor redelivered ${reprocessed} event(s)`, { reprocessed });
      }
    } catch (error: unknown) {
      Logger.log('error', 'general', 'startOutboxReplayWorker', 'Outbox replay worker (unack) failed', { error: (error as Error)?.message || String(error) });
    }
  };

  // Release advisory lock on graceful shutdown so another pod can take over.
  const gracefulShutdown = () => {
    void releaseAdvisoryLock();
  };
  process.once('SIGTERM', gracefulShutdown);
  process.once('SIGINT', gracefulShutdown);

  setImmediate(() => {
    void runReplay();
  });

  const timer = setInterval(() => {
    void runReplay();
  }, intervalMs);

  if (typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }
}
