import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import * as Sentry from '@sentry/node';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueProcessors {
  immediate?: (data: Record<string, unknown>) => Promise<unknown>;
  bulk?: (data: Record<string, unknown>) => Promise<unknown>;
  scheduled?: (data: Record<string, unknown>) => Promise<unknown>;
}

interface JobStatusEntry {
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
  failedAt?: Date;
  attemptsMade?: number;
  createdAt?: Date;
  scheduledAt?: Date;
  cancelledAt?: Date;
}

interface ImmediateJobPayload {
  jobId: string;
  type: string;
  data: Record<string, unknown>;
  tenantId: string;
  priority: number;
  maxAttempts: number;
  attempts: number;
  createdAt: string;
}

interface BulkJobPayload {
  jobId: string;
  type: string;
  data: { notifications: unknown[]; batchSize: number };
  priority: number;
  maxAttempts: number;
  attempts: number;
  createdAt: string;
}

interface ScheduledJobPayload {
  jobId: string;
  type: string;
  data: { notificationData: unknown; tenantId: string };
  scheduledAt: string;
  priority: number;
  maxAttempts: number;
  attempts: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SQS_MAX_DELAY_SECONDS = 900; // 15 minutes — hard SQS limit

function buildJobId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function exponentialBackoffMs(attempts: number): number {
  return Math.min(2000 * Math.pow(2, attempts), 30_000);
}

// ---------------------------------------------------------------------------
// SqsJobQueue
// ---------------------------------------------------------------------------

/**
 * SQS-backed job queue.
 *
 * The AWS SDK is stateless; no persistent connection is needed.
 * Workers use SQS long-polling (WaitTimeSeconds=20) to minimise API calls.
 */
class SqsJobQueue {
  private readonly client: SQSClient;

  readonly queues: { immediate?: string; bulk?: string; scheduled?: string };

  /** In-memory job-status tracking (same interface as the MQ predecessor). */
  readonly jobStatus = new Map<string, JobStatusEntry>();

  /** AbortControllers for each active polling loop — used by close(). */
  private readonly pollingAbortControllers = new Map<string, AbortController>();

  constructor() {
    this.client = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

    this.queues = {
      immediate: process.env.SQS_NOTIFICATIONS_IMMEDIATE_URL || undefined,
      bulk: process.env.SQS_NOTIFICATIONS_BULK_URL || undefined,
      scheduled: process.env.SQS_NOTIFICATIONS_SCHEDULED_URL || undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Configuration guard
  // -------------------------------------------------------------------------

  /** Returns true if at least one queue URL is configured. */
  isConfigured(): boolean {
    return Object.values(this.queues).some(Boolean);
  }

  // -------------------------------------------------------------------------
  // addImmediate
  // -------------------------------------------------------------------------

  async addImmediate(
    data: Record<string, unknown>,
    tenantId?: string,
    options: Record<string, unknown> = {},
  ): Promise<{ jobId: string; queue: string }> {
    const queueUrl = this.queues.immediate;
    if (!queueUrl) {
      throw new Error('SQS_NOTIFICATIONS_IMMEDIATE_URL is not configured');
    }

    const jobId = (options.jobId as string | undefined) ?? buildJobId('job');
    const payload: ImmediateJobPayload = {
      jobId,
      type: 'send-notification',
      data,
      tenantId: tenantId ?? '',
      priority: (options.priority as number | undefined) ?? 0,
      maxAttempts: (options.attempts as number | undefined) ?? 3,
      attempts: (options.attempts as number | undefined) ?? 0,
      createdAt: new Date().toISOString(),
    };

    this.jobStatus.set(jobId, { status: 'waiting', createdAt: new Date() });

    const t0 = Date.now();
    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(payload),
          MessageAttributes: {
            jobType: { DataType: 'String', StringValue: 'immediate' },
            tenantId: { DataType: 'String', StringValue: tenantId ?? '' },
          },
        }),
      );
    } catch (err: unknown) {
      const error = err as Error;
      Sentry.withScope((scope) => {
        scope.setTag('messaging.transport', 'sqs');
        scope.setTag('messaging.direction', 'publish');
        scope.setTag('messaging.job_type', 'immediate');
        scope.setContext('sqs_job_enqueue_failure', { jobId, tenantId, queueUrl });
        Sentry.captureException(error);
      });
      throw error;
    }

    Sentry.addBreadcrumb({
      category: 'messaging.job',
      message: 'SQS job enqueued: immediate',
      level: 'info',
      data: { jobId, tenantId, durationMs: Date.now() - t0 },
    });

