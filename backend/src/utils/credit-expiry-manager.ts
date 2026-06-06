import cron, { ScheduledTask } from 'node-cron';
import * as Sentry from '@sentry/node';
import { sql as drizzleSql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { CreditExpiryService } from '../features/credits/services/credit-expiry-service.js';
import Logger from './logger.js';

/**
 * Credit Expiry Manager
 * Manages scheduled jobs for processing expired credits
 */
class CreditExpiryManager {
  private isRunning = false;
  private cronJobs: ScheduledTask[] = [];
  private lastHealthCheck: Date | null = null;
  private errorCount = 0;
  private readonly maxErrors = 5;

  constructor() {}

  /**
   * Start credit expiry monitoring
   */
  startExpiryMonitoring() {
    if (this.isRunning) {
      Logger.log('warning', 'credits', 'expiry-monitor-start', 'Credit expiry monitoring is already running');
      return;
    }

    Logger.log('info', 'credits', 'expiry-monitor-start', 'Starting credit expiry monitoring system...');

    try {
      // Process expired credits — schedule configurable via CREDIT_EXPIRY_CRON_SCHEDULE env var.
      // Default: every hour. For dev testing set to '* * * * *' (every minute).
      const expirySchedule = process.env.CREDIT_EXPIRY_CRON ?? '0 * * * *';
      Logger.log('info', 'credits', 'expiry-monitor-start', `[CreditExpiryManager] Expiry cron schedule: ${expirySchedule}`, { expirySchedule });
      const expiryJob = cron.schedule(expirySchedule, async () => {
        const CREDIT_EXPIRY_LOCK_ID = 7010;
        const [lockResult] = await db.execute(drizzleSql`SELECT pg_try_advisory_lock(${drizzleSql.raw(String(CREDIT_EXPIRY_LOCK_ID))}) as acquired`);
        if (!lockResult?.acquired) {
          Logger.log('info', 'credits', 'expiry-cron', '[CreditExpiryManager] Skipping expiry check — another instance holds the lock');
          return;
        }
        try {
          Logger.log('info', 'credits', 'expiry-cron', '[CreditExpiryManager] Running scheduled expiry check...');
          // Wrap the sweep in a span so every credit.expired publish it triggers
          // runs under a valid, sampled trace. Without this the cron has no active
          // span, the producer's injectTraceContext carries nothing, and the SQS
          // consumer starts a fresh root — severing the cross-service trace.
          const result = await Sentry.startSpan(
            { name: 'credit-expiry.tick', op: 'cron', attributes: { 'cron.name': 'credit-expiry' } },
            () => CreditExpiryService.processExpiredCredits(),
          );
          this.errorCount = 0; // Reset error count on success
          Logger.log('info', 'credits', 'expiry-cron', '[CreditExpiryManager] Expiry check completed', { result });
        } catch (error) {
          this.errorCount++;
          const err = error as Error;
          Logger.log('error', 'credits', 'expiry-cron', `[CreditExpiryManager] Expiry check failed (${this.errorCount}/${this.maxErrors})`, { errorCount: this.errorCount, maxErrors: this.maxErrors, error: err.message, stack: err.stack });
          Sentry.captureException(err, { tags: { cron: 'credit-expiry', component: 'credit-expiry-manager' } });

          if (this.errorCount >= this.maxErrors) {
            Logger.log('error', 'credits', 'expiry-cron', '[CreditExpiryManager] Too many consecutive errors, stopping expiry monitoring', { errorCount: this.errorCount });
            this.stopExpiryMonitoring();
            // Emit a structured alert — picked up by Elasticsearch/Winston alerting.
            // The /health/detailed endpoint also surfaces this via credit_expiry_runs.
            Logger.log('error', 'credits', 'cron-stopped', `Credit expiry cron stopped after ${this.maxErrors} consecutive failures. Manual intervention required.`, {
              level: 'ALERT',
              service: 'CreditExpiryManager',
              event: 'cron_stopped',
              consecutiveErrors: this.maxErrors,
              timestamp: new Date().toISOString(),
            });
          }
        } finally {
          await db.execute(drizzleSql`SELECT pg_advisory_unlock(${drizzleSql.raw(String(CREDIT_EXPIRY_LOCK_ID))})`);
        }
      });

      // Send expiry warnings daily at 9 AM
      const warningJob = cron.schedule('0 9 * * *', async () => {
        const CREDIT_WARNING_LOCK_ID = 7011;
        const [lockResult] = await db.execute(drizzleSql`SELECT pg_try_advisory_lock(${drizzleSql.raw(String(CREDIT_WARNING_LOCK_ID))}) as acquired`);
        if (!lockResult?.acquired) {
          Logger.log('info', 'credits', 'expiry-warnings', '[CreditExpiryManager] Skipping expiry warnings — another instance holds the lock');
          return;
        }
        try {
          Logger.log('info', 'credits', 'expiry-warnings', '[CreditExpiryManager] Sending expiry warnings...');
          const result = await CreditExpiryService.sendExpiryWarnings(7); // 7 days ahead
          Logger.log('info', 'credits', 'expiry-warnings', '[CreditExpiryManager] Warnings sent', { result });
        } catch (error) {
          const err = error as Error;
          Logger.log('error', 'credits', 'expiry-warnings', '[CreditExpiryManager] Warning job failed', { error: err.message, stack: err.stack });
          Sentry.captureException(err, { tags: { cron: 'credit-expiry-warnings', component: 'credit-expiry-manager' } });
        } finally {
          await db.execute(drizzleSql`SELECT pg_advisory_unlock(${drizzleSql.raw(String(CREDIT_WARNING_LOCK_ID))})`);
        }
      });

      // Health check job - every 15 minutes
      const healthCheckJob = cron.schedule('*/15 * * * *', async () => {
        this.lastHealthCheck = new Date();
        Logger.log('debug', 'credits', 'health-check', `[CreditExpiryManager] Health check: ${this.lastHealthCheck.toISOString()}`, { lastHealthCheck: this.lastHealthCheck.toISOString() });
      });

      this.cronJobs = [expiryJob, warningJob, healthCheckJob];
      this.isRunning = true;
      this.lastHealthCheck = new Date();
      Logger.log('info', 'credits', 'expiry-monitor-start', '[CreditExpiryManager] Credit expiry monitoring system started');

      // Run initial check after 30 seconds
      setTimeout(() => {
        Sentry.startSpan(
          { name: 'credit-expiry.tick', op: 'cron', attributes: { 'cron.name': 'credit-expiry', 'cron.initial': true } },
          () => CreditExpiryService.processExpiredCredits(),
        ).catch(error => {
          const err = error as Error;
          Logger.log('error', 'credits', 'initial-expiry-check', '[CreditExpiryManager] Initial expiry check failed', { error: err.message, stack: err.stack });
        });
      }, 30000);

    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'credits', 'expiry-monitor-start', '[CreditExpiryManager] Failed to start expiry monitoring', { error: err.message, stack: err.stack });
      Sentry.captureException(err, { tags: { cron: 'credit-expiry', component: 'credit-expiry-manager', phase: 'start' } });
      this.stopExpiryMonitoring();
    }
  }

  /**
   * Stop all monitoring
   */
  stopExpiryMonitoring(): void {
    try {
      this.cronJobs.forEach((job: ScheduledTask) => {
        try {
          job.destroy();
        } catch (error) {
          const err = error as Error;
          Logger.log('error', 'credits', 'expiry-monitor-stop', '[CreditExpiryManager] Error stopping cron job', { error: err.message, stack: err.stack });
        }
      });
      this.cronJobs = [];
      this.isRunning = false;
      Logger.log('info', 'credits', 'expiry-monitor-stop', '[CreditExpiryManager] Credit expiry monitoring stopped');
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'credits', 'expiry-monitor-stop', '[CreditExpiryManager] Error stopping monitoring', { error: err.message, stack: err.stack });
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): { isRunning: boolean; activeJobs: number; lastHealthCheck: Date | null; errorCount: number; maxErrors: number } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.cronJobs.length,
      lastHealthCheck: this.lastHealthCheck,
      errorCount: this.errorCount,
      maxErrors: this.maxErrors
    };
  }

  /**
   * Manually trigger expiry processing
   */
  async processExpiredCredits(): Promise<unknown> {
    try {
      return await CreditExpiryService.processExpiredCredits();
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'credits', 'manual-expire', '[CreditExpiryManager] Manual expiry processing failed', { error: err.message, stack: err.stack });
      throw error;
    }
  }
}

// Export singleton instance
export default new CreditExpiryManager();

