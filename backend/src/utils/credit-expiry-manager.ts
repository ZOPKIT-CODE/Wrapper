import cron, { ScheduledTask } from 'node-cron';
import { CreditExpiryService } from '../features/credits/services/credit-expiry-service.js';

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
      console.log('⚠️ Credit expiry monitoring is already running');
      return;
    }

    console.log('🚀 Starting credit expiry monitoring system...');

    try {
      // Process expired credits — schedule configurable via CREDIT_EXPIRY_CRON_SCHEDULE env var.
      // Default: every hour. For dev testing set to '* * * * *' (every minute).
      const expirySchedule = process.env.CREDIT_EXPIRY_CRON ?? '0 * * * *';
      console.log(`📅 [CreditExpiryManager] Expiry cron schedule: ${expirySchedule}`);
      const expiryJob = cron.schedule(expirySchedule, async () => {
        try {
          console.log('⏰ [CreditExpiryManager] Running scheduled expiry check...');
          const result = await CreditExpiryService.processExpiredCredits();
          this.errorCount = 0; // Reset error count on success
          console.log(`✅ [CreditExpiryManager] Expiry check completed:`, result);
        } catch (error) {
          this.errorCount++;
          console.error(`❌ [CreditExpiryManager] Expiry check failed (${this.errorCount}/${this.maxErrors}):`, error);

          if (this.errorCount >= this.maxErrors) {
            console.error('🚨 [CreditExpiryManager] Too many consecutive errors, stopping expiry monitoring');
            this.stopExpiryMonitoring();
            // Emit a structured alert — picked up by Elasticsearch/Winston alerting.
            // The /health/detailed endpoint also surfaces this via credit_expiry_runs.
            console.error(JSON.stringify({
              level: 'ALERT',
              service: 'CreditExpiryManager',
              event: 'cron_stopped',
              message: `Credit expiry cron stopped after ${this.maxErrors} consecutive failures. Manual intervention required.`,
              consecutiveErrors: this.maxErrors,
              timestamp: new Date().toISOString(),
            }));
          }
        }
      });

      // Send expiry warnings daily at 9 AM
      const warningJob = cron.schedule('0 9 * * *', async () => {
        try {
          console.log('⏰ [CreditExpiryManager] Sending expiry warnings...');
          const result = await CreditExpiryService.sendExpiryWarnings(7); // 7 days ahead
          console.log(`✅ [CreditExpiryManager] Warnings sent:`, result);
        } catch (error) {
          console.error('❌ [CreditExpiryManager] Warning job failed:', error);
        }
      });

      // Health check job - every 15 minutes
      const healthCheckJob = cron.schedule('*/15 * * * *', async () => {
        this.lastHealthCheck = new Date();
        console.log(`💓 [CreditExpiryManager] Health check: ${this.lastHealthCheck.toISOString()}`);
      });

      this.cronJobs = [expiryJob, warningJob, healthCheckJob];
      this.isRunning = true;
      this.lastHealthCheck = new Date();
      console.log('✅ [CreditExpiryManager] Credit expiry monitoring system started');

      // Run initial check after 30 seconds
      setTimeout(() => {
        CreditExpiryService.processExpiredCredits().catch(error => {
          console.error('❌ [CreditExpiryManager] Initial expiry check failed:', error);
        });
      }, 30000);

    } catch (error) {
      console.error('❌ [CreditExpiryManager] Failed to start expiry monitoring:', error);
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
          console.error('⚠️ [CreditExpiryManager] Error stopping cron job:', error);
        }
      });
      this.cronJobs = [];
      this.isRunning = false;
      console.log('🛑 [CreditExpiryManager] Credit expiry monitoring stopped');
    } catch (error) {
      console.error('❌ [CreditExpiryManager] Error stopping monitoring:', error);
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
      console.error('❌ [CreditExpiryManager] Manual expiry processing failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new CreditExpiryManager();

