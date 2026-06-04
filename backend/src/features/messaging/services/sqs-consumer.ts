import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  MessageSystemAttributeName,
  type Message,
} from '@aws-sdk/client-sqs';
import * as Sentry from '@sentry/node';
import { context } from '@opentelemetry/api';
import { sql } from 'drizzle-orm';
import { extractTraceContext } from '../../../utils/trace-context.js';
import { snsSqsPublisher } from '../utils/sns-sqs-publisher.js';
import { resolvePayload } from '../utils/large-payload-store.js';
import { db } from '../../../db/index.js';
import { receivedEvents } from '../../../db/schema/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InterAppEventPayload {
  eventId?: string;
  eventType: string;
  sourceApplication?: string;
  targetApplication?: string;
  tenantId?: string;
  entityId?: string;
  eventData?: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  schemaVersion?: string;
}

/** Shape of the SNS notification envelope that SQS receives */
interface SnsEnvelope {
  Type: string;
  MessageId?: string;
  TopicArn?: string;
  Message: string;
  MessageAttributes?: Record<string, { Type: string; Value: string }>;
}

/** Status returned by getStatus() */
interface SqsConsumerStatus {
  isRunning: boolean;
  queueUrl: string | undefined;
  isConfigured: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse an SQS message body into an InterAppEventPayload.
 *
 * SQS messages published via SNS arrive as an SNS notification envelope where
 * the actual event JSON lives in `notification.Message`.  As a fallback the
 * body may already be the raw event JSON (e.g. direct SQS sends during tests).
 */
function parseEventPayload(body: string): {
  event: InterAppEventPayload;
  rawEnvelope: Record<string, unknown>;
} {
  const outer = JSON.parse(body) as Record<string, unknown>;

  // SNS envelope – `Type` is always 'Notification' for SNS deliveries
  if (outer['Type'] === 'Notification' && typeof outer['Message'] === 'string') {
    const inner = JSON.parse(outer['Message']) as InterAppEventPayload;
    return { event: inner, rawEnvelope: outer };
  }

  // Direct send – body is already the event
  return { event: outer as unknown as InterAppEventPayload, rawEnvelope: outer };
}

/**
 * Extract the approximate receive count from SQS message attributes.
 * The attribute value is a string even though it represents a number.
 */
function getReceiveCount(msg: Message): number {
  const raw = msg.Attributes?.['ApproximateReceiveCount'];
  if (raw === undefined) return 1;
  return parseInt(raw, 10) || 1;
}

/** Clamp a visibility timeout between 0 and the SQS maximum (600 s). */
function clampVisibilityTimeout(seconds: number): number {
  return Math.min(Math.max(seconds, 0), 600);
}

// ---------------------------------------------------------------------------
// Consumer class
// ---------------------------------------------------------------------------

class SqsInterAppConsumer {
  private readonly client: SQSClient;
  private readonly queueUrl: string | undefined;
  private readonly maxMessages: number;
  private readonly visibilityTimeout: number;
  private readonly waitTimeSeconds: number;
  private readonly maxRetries = 3;
  private readonly baseRetryDelaySeconds = 15;

  isRunning = false;
  private pollPromise: Promise<void> | null = null;

  constructor() {
    this.queueUrl = process.env.SQS_WRAPPER_QUEUE_URL;
    this.maxMessages = parseInt(process.env.SQS_MAX_MESSAGES ?? '10', 10) || 10;
    this.visibilityTimeout = parseInt(process.env.SQS_VISIBILITY_TIMEOUT ?? '30', 10) || 30;
    this.waitTimeSeconds = parseInt(process.env.SQS_WAIT_TIME_SECONDS ?? '20', 10) || 20;

    // Use messaging-specific credentials if provided, otherwise fall back to
    // the general AWS credentials (which may be scoped to Route 53 only).
    const accessKeyId =
      process.env.AWS_MESSAGING_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.AWS_MESSAGING_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    this.client = new SQSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined, // Fall back to the default credential provider chain
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Returns true when SQS_WRAPPER_QUEUE_URL is configured. */
  isConfigured(): boolean {
    return !!this.queueUrl;
  }

  /** Start the long-polling loop. Safe to call only once. */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[SQS←] Consumer already running');
      return;
    }

    if (!this.isConfigured()) {
      console.warn('[SQS←] SQS_WRAPPER_QUEUE_URL not set — consumer not started');
      return;
    }

