import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import Logger from './logger.js';

type CBState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker that persists state transitions to Postgres.
 *
 * - In-memory fast path: every execute() call reads/writes RAM only.
 * - Persistence: state transitions (open/close/half-open) are written to DB.
 * - Startup recovery: call initialize() once to restore state from DB after a restart.
 *   If the DB is unavailable, starts closed (optimistic — safe for a publisher).
 *
 * Default reset timeout is 5 minutes (300 s) — appropriate for AWS SNS outages.
 */
export class PersistentCircuitBreaker {
  private state: CBState = 'closed';
  private failures = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 300_000, // 5 minutes
  ) {}

  /** Load persisted state from DB. Call once at startup; never throws. */
  async initialize(): Promise<void> {
    try {
      const rows = await db.execute(sql`
        SELECT state, failures, last_failure_time
        FROM   circuit_breaker_state
        WHERE  name = ${this.name}
        LIMIT  1
      `);
      const row = ((rows as any)?.rows ?? (Array.isArray(rows) ? rows : []))[0];
      if (row) {
        this.state           = row.state as CBState;
        this.failures        = Number(row.failures ?? 0);
        this.lastFailureTime = Number(row.last_failure_time ?? 0);
        Logger.log('info', 'resilience', 'restore-state', `[CircuitBreaker:${this.name}] Restored state=${this.state} failures=${this.failures} from DB`, { name: this.name, state: this.state, failures: this.failures });
      }
    } catch {
      // DB might not have the table yet (migration pending) — start fresh.
      Logger.log('warning', 'resilience', 'restore-state', `[CircuitBreaker:${this.name}] Could not restore state from DB; starting closed`, { name: this.name });
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker '${this.name}' is OPEN — service unavailable`);
      }
    }

    try {
      const result = await fn();
      await this.onSuccess();
      return result;
    } catch (error) {
      await this.onFailure();
      throw error;
    }
  }

  private async onSuccess(): Promise<void> {
    if (this.state === 'closed' && this.failures === 0) return; // already clean
    this.failures = 0;
    this.state = 'closed';
    await this.persistState();
  }

  private async onFailure(): Promise<void> {
    this.failures++;
    this.lastFailureTime = Date.now();
    const wasOpen = this.state === 'open';
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      if (!wasOpen) {
        Logger.log('warning', 'resilience', 'breaker-opened', `Circuit breaker '${this.name}' OPENED after ${this.failures} failures`, { name: this.name, failures: this.failures });
      }
    }
    await this.persistState();
  }

  private async persistState(): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO circuit_breaker_state (name, state, failures, last_failure_time, updated_at)
        VALUES (${this.name}, ${this.state}, ${this.failures}, ${this.lastFailureTime}, NOW())
        ON CONFLICT (name) DO UPDATE
          SET state             = EXCLUDED.state,
              failures          = EXCLUDED.failures,
              last_failure_time = EXCLUDED.last_failure_time,
              updated_at        = NOW()
      `);
    } catch {
      // Persistence failure is non-fatal — the in-memory state is still correct.
    }
  }

  getState(): { name: string; state: string; failures: number } {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}
