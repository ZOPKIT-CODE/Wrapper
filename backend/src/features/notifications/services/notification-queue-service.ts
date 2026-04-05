import sqsJobQueue from '../../messaging/services/sqs-job-queue.js';
import { NotificationService } from './notification-service.js';
import { broadcastToTenant } from '../../../utils/websocket-server.js';

/**
 * Notification Queue Service
 * Handles async processing of notifications using SQS job queues.
 */
const isSqsConfigured = () => {
  return !!(
    process.env.SQS_NOTIFICATIONS_IMMEDIATE_URL ||
    process.env.SQS_NOTIFICATIONS_BULK_URL ||
    process.env.SQS_NOTIFICATIONS_SCHEDULED_URL
  );
};

class NotificationQueueService {
  private jobQueue: typeof sqsJobQueue;
  private notificationService: InstanceType<typeof NotificationService>;
  private workers: Record<string, unknown>;
  private workersInitialized: boolean;

  constructor() {
    this.jobQueue = sqsJobQueue;
    this.notificationService = new NotificationService();
    this.workers = {};
    this.workersInitialized = false;

    if (isSqsConfigured()) {
      this.initializeWorkers().catch((err: unknown) => {
        const e = err as Error;
        console.warn('⚠️ [Notification Queue] Could not initialise SQS workers (app running without job queue):', e.message);
      });
    }
  }

  /**
   * Initialize workers for each queue
   */
  async initializeWorkers() {
    // Connect to AWS MQ
    await this.jobQueue.connect();

    // Set up processors for each queue type
    const processors = {
      immediate: async (data: { notificationData: Record<string, unknown>; tenantId: string }) => {
        return await this.processNotification(data);
      },
      bulk: async (data: { notifications: Array<{ notificationData: Record<string, unknown>; tenantId: string }>; batchSize?: number }) => {
        return await this.processBulkNotifications(data);
      },
      scheduled: async (data: { notificationData: Record<string, unknown>; tenantId: string }) => {
        return await this.processNotification(data);
      }
    };

    // Initialize workers with processors
    await this.jobQueue.initializeWorkers(processors as Parameters<typeof this.jobQueue.initializeWorkers>[0]);
    this.workersInitialized = true;
    console.log('✅ Notification queue workers initialized');
  }

  /**
   * Process a single notification
   */
  async processNotification(data: { notificationData: Record<string, unknown>; tenantId: string }): Promise<{ success: boolean; notificationId?: string; tenantId: string }> {
    try {
      const { notificationData, tenantId } = data;

      const notification = await this.notificationService.createNotification({
        ...notificationData,
        tenantId
      } as Parameters<InstanceType<typeof NotificationService>['createNotification']>[0]);

      try {
        broadcastToTenant(tenantId, notification);
      } catch (wsErr: unknown) {
        const wsError = wsErr as Error;
        console.warn(`WebSocket broadcast failed for tenant ${tenantId}:`, wsError.message);
        // Don't fail the job if WebSocket fails
      }

      return {
        success: true,
        notificationId: notification.notificationId,
        tenantId
      };
    } catch (err: unknown) {
      console.error('Error processing notification:', err);
      throw err;
    }
  }

  /**
   * Process bulk notifications (batch of 100)
   */
  async processBulkNotifications(data: { notifications: Array<{ notificationData: Record<string, unknown>; tenantId: string }>; batchSize?: number }): Promise<{ success: boolean; processed: number; succeeded: number; failed: number; results: unknown[] }> {
    try {
      const { notifications, batchSize = 100 } = data;
      const results: Array<{ index: number; success: boolean; data: unknown; error: string | null }> = [];

      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
          batch.map((notif: { notificationData: Record<string, unknown>; tenantId: string }) => this.processNotification(notif))
        );

        results.push(...batchResults.map((result, idx) => ({
          index: i + idx,
          success: result.status === 'fulfilled',
          data: result.status === 'fulfilled' ? result.value : null,
          error: result.status === 'rejected' ? (result.reason as Error).message : null
        })));
      }

      return {
        success: true,
        processed: results.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (err: unknown) {
      console.error('Error processing bulk notifications:', err);
      throw err;
    }
  }

  /**
   * Add immediate notification to queue
   */
  async addImmediate(notificationData: Record<string, unknown>, tenantId: string, options: { priority?: number; attempts?: number } = {}): Promise<unknown> {
    try {
      return await this.jobQueue.addImmediate(
        { notificationData, tenantId },
        tenantId,
        { priority: options.priority ?? 0, attempts: options.attempts ?? 3 }
      );
    } catch (err: unknown) {
      console.error('Error adding immediate notification to queue:', err);
      throw err;
    }
  }

  async addBulk(notifications: Array<Record<string, unknown> & { tenantId: string }>, options: { priority?: number; attempts?: number; batchSize?: number } = {}): Promise<unknown> {
    try {
      return await this.jobQueue.addBulk(notifications, {
        priority: options.priority ?? 0,
        attempts: options.attempts ?? 2,
        batchSize: options.batchSize ?? 100
      });
    } catch (err: unknown) {
      console.error('Error adding bulk notifications to queue:', err);
      throw err;
    }
  }

  async schedule(notificationData: Record<string, unknown>, tenantId: string, scheduledAt: Date, options: { attempts?: number; priority?: number } = {}): Promise<unknown> {
    try {
      return await this.jobQueue.schedule(notificationData, tenantId, scheduledAt, {
        attempts: options.attempts ?? 3,
        priority: options.priority ?? 0
      });
    } catch (err: unknown) {
      console.error('Error scheduling notification:', err);
      throw err;
    }
  }

  async getJobStatus(queueName: string, jobId: string): Promise<unknown> {
    try {
      return await this.jobQueue.getJobStatus(queueName, jobId);
    } catch (err: unknown) {
      console.error('Error getting job status:', err);
      throw err;
    }
  }

  async cancelJob(queueName: string, jobId: string): Promise<unknown> {
    try {
      return await this.jobQueue.cancelJob(queueName, jobId);
    } catch (err: unknown) {
      console.error('Error canceling job:', err);
      throw err;
    }
  }

  async getQueueStats(queueName: string): Promise<unknown> {
    try {
      return await this.jobQueue.getQueueStats(queueName);
    } catch (err: unknown) {
      console.error('Error getting queue stats:', err);
      throw err;
    }
  }

  async close(): Promise<void> {
    try {
      await this.jobQueue.close();
      console.log('✅ All notification queues and workers closed');
    } catch (err: unknown) {
      console.error('Error closing queues:', err);
      throw err;
    }
  }
}

export const notificationQueueService = new NotificationQueueService();
export default notificationQueueService;