    return { jobId, queue: 'immediate' };
  }

  // -------------------------------------------------------------------------
  // addBulk
  // -------------------------------------------------------------------------

  async addBulk(
    notifications: unknown[],
    options: Record<string, unknown> = {},
  ): Promise<{ jobId: string; queue: string; totalNotifications: number }> {
    const queueUrl = this.queues.bulk;
    if (!queueUrl) {
      throw new Error('SQS_NOTIFICATIONS_BULK_URL is not configured');
    }

    const jobId = (options.jobId as string | undefined) ?? buildJobId('bulk');
    const payload: BulkJobPayload = {
      jobId,
      type: 'bulk-send',
      data: {
        notifications,
        batchSize: (options.batchSize as number | undefined) ?? 100,
      },
      priority: (options.priority as number | undefined) ?? 0,
      maxAttempts: (options.attempts as number | undefined) ?? 2,
      attempts: (options.attempts as number | undefined) ?? 0,
      createdAt: new Date().toISOString(),
    };

    this.jobStatus.set(jobId, { status: 'waiting', createdAt: new Date() });

    const t0 = Date.now();
    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(payload),
          MessageAttributes: {
            jobType: { DataType: 'String', StringValue: 'bulk' },
          },
        }),
      );
    } catch (err: unknown) {
      const error = err as Error;
      Sentry.withScope((scope) => {
        scope.setTag('messaging.transport', 'sqs');
        scope.setTag('messaging.direction', 'publish');
        scope.setTag('messaging.job_type', 'bulk');
        scope.setContext('sqs_job_enqueue_failure', {
          jobId,
          totalNotifications: notifications.length,
          queueUrl,
        });
        Sentry.captureException(error);
      });
      throw error;
    }

    Sentry.addBreadcrumb({
      category: 'messaging.job',
      message: 'SQS job enqueued: bulk',
      level: 'info',
      data: { jobId, totalNotifications: notifications.length, durationMs: Date.now() - t0 },
    });

    return { jobId, queue: 'bulk', totalNotifications: notifications.length };
  }

  // -------------------------------------------------------------------------
  // schedule
  // -------------------------------------------------------------------------

  async schedule(
    notificationData: unknown,
    tenantId: string,
    scheduledAt: string | Date,
    options: Record<string, unknown> = {},
  ): Promise<{ jobId: string; queue: string; scheduledAt: string }> {
    const queueUrl = this.queues.scheduled;
    if (!queueUrl) {
      throw new Error('SQS_NOTIFICATIONS_SCHEDULED_URL is not configured');
    }

    const scheduledAtDate = new Date(scheduledAt);
    const delaySec = Math.round((scheduledAtDate.getTime() - Date.now()) / 1000);

    if (delaySec < 0) {
      throw new Error('Scheduled time must be in the future');
    }

    if (delaySec > SQS_MAX_DELAY_SECONDS) {
      throw new Error(
        `SQS supports a maximum DelaySeconds of ${SQS_MAX_DELAY_SECONDS} (15 minutes). ` +
          `Requested delay is ${delaySec}s. ` +
          `For long-term scheduling use a database-backed scheduler (e.g. pg_cron or Temporal).`,
      );
    }

    const jobId = (options.jobId as string | undefined) ?? buildJobId('scheduled');
    const scheduledAtStr = scheduledAtDate.toISOString();

    const payload: ScheduledJobPayload = {
      jobId,
      type: 'scheduled-notification',
      data: { notificationData, tenantId },
      scheduledAt: scheduledAtStr,
      priority: (options.priority as number | undefined) ?? 0,
      maxAttempts: (options.attempts as number | undefined) ?? 3,
      attempts: (options.attempts as number | undefined) ?? 0,
      createdAt: new Date().toISOString(),
    };

    this.jobStatus.set(jobId, {
      status: 'scheduled',
      scheduledAt: scheduledAtDate,
      createdAt: new Date(),
    });

    const t0 = Date.now();
    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(payload),
          DelaySeconds: delaySec,
          MessageAttributes: {
            jobType: { DataType: 'String', StringValue: 'scheduled' },
            tenantId: { DataType: 'String', StringValue: tenantId },
          },
        }),
      );
    } catch (err: unknown) {
      const error = err as Error;
      Sentry.withScope((scope) => {
        scope.setTag('messaging.transport', 'sqs');
        scope.setTag('messaging.direction', 'publish');
        scope.setTag('messaging.job_type', 'scheduled');
        scope.setContext('sqs_job_enqueue_failure', {
          jobId,
          tenantId,
          scheduledAt: scheduledAtStr,
          delaySec,
          queueUrl,
        });
        Sentry.captureException(error);
      });
      throw error;
    }

    Sentry.addBreadcrumb({
      category: 'messaging.job',
      message: 'SQS job enqueued: scheduled',
      level: 'info',
      data: { jobId, tenantId, scheduledAt: scheduledAtStr, delaySec, durationMs: Date.now() - t0 },
    });

    return { jobId, queue: 'scheduled', scheduledAt: scheduledAtStr };
  }

  // -------------------------------------------------------------------------
  // initializeWorkers
  // -------------------------------------------------------------------------

  async initializeWorkers(processors?: QueueProcessors): Promise<void> {
    if (!processors) return;

    const queueProcessorPairs: Array<{
      queueKey: 'immediate' | 'bulk' | 'scheduled';
      processor: (data: Record<string, unknown>) => Promise<unknown>;
    }> = [];

    if (processors.immediate && this.queues.immediate) {
      queueProcessorPairs.push({ queueKey: 'immediate', processor: processors.immediate });
    }
    if (processors.bulk && this.queues.bulk) {
      queueProcessorPairs.push({ queueKey: 'bulk', processor: processors.bulk });
    }
    if (processors.scheduled && this.queues.scheduled) {
      queueProcessorPairs.push({ queueKey: 'scheduled', processor: processors.scheduled });
    }

    for (const { queueKey, processor } of queueProcessorPairs) {
      const abortController = new AbortController();
      this.pollingAbortControllers.set(queueKey, abortController);
      this.startPollingLoop(queueKey, processor, abortController.signal);
      console.log(`[SQS Job Queue] Worker started for ${queueKey} queue`);
    }
  }

  // -------------------------------------------------------------------------
  // Polling loop (per queue)
  // -------------------------------------------------------------------------

  private startPollingLoop(
    queueKey: 'immediate' | 'bulk' | 'scheduled',
    processor: (data: Record<string, unknown>) => Promise<unknown>,
    signal: AbortSignal,
  ): void {
    const queueUrl = this.queues[queueKey]!;

    const poll = async (): Promise<void> => {
      if (signal.aborted) return;

      try {
        const response = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20, // long-poll
            MaxNumberOfMessages: 10,
            MessageAttributeNames: ['All'],
          }),
        );

        const messages = response.Messages ?? [];

        await Promise.all(
          messages.map(async (msg) => {
            if (!msg.Body || !msg.ReceiptHandle) return;

            let jobId = 'unknown';
            let attempts = 0;
            let maxAttempts = 3;

            try {
              const parsed = JSON.parse(msg.Body) as {
                jobId: string;
                data: Record<string, unknown>;
                attempts?: number;
                maxAttempts?: number;
              };

              jobId = parsed.jobId;
              attempts = parsed.attempts ?? 0;
              maxAttempts = parsed.maxAttempts ?? 3;

              this.jobStatus.set(jobId, { status: 'active', startedAt: new Date() });

              const jobT0 = Date.now();
              const result = await processor(parsed.data);

              this.jobStatus.set(jobId, { status: 'completed', result, completedAt: new Date() });

              await this.client.send(
                new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle }),
              );

              const durationMs = Date.now() - jobT0;
              console.log(`[SQS Job Queue] Job ${jobId} (${queueKey}) completed`);
              Sentry.addBreadcrumb({
                category: 'messaging.job',
                message: `SQS job completed: ${queueKey}`,
                level: 'info',
                data: { jobId, queueKey, attempts, durationMs },
              });
            } catch (err: unknown) {
              const error = err as Error;
              const nextAttempt = attempts + 1;

              if (nextAttempt < maxAttempts) {
                // Re-enqueue with incremented attempt counter via delayed visibility
                // (SQS visibility-timeout approach: delete + re-send with delay)
                const delay = Math.round(exponentialBackoffMs(nextAttempt) / 1000);
                try {
                  const originalBody = JSON.parse(msg.Body) as Record<string, unknown>;
                  await this.client.send(
                    new SendMessageCommand({
                      QueueUrl: queueUrl,
                      MessageBody: JSON.stringify({ ...originalBody, attempts: nextAttempt }),
                      DelaySeconds: Math.min(delay, SQS_MAX_DELAY_SECONDS),
                    }),
                  );
                  await this.client.send(
                    new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle }),
                  );
                  console.log(
                    `[SQS Job Queue] Job ${jobId} (${queueKey}) will retry (attempt ${nextAttempt}/${maxAttempts})`,
                  );
                } catch (retryErr: unknown) {
                  const retryError = retryErr as Error;
                  console.error(
                    `[SQS Job Queue] Failed to re-enqueue job ${jobId}:`,
                    retryError.message,
                  );
                  Sentry.withScope((scope) => {
                    scope.setTag('messaging.transport', 'sqs');
                    scope.setTag('messaging.job_type', queueKey);
                    scope.setTag('messaging.failure_type', 're-enqueue');
                    scope.setContext('sqs_job_reenqueue_failure', {
                      jobId,
                      queueKey,
                      nextAttempt,
                      maxAttempts,
                    });
                    Sentry.captureException(retryError);
                  });
                }
              } else {
                // Exhausted — delete so it doesn't loop, mark failed
                this.jobStatus.set(jobId, {
                  status: 'failed',
                  error: error.message,
                  failedAt: new Date(),
                  attemptsMade: nextAttempt,
                });
                await this.client.send(
                  new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle }),
                );
                console.error(
                  `[SQS Job Queue] Job ${jobId} (${queueKey}) failed after ${nextAttempt} attempts: ${error.message}`,
                );
                Sentry.withScope((scope) => {
                  scope.setTag('messaging.transport', 'sqs');
                  scope.setTag('messaging.job_type', queueKey);
                  scope.setTag('messaging.failure_type', 'exhausted');
                  scope.setContext('sqs_job_failure', {
                    jobId,
                    queueKey,
                    attemptsMade: nextAttempt,
                    maxAttempts,
                  });
                  Sentry.captureException(error);
                });
              }
            }
          }),
        );
      } catch (pollErr: unknown) {
        if (!signal.aborted) {
          const pollError = pollErr as Error;
          console.error(
            `[SQS Job Queue] Poll error on ${queueKey} queue:`,
            pollError.message,
          );
          Sentry.withScope((scope) => {
            scope.setTag('messaging.transport', 'sqs');
            scope.setTag('messaging.direction', 'consume');
            scope.setTag('messaging.job_type', queueKey);
            scope.setContext('sqs_job_poll_error', { queueKey, queueUrl });
            Sentry.captureException(pollError);
          });
        }
      }

      if (!signal.aborted) {
        // Schedule next tick — avoids stack overflow while keeping loop alive
        setImmediate(() => void poll());
      }
    };

    void poll();
  }

  // -------------------------------------------------------------------------
  // getJobStatus
  // -------------------------------------------------------------------------

  async getJobStatus(_queueName: string, jobId: string): Promise<JobStatusEntry & { jobId?: string }> {
    const status = this.jobStatus.get(jobId);
    if (!status) {
      return { status: 'not_found' };
    }
    return { jobId, ...status };
  }

  // -------------------------------------------------------------------------
  // cancelJob
  // -------------------------------------------------------------------------

  async cancelJob(
    _queueName: string,
    jobId: string,
  ): Promise<{ success: boolean; jobId?: string; message?: string }> {
    // SQS does not support selective message cancellation.
    // We mark as cancelled in status tracking so callers can check before processing.
    const status = this.jobStatus.get(jobId);
    if (status) {
      this.jobStatus.set(jobId, { ...status, status: 'cancelled', cancelledAt: new Date() });
      return { success: true, jobId };
    }
    return { success: false, message: 'Job not found' };
  }

  // -------------------------------------------------------------------------
  // getQueueStats
  // -------------------------------------------------------------------------

  async getQueueStats(
    queueName: string,
  ): Promise<{ queue: string; waiting: number; active: number; completed: number; failed: number; total: number }> {
    const queueUrl = this.queues[queueName as keyof typeof this.queues];
    if (!queueUrl) {
      throw new Error(`Queue "${queueName}" is not configured`);
    }

    let sqsWaiting = 0;
    try {
      const response = await this.client.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
        }),
      );
      sqsWaiting =
        parseInt(response.Attributes?.['ApproximateNumberOfMessages'] ?? '0', 10) +
        parseInt(response.Attributes?.['ApproximateNumberOfMessagesNotVisible'] ?? '0', 10);
    } catch (err: unknown) {
      console.warn(`[SQS Job Queue] Could not fetch queue attributes for ${queueName}:`, (err as Error).message);
    }

    const allStatuses = Array.from(this.jobStatus.values());
    const active = allStatuses.filter((s) => s.status === 'active').length;
    const completed = allStatuses.filter((s) => s.status === 'completed').length;
    const failed = allStatuses.filter((s) => s.status === 'failed').length;

    return {
      queue: queueName,
      waiting: sqsWaiting,
      active,
      completed,
      failed,
      total: sqsWaiting + active + completed + failed,
    };
  }

  // -------------------------------------------------------------------------
  // close
  // -------------------------------------------------------------------------

  /** No-op — SQS SDK is stateless (no persistent connection to establish). */
  async connect(): Promise<void> {
    // Nothing to do — the SDK creates requests on demand.
  }

  async close(): Promise<void> {
    for (const [key, controller] of this.pollingAbortControllers) {
      controller.abort();
      this.pollingAbortControllers.delete(key);
    }
    this.jobStatus.clear();
    console.log('[SQS Job Queue] Polling loops stopped — no persistent connection to close.');
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const sqsJobQueue = new SqsJobQueue();
export default sqsJobQueue;