    console.log(`[SQS←] Starting SQS consumer — queue: ${this.queueUrl}`);
    this.isRunning = true;
    this.pollPromise = this.pollLoop();
  }

  /** Stop the long-polling loop and wait for any in-flight poll to complete. */
  async stop(): Promise<void> {
    console.log('[SQS←] Stopping SQS consumer...');
    this.isRunning = false;
    if (this.pollPromise) {
      await this.pollPromise.catch(() => {});
      this.pollPromise = null;
    }
    console.log('[SQS←] SQS consumer stopped');
  }

  /** Current runtime status snapshot. */
  getStatus(): SqsConsumerStatus {
    return {
      isRunning: this.isRunning,
      queueUrl: this.queueUrl,
      isConfigured: this.isConfigured(),
    };
  }

  // -------------------------------------------------------------------------
  // Polling loop
  // -------------------------------------------------------------------------

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.pollMessages();
      } catch (err: unknown) {
        const error = err as Error;
        console.error('[SQS←ERR] Unhandled error in poll iteration:', error.message);
        Sentry.withScope((scope) => {
          scope.setTag('messaging.transport', 'sqs');
          scope.setTag('messaging.direction', 'consume');
          scope.setContext('sqs_poll_error', { queueUrl: this.queueUrl });
          Sentry.captureException(error);
        });
        // Brief pause before retrying to avoid a hot-loop on persistent errors
        await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  private async pollMessages(): Promise<void> {
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl!,
        MaxNumberOfMessages: this.maxMessages,
        WaitTimeSeconds: this.waitTimeSeconds,
        MessageSystemAttributeNames: [MessageSystemAttributeName.ApproximateReceiveCount],
        MessageAttributeNames: ['All'],
      }),
    );

    const messages = response.Messages ?? [];
    if (messages.length === 0) return;

    console.log(`[SQS←] Received ${messages.length} message(s)`);

    // Process all messages from this batch concurrently
    await Promise.all(messages.map((msg) => this.processMessage(msg)));
  }

  // -------------------------------------------------------------------------
  // Per-message processing
  // -------------------------------------------------------------------------

  private async processMessage(msg: Message): Promise<void> {
    const messageId = msg.MessageId ?? '(unknown)';

    if (!msg.Body) {
      console.warn(`[SQS←] Message ${messageId} has no body — deleting`);
      await this.deleteMessage(msg);
      return;
    }

    let event: InterAppEventPayload;
    let rawEnvelope: Record<string, unknown>;
    try {
      const parsed = parseEventPayload(msg.Body);
      // Transparently resolve S3 claim-check if the payload was offloaded.
      // For normal (inline) payloads resolvePayload is a no-op.
      const resolvedEventData = await resolvePayload(
        parsed.event.eventData as Record<string, unknown>,
      );
      event = { ...parsed.event, eventData: resolvedEventData as InterAppEventPayload['eventData'] };
      rawEnvelope = parsed.rawEnvelope;
    } catch (parseErr: unknown) {
      const error = parseErr as Error;
      console.error(`[SQS←ERR] Failed to parse message ${messageId}: ${error.message}`);
      Sentry.withScope((scope) => {
        scope.setTag('messaging.transport', 'sqs');
        scope.setTag('messaging.direction', 'consume');
        scope.setTag('messaging.failure_type', 'parse_error');
        scope.setContext('sqs_parse_failure', { messageId, queueUrl: this.queueUrl });
        Sentry.captureException(error);
      });
      // Unparseable messages should not be retried — delete immediately
      await this.deleteMessage(msg);
      return;
    }

    console.log(`[SQS←] Processing message:`, {
      messageId,
      eventId: event.eventId,
      eventType: event.eventType,
      sourceApplication: event.sourceApplication,
      targetApplication: event.targetApplication,
      tenantId: event.tenantId,
    });

    const t0 = Date.now();

    // Durably record the receive BEFORE dispatching to the handler so that
    // even handler bugs or unhandled event types cannot silently drop the
    // event.  Same event_id from a redelivery upserts and bumps receive_count.
    await this.recordReceivedEvent(event, rawEnvelope, msg);

    try {
      // Continue the producer's trace: extract the context injected into the
      // SNS/SQS MessageAttributes and run the handler inside it as a consumer
      // transaction, so this work is linked to the originating request's trace.
      const parentCtx = extractTraceContext(msg.MessageAttributes as Record<string, { StringValue?: string; Value?: string }> | undefined);
      const handled = await context.with(parentCtx, () =>
        Sentry.startSpan(
          { name: `consume ${event.eventType}`, op: 'queue.process', forceTransaction: true },
          () => this.handleEventByType(event),
        ),
      );
      // Success path — remove the message from the queue
      await this.deleteMessage(msg);

      await this.markReceivedEventStatus(
        event.eventId,
        handled ? 'processed' : 'skipped',
        null,
      );

      const durationMs = Date.now() - t0;
      console.log(`[SQS←OK] Message processed and deleted: ${messageId} (${durationMs}ms)`);

      Sentry.addBreadcrumb({
        category: 'messaging.consume',
        message: `SQS processed: ${event.eventType}`,
        level: 'info',
        data: {
          messageId,
          eventId: event.eventId,
          eventType: event.eventType,
          sourceApplication: event.sourceApplication,
          tenantId: event.tenantId,
          durationMs,
        },
      });
    } catch (handlerErr: unknown) {
      const error = handlerErr as Error;
      const receiveCount = getReceiveCount(msg);

      await this.markReceivedEventStatus(event.eventId, 'failed', error.message);

      console.error(
        `[SQS←ERR] Error processing message ${messageId} (receiveCount=${receiveCount}): ${error.message}`,
      );

      Sentry.withScope((scope) => {
        scope.setTag('messaging.transport', 'sqs');
        scope.setTag('messaging.direction', 'consume');
        scope.setTag('messaging.event_type', event.eventType);
        scope.setTag('messaging.failure_type', receiveCount >= this.maxRetries ? 'dlq' : 'retry');
        scope.setContext('sqs_handler_failure', {
          messageId,
          eventId: event.eventId,
          eventType: event.eventType,
          sourceApplication: event.sourceApplication,
          tenantId: event.tenantId,
          receiveCount,
          maxRetries: this.maxRetries,
        });
        Sentry.captureException(error);
      });

      if (receiveCount < this.maxRetries) {
        // Back off and let SQS redeliver — just extend the visibility timeout
        const backoffSeconds = clampVisibilityTimeout(this.baseRetryDelaySeconds * receiveCount);
        console.log(
          `[SQS←] Scheduling retry ${receiveCount}/${this.maxRetries} for ${messageId} — backoff ${backoffSeconds}s`,
        );
        await this.changeVisibility(msg, backoffSeconds);
      } else {
        // Max retries reached — delete so the SQS DLQ redrive policy picks it up
        console.error(
          `[SQS←ERR] Max retries (${this.maxRetries}) exceeded for message ${messageId} — moving to DLQ`,
        );
        await this.notifyFailure(event, error, receiveCount);
        await this.deleteMessage(msg);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Event routing
  // -------------------------------------------------------------------------

  private async handleEventByType(event: InterAppEventPayload): Promise<boolean> {
    // Wrapper is the source of truth for users, organizations, roles, and the
    // allocator for credits. None of the corresponding inbound events from
    // CRM/FA drive any wrapper-side state mutation — they used to land here
    // as no-op stub handlers, which created the impression of a contract
    // that didn't exist. They've been removed deliberately.
    //
    // Anything that DOES arrive on the queue still lands in `received_events`
    // for audit (see recordReceivedEvent above) with handler_status='skipped'.
    // The proper long-term fix is to tighten the SNS subscription filter
    // policy on wrapper's queue so these event types are never delivered —
    // that's an infra (IaC / AWS console) change, not a code change.
    //
    // Add a case here only for events that actually need to mutate
    // wrapper-side state (e.g. `event.processing.failed` notifications, ack
    // signals). Domain events from downstream apps do not belong here.
    console.log(`[SQS←] Unhandled event type: ${event.eventType}`);
    return false;
  }


  // -------------------------------------------------------------------------
  // Received-event audit log
  // -------------------------------------------------------------------------

  /**
   * Persist (or upsert on redelivery) a row in `received_events` so that every
   * inbound event is durably recorded regardless of handler implementation.
   * Failures here are logged but never block the SQS handler / ack flow —
   * the audit table must not gate processing.
   */
  private async recordReceivedEvent(
    event: InterAppEventPayload,
    rawEnvelope: Record<string, unknown>,
    msg: Message,
  ): Promise<void> {
    try {
      const eventId = event.eventId;
      if (!eventId) {
        // Without a stable event_id we cannot enforce idempotency, so skip the
        // audit row and let logs/Sentry surface it.
        console.warn('[SQS←] Received event has no eventId — skipping received_events audit');
        return;
      }
      await db
        .insert(receivedEvents)
        .values({
          eventId,
          eventType: event.eventType,
          sourceApplication: event.sourceApplication ?? 'unknown',
          targetApplication: event.targetApplication ?? 'wrapper',
          tenantId: event.tenantId ?? null,
          entityId: event.entityId ?? null,
          correlationId: event.correlationId ?? null,
          causationId: event.causationId ?? null,
          schemaVersion: event.schemaVersion ?? null,
          payload: (event.eventData ?? {}) as Record<string, unknown>,
          rawEnvelope,
          handlerStatus: 'pending',
          receiveCount: getReceiveCount(msg),
          sqsMessageId: msg.MessageId ?? null,
        })
        .onConflictDoUpdate({
          target: receivedEvents.eventId,
          set: {
            receiveCount: sql`${receivedEvents.receiveCount} + 1`,
            handlerStatus: 'pending',
            handlerError: null,
          },
        });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[SQS←ERR] Failed to record received_events row:', error.message);
      Sentry.withScope((scope) => {
        scope.setTag('messaging.transport', 'sqs');
        scope.setTag('messaging.direction', 'consume');
        scope.setTag('messaging.failure_type', 'audit_write');
        scope.setContext('received_events_insert', {
          eventId: event.eventId,
          eventType: event.eventType,
        });
        Sentry.captureException(error);
      });
    }
  }

  private async markReceivedEventStatus(
    eventId: string | undefined,
    status: 'processed' | 'skipped' | 'failed',
    errorMessage: string | null,
  ): Promise<void> {
    if (!eventId) return;
    try {
      await db
        .update(receivedEvents)
        .set({
          handlerStatus: status,
          handlerError: errorMessage,
          processedAt: status === 'processed' || status === 'skipped' ? new Date() : null,
        })
        .where(sql`${receivedEvents.eventId} = ${eventId}`);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[SQS←ERR] Failed to update received_events status:', error.message);
    }
  }

  // -------------------------------------------------------------------------
  // SQS operations
  // -------------------------------------------------------------------------

  private async deleteMessage(msg: Message): Promise<void> {
    if (!msg.ReceiptHandle) return;
    try {
      await this.client.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl!,
          ReceiptHandle: msg.ReceiptHandle,
        }),
      );
    } catch (err: unknown) {
      const error = err as Error;
      console.error(
        `[SQS←ERR] Failed to delete message ${msg.MessageId ?? '(unknown)'}: ${error.message}`,
      );
    }
  }

  private async changeVisibility(msg: Message, visibilityTimeoutSeconds: number): Promise<void> {
    if (!msg.ReceiptHandle) return;
    try {
      await this.client.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: this.queueUrl!,
          ReceiptHandle: msg.ReceiptHandle,
          VisibilityTimeout: visibilityTimeoutSeconds,
        }),
      );
    } catch (err: unknown) {
      const error = err as Error;
      console.error(
        `[SQS←ERR] Failed to change visibility for ${msg.MessageId ?? '(unknown)'}: ${error.message}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Failure notification
  // -------------------------------------------------------------------------

  /**
   * Attempt to publish an `event.processing.failed` notification back to the
   * source application via the SNS/SQS publisher.  Failures here are
   * best-effort and must never prevent the DLQ handoff from completing.
   */
  private async notifyFailure(
    event: InterAppEventPayload,
    error: Error,
    retryCount: number,
  ): Promise<void> {
    try {
      await snsSqsPublisher.publishInterAppEvent({
        eventType: 'event.processing.failed',
        sourceApplication: 'wrapper',
        targetApplication: event.sourceApplication ?? 'system',
        tenantId: event.tenantId ?? '',
        entityId: event.entityId ?? '',
        eventData: {
          originalEvent: event,
          error: error.message,
          retryCount,
        },
        publishedBy: 'wrapper-sqs-consumer',
      });
    } catch (publishErr: unknown) {
      const publishError = publishErr as Error;
      console.error('[SQS←ERR] Failed to publish failure notification:', publishError.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default SqsInterAppConsumer;
export const sqsConsumer = new SqsInterAppConsumer();
