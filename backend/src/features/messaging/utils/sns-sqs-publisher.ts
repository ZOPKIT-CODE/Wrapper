import { SNSClient, PublishCommand, GetTopicAttributesCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';

import { sql as drizzleSql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { PersistentCircuitBreaker } from '../../../utils/persistent-circuit-breaker.js';
import { maybeOffloadToS3 } from './large-payload-store.js';
import Logger from '../../../utils/logger.js';
import { injectTraceContext } from '../../../utils/trace-context.js';
import { deriveEventId } from '../services/event-id.js';
import { resolveEnvelopeTenant, applyCanonicalStamp, TENANT_UUID_RE } from './tenant-stamp.js';

// Off by default. Set VALIDATE_OUTGOING_EVENTS=true in dev/staging to log a
// warning whenever an outbound payload does not match the canonical
// event registry schema for its event type. We never reject — validation
// is observability-only so this can be flipped on safely.
const VALIDATE_OUTGOING_EVENTS = process.env.VALIDATE_OUTGOING_EVENTS === 'true';

// Stubs — replace with real implementations if an event registry is introduced.
function isKnownEventType(_eventType: string): boolean { return false; }
function validateEvent(_eventType: string, _data: unknown): { success: boolean; error?: string } { return { success: true }; }

/**
 * SNS/SQS Publisher
 *
 * * Publishes inter-application events to AWS SNS
 * connection is maintained, so reconnection logic is not needed.
 *
 * * Exposes the same public API across all
 * call sites remain unchanged after swapping the adapter import.
 */
class SnsSqsPublisher {
  private readonly client: SNSClient;
  private readonly businessSuiteApps: string[];
  // 5 failures → open; 5-minute reset (configurable via SNS_CB_RESET_TIMEOUT_MS).
  private readonly circuitBreaker = new PersistentCircuitBreaker(
    'sns-sqs',
    Number(process.env.SNS_CB_FAIL_THRESHOLD ?? 5),
    Number(process.env.SNS_CB_RESET_TIMEOUT_MS ?? 300_000),
  );

  constructor() {
    // Use messaging-specific credentials if provided, otherwise fall back to
    // the general AWS credentials (which may be scoped to Route 53 only).
    const accessKeyId =
      process.env.AWS_MESSAGING_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.AWS_MESSAGING_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

    this.client = new SNSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });

    const suiteAppsEnv = process.env.BUSINESS_SUITE_TARGET_APPS;
    let apps = suiteAppsEnv
      ? suiteAppsEnv.split(',').map((app: string) => app.trim()).filter(Boolean)
      : ['crm', 'accounting', 'ops'];
    if (!apps.includes('ops')) {
      apps = [...apps, 'ops'];
    }
    this.businessSuiteApps = apps;
  }

  /**
   * Check if SNS is configured.
   * AWS credentials are supplied by the SDK default credential chain
   * (env vars AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, instance profile, etc.).
   */
  isConfigured(): boolean {
    return !!process.env.SNS_INTER_APP_TOPIC_ARN;
  }

  /**
   * Verify connectivity at startup by calling GetTopicAttributes on the
   * inter-app topic. Logs a banner and returns true/false — never throws.
   */
  async initializeAtStartup(): Promise<boolean> {
    if (!this.isConfigured()) {
      Logger.log('warning', 'general', 'initializeAtStartup', 'SNS/SQS NOT CONFIGURED — event publishing is DISABLED. Set SNS_INTER_APP_TOPIC_ARN to enable event publishing');
      return false;
    }

    // Restore persisted CB state after pod restart
    await this.circuitBreaker.initialize();

    try {
      await this.client.send(
        new GetTopicAttributesCommand({ TopicArn: process.env.SNS_INTER_APP_TOPIC_ARN! })
      );
      Logger.log('info', 'general', 'initializeAtStartup', 'SNS/SQS CONNECTED — event publishing is ACTIVE', { targetApps: this.businessSuiteApps.join(', '), topicArn: process.env.SNS_INTER_APP_TOPIC_ARN });
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'initializeAtStartup', 'SNS CONNECTIVITY CHECK FAILED — event publishing is DISABLED. Check: AWS credentials, region, topic ARN, IAM permissions', { error: error.message });
      return false;
    }
  }

  /**
   * Generate a routing key from target application + event type.
   * Kept for interface compatibility — the value is metadata only (SNS uses
   * MessageAttributes for filtering, not routing keys).
   *
   * Converts: { targetApplication: 'crm', eventType: 'user.created' }
   * To:       'crm.user.created'
   *
   * Also handles: 'user_created' -> 'user.created'
   * Maps 'operations' -> 'ops' so the value stays consistent with former MQ keys.
   */
  generateRoutingKey(targetApplication: string, eventType: string): string {
    const normalizedEventType = eventType.replace(/_/g, '.');
    const routingPrefix = targetApplication === 'operations' ? 'ops' : targetApplication;
    return `${routingPrefix}.${normalizedEventType}`;
  }

  /**
   * Publish an inter-application event to SNS_INTER_APP_TOPIC_ARN.
   * Consumers subscribe with filter policies on the MessageAttributes.
   */
  async publishInterAppEvent({
    eventType,
    sourceApplication,
    targetApplication,
    tenantId,
    entityId,
    eventData = {},
    publishedBy = 'system',
    eventId,
    tx,
  }: {
    eventType: string;
    sourceApplication: string;
    targetApplication: string;
    tenantId: string;
    entityId: string;
    eventData?: Record<string, unknown>;
    publishedBy?: string;
    eventId?: string;
    /** Caller's domain transaction — when provided, the outbox INSERT joins it
     *  (atomic with the domain write) and the synchronous SNS publish is skipped. */
    tx?: typeof db;
  }): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    // In tx mode we only write the outbox row (no synchronous SNS publish), so the
    // SNS topic doesn't need to be configured here — the poller handles delivery.
    // This keeps the SNS-config requirement from rolling back the caller's domain tx.
    if (!tx && !this.isConfigured()) {
      Logger.log('error', 'general', 'publishInterAppEvent', `Event DROPPED: ${sourceApplication} → ${targetApplication} (${eventType}) — SNS_INTER_APP_TOPIC_ARN not set`);
      throw new Error(
        'SNS publisher is not configured. Set SNS_INTER_APP_TOPIC_ARN environment variable.'
      );
    }

    const t0 = Date.now();

    // Bug 1/3 fix — single chokepoint for tenantId-envelope translation.
    // Downstream apps (CRM, FA, …) join on `kinde_org_id`/`idp_org_id`, not the
    // wrapper's internal tenant UUID. Many producers pass the wrapper UUID;
    // translate here so every convenience method gets the fix without per-callsite churn.
    //
    // Tenant-UUID-divergence fix: in addition to translating the envelope tenantId
    // to the idpOrgId, we stamp the wrapper's CANONICAL tenant UUID onto
    // `eventData.wrapperTenantId`. This is the single source of truth that lets a
    // downstream app (FA especially, whose tenant_id is a text PK) pin its local
    // tenant row to the SAME id the wrapper uses — even when an incremental event
    // (org.assignment / user / role) arrives BEFORE tenant.onboarded and the app
    // would otherwise mint a divergent id. Resolved in BOTH directions so the
    // canonical UUID is always present regardless of which form the caller passed.
    if (tenantId) {
      let idpOrgIdForUuid: string | null | undefined;
      let uuidForIdpOrg:   string | null | undefined;
      try {
        const { db: _db } = await import('../../../db/index.js');
        const { tenants } = await import('../../../db/schema/index.js');
        const { eq } = await import('drizzle-orm');

        if (tenantId.startsWith('org_')) {
          const [row] = await _db
            .select({ tenantId: tenants.tenantId })
            .from(tenants).where(eq(tenants.idpOrgId, tenantId)).limit(1);
          uuidForIdpOrg = row?.tenantId ?? null;
        } else if (TENANT_UUID_RE.test(tenantId)) {
          const [row] = await _db
            .select({ idpOrgId: tenants.idpOrgId })
            .from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
          idpOrgIdForUuid = row?.idpOrgId ?? null;
          if (!row?.idpOrgId) {
            Logger.log('warning', 'general', 'publishInterAppEvent', 'idpOrgId lookup miss — falling back to raw tenantId (downstream lookups will likely fail)', { tenantId, eventType, targetApplication });
          }
        }
      } catch (err: unknown) {
        Logger.log('warning', 'general', 'publishInterAppEvent', 'tenant id resolution failed — falling back to raw tenantId', { tenantId, eventType, error: (err as Error).message });
      }

      const resolution = resolveEnvelopeTenant({ tenantId, idpOrgIdForUuid, uuidForIdpOrg });
      tenantId = resolution.envelopeTenantId;
      eventData = applyCanonicalStamp(eventData as Record<string, unknown>, resolution.wrapperTenantId) as typeof eventData;
    }

    Logger.log('info', 'general', 'publishInterAppEvent', `Publishing event: ${sourceApplication} → ${targetApplication} (${eventType})`, { tenantId, eventType, targetApplication, payloadSize: JSON.stringify(eventData).length });

    // Optional schema validation against the shared SDK EVENT_REGISTRY.
    // Gated by env var; we log warnings but never reject (publishers stay
    // backward-compatible with payloads that haven't been migrated yet).
    if (VALIDATE_OUTGOING_EVENTS) {
      if (!isKnownEventType(eventType)) {
        Logger.log('warning', 'general', 'publishInterAppEvent', `Outgoing event type not in SDK EVENT_REGISTRY — payload not validated: ${eventType}`, { eventType, tenantId, targetApplication });
      } else {
        const result = validateEvent(eventType, eventData);
        if (!result.success) {
          Logger.log('warning', 'general', 'publishInterAppEvent', `Outgoing event payload failed SDK schema validation: ${eventType}`, { eventType, tenantId, targetApplication, validationError: result.error });
        }
      }
    }

    const routingKey = this.generateRoutingKey(targetApplication, eventType);
    const resolvedEventId =
      eventId || `inter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Offload to S3 if payload exceeds 200 KB (SQS hard limit is 256 KB).
    // resolvedEventData is either the original object or { _s3Ref: { bucket, key } }.
    const { eventData: resolvedEventData } = await maybeOffloadToS3(resolvedEventId, eventData);

    const message = {
      // Legacy fields — kept for backward compatibility with existing consumers
      eventId: resolvedEventId,
      eventType,
      sourceApplication,
      targetApplication,
      tenantId,
      entityId,
      timestamp: new Date().toISOString(),
      eventData: resolvedEventData,
      publishedBy,
      // ADR-011 canonical envelope fields — required by @zopkit/platform-sdk createSQSConsumer
      messageId: resolvedEventId,
      sourceSystem: sourceApplication,
      payload: resolvedEventData,
      correlationId: (eventData as any)?._correlationId ?? randomUUID(),
      causationId: (eventData as any)?._causationId ?? '',
      schemaVersion: 1,
    };

    const messageAttributes = {
      targetApplication: { DataType: 'String', StringValue: targetApplication },
      sourceApplication: { DataType: 'String', StringValue: sourceApplication },
      eventType: { DataType: 'String', StringValue: eventType },
      tenantId: { DataType: 'String', StringValue: tenantId },
    };
    // Inject the active trace context (sentry-trace + baggage) so the consumer
    // continues this trace. Injected BEFORE the outbox INSERT below, so the
    // stored attributes carry it too — poller replays preserve the trace link.
    injectTraceContext(messageAttributes);

    // Outbox-first pattern: persist the event to inter_app_outbox, then attempt
    // the SNS publish. If SNS fails, published_at stays NULL and the poller retries.
    //
    // Atomicity: when the caller threads its domain `tx`, the outbox INSERT joins
    // that transaction (committing atomically with the domain write — no dual-write
    // window) and the synchronous SNS publish is skipped (the poller delivers after
    // commit). Without a `tx`, this is a dual-write: the outbox row is written on a
    // separate connection right after the SNS attempt — durable, but with a small
    // window if the process dies between the caller's commit and this insert.
    return this.enqueueEvent({
      eventId: resolvedEventId,
      eventType,
      targetApplication,
      sourceApplication,
      tenantId,
      entityId,
      routingKey,
      message,
      messageAttributes,
      startedAt: t0,
      tx,
    });
  }

  /**
   * Outbox-first publish:
   *  1. INSERT into inter_app_outbox (durable record of intent to send)
   *  2. Synchronously attempt SNS publish through the existing circuit breaker
   *  3. On success: UPDATE outbox row SET published_at = now()
   *  4. On failure: log warn, leave published_at NULL — poller will retry.
   *     We return success to the caller because the event is durable in the outbox.
   */
  private async enqueueEvent(params: {
    eventId: string;
    eventType: string;
    targetApplication: string;
    sourceApplication: string;
    tenantId: string;
    entityId: string;
    routingKey: string;
    message: Record<string, unknown>;
    messageAttributes: Record<string, { DataType: string; StringValue: string }>;
    startedAt: number;
    /** Caller's domain transaction. When provided, the outbox row is written in
     *  that tx (atomic with the domain write) and the synchronous SNS publish is
     *  skipped — the outbox poller delivers after the caller's tx commits. */
    tx?: typeof db;
  }): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const {
      eventId,
      eventType,
      targetApplication,
      sourceApplication,
      tenantId,
      entityId,
      routingKey,
      message,
      messageAttributes,
      startedAt,
      tx,
    } = params;

    // tx-bound path: write the outbox row in the CALLER's transaction so it commits
    // atomically with the domain write — no dual-write window, and no phantom event
    // if the caller's tx rolls back. Skip the synchronous SNS publish; the outbox
    // poller delivers (published_at IS NULL) after the caller commits.
    if (tx) {
      await tx.execute(drizzleSql`
        INSERT INTO inter_app_outbox (event_id, event_type, target_application, payload, message_attributes)
        VALUES (
          ${eventId},
          ${eventType},
          ${targetApplication},
          ${JSON.stringify(message)}::jsonb,
          ${JSON.stringify(messageAttributes)}::jsonb
        )
        ON CONFLICT (event_id) DO NOTHING
      `);
      // messageId = eventId until the poller assigns an SNS message-id on delivery.
      return { success: true, eventId, routingKey, messageId: eventId };
    }

    // 1. Durable insert into outbox first.
    // ON CONFLICT (event_id) DO NOTHING makes this idempotent if a caller
    // retries with the same eventId.
    try {
      await db.execute(drizzleSql`
        INSERT INTO inter_app_outbox (event_id, event_type, target_application, payload, message_attributes)
        VALUES (
          ${eventId},
          ${eventType},
          ${targetApplication},
          ${JSON.stringify(message)}::jsonb,
          ${JSON.stringify(messageAttributes)}::jsonb
        )
        ON CONFLICT (event_id) DO NOTHING
      `);
    } catch (outboxErr) {
      // If we can't write to the outbox we have no durability guarantee.
      // Fall through to the SNS attempt and surface the error to the caller —
      // this matches pre-outbox behaviour for this (rare) failure mode.
      const errMsg = outboxErr instanceof Error ? outboxErr.message : String(outboxErr);
      Logger.log('error', 'general', 'enqueueEvent', `Failed to insert into inter_app_outbox — falling back to direct publish`, { eventId, eventType, targetApplication, error: errMsg });
    }

    // 2. Fast-path SNS publish through the circuit breaker.
    try {
      const snsMessageId = await this.circuitBreaker.execute(async () => {
        const response = await this.client.send(
          new PublishCommand({
            TopicArn: process.env.SNS_INTER_APP_TOPIC_ARN!,
            Message: JSON.stringify(message),
            MessageAttributes: messageAttributes,
          })
        );
        return response.MessageId ?? eventId;
      });

      const durationMs = Date.now() - startedAt;

      // 3. Mark outbox row as published.
      try {
        await db.execute(drizzleSql`
          UPDATE inter_app_outbox
          SET published_at  = now(),
              attempt_count = attempt_count + 1,
              last_attempt_at = now()
          WHERE event_id = ${eventId}
            AND published_at IS NULL
        `);
      } catch (updateErr) {
        // Non-fatal: the SNS publish succeeded. The poller's idempotency check
        // will eventually re-publish this row, and downstream consumers
        // deduplicate by event_id.
        const errMsg = updateErr instanceof Error ? updateErr.message : String(updateErr);
        Logger.log('warning', 'general', 'enqueueEvent', `Outbox UPDATE after successful publish failed (non-fatal — poller will reconcile)`, { eventId, error: errMsg });
      }

      Logger.log('info', 'general', 'publishInterAppEvent', `Event published successfully: ${eventType} → ${targetApplication}`, { tenantId, eventType, targetApplication, snsMessageId, durationMs });

      Sentry.addBreadcrumb({
        category: 'messaging.publish',
        message: `SNS published: ${eventType} → ${targetApplication}`,
        level: 'info',
        data: {
          eventId,
          snsMessageId,
          eventType,
          sourceApplication,
          targetApplication,
          tenantId,
          durationMs,
        },
      });

      return {
        success: true,
        eventId,
        routingKey,
        messageId: snsMessageId,
      };
    } catch (error) {
      // 4. SNS publish failed (circuit-open or network). Record attempt on
      // the outbox row and return success to the caller — the poller will
      // retry. Do NOT throw: throwing here is exactly what caused events to
      // be lost when the circuit opened.
      const errMsg = error instanceof Error ? error.message : String(error);

      try {
        await db.execute(drizzleSql`
          UPDATE inter_app_outbox
          SET attempt_count   = attempt_count + 1,
              last_attempt_at = now(),
              last_error      = ${errMsg}
          WHERE event_id = ${eventId}
            AND published_at IS NULL
        `);
      } catch (updateErr) {
        const updateErrMsg = updateErr instanceof Error ? updateErr.message : String(updateErr);
        Logger.log('warning', 'general', 'enqueueEvent', `Outbox UPDATE after failed publish errored (non-fatal)`, { eventId, error: updateErrMsg });
      }

      Logger.log('warning', 'general', 'publishInterAppEvent', `SNS publish failed — event durable in outbox, will retry: ${eventType} → ${targetApplication}`, { tenantId, eventType, targetApplication, eventId, error: errMsg });

      Sentry.withScope((scope) => {
        scope.setTag('messaging.transport', 'sns');
        scope.setTag('messaging.target_app', targetApplication);
        scope.setTag('messaging.event_type', eventType);
        scope.setTag('messaging.recovered_via_outbox', 'true');
        scope.setContext('sns_publish_failure', {
          eventId,
          eventType,
          sourceApplication,
          targetApplication,
          tenantId,
          entityId,
          durationMs: Date.now() - startedAt,
        });
        Sentry.captureException(error);
      });

      // Caller sees success because the event IS durable. routingKey/eventId
      // are still valid; messageId is the outbox eventId until the poller
      // assigns an SNS message-id on retry.
      return {
        success: true,
        eventId,
        routingKey,
        messageId: eventId,
      };
    }
  }

  /**
   * Internal: SNS publish for a single outbox row. Used by OutboxPoller.
   * Bypasses the outbox insert/update bookkeeping (the poller manages that)
   * and just performs the SNS send through the circuit breaker.
   */
  async publishOutboxRow(row: {
    eventId: string;
    message: Record<string, unknown>;
    messageAttributes: Record<string, { DataType: string; StringValue: string }>;
  }): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      const response = await this.client.send(
        new PublishCommand({
          TopicArn: process.env.SNS_INTER_APP_TOPIC_ARN!,
          Message: JSON.stringify(row.message),
          MessageAttributes: row.messageAttributes,
        })
      );
      return response.MessageId ?? row.eventId;
    });
  }

  /**
   * Publish a broadcast event to SNS_BROADCAST_TOPIC_ARN (fanout — all consumers).
   */
  async publishBroadcast(
    eventType: string,
    eventData: Record<string, unknown>,
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventType: string }> {
    if (!process.env.SNS_BROADCAST_TOPIC_ARN) {
      Logger.log('error', 'general', 'publishBroadcast', `Broadcast DROPPED: ${eventType} — SNS_BROADCAST_TOPIC_ARN not set`);
      throw new Error(
        'SNS broadcast topic is not configured. Set SNS_BROADCAST_TOPIC_ARN environment variable.'
      );
    }

    const t0 = Date.now();
    Logger.log('info', 'general', 'publishBroadcast', `Publishing broadcast event: ${eventType}`, { eventType, payloadSize: JSON.stringify(eventData).length });

    try {
      const message = {
        eventType,
        timestamp: new Date().toISOString(),
        eventData,
        publishedBy,
      };

      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.SNS_BROADCAST_TOPIC_ARN,
          Message: JSON.stringify(message),
          MessageAttributes: injectTraceContext({
            eventType: { DataType: 'String', StringValue: eventType },
            broadcast: { DataType: 'String', StringValue: 'true' },
          }),
        })
      );

      const durationMs = Date.now() - t0;
      Logger.log('info', 'general', 'publishBroadcast', `Broadcast event published: ${eventType}`, { eventType, durationMs });

      Sentry.addBreadcrumb({
        category: 'messaging.publish',
        message: `SNS broadcast: ${eventType}`,
        level: 'info',
        data: { eventType, durationMs },
      });

      return { success: true, eventType };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      Logger.log('error', 'general', 'publishBroadcast', `Broadcast event publish failed: ${eventType}`, { eventType, error: errMsg });

      Sentry.withScope((scope) => {
        scope.setTag('messaging.transport', 'sns');
        scope.setTag('messaging.event_type', eventType);
        scope.setTag('messaging.broadcast', 'true');
        scope.setContext('sns_broadcast_failure', { eventType, durationMs: Date.now() - t0 });
        Sentry.captureException(error);
      });

      throw error;
    }
  }

  // ─── Convenience methods (delegates to publishInterAppEvent) ────────────────

  async publishRoleEventToSuite(
    eventType: string,
    tenantId: string,
    roleId: string,
    roleData: Record<string, unknown>,
    publishedBy = 'system',
    tx?: typeof db,
  ): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    // H-3: Reject empty/missing roleId before touching SNS — prevents phantom events
    if (!roleId || typeof roleId !== 'string' || roleId.trim().length === 0) {
      Logger.log('error', 'general', 'publishRoleEventToSuite', `Invalid roleId for eventType=${eventType} — publish aborted`, { roleId, eventType, tenantId });
      return this.businessSuiteApps.map((targetApp) => ({ targetApp, success: false, error: 'invalid roleId' }));
    }

    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> =
      [];
    for (const targetApp of this.businessSuiteApps) {
      if (tx) {
        // tx mode: one attempt, no retry, no per-app catch — a failure MUST
        // propagate so the caller's transaction rolls back (outbox rows stay
        // atomic with the domain write). No synchronous SNS; poller delivers.
        const result = await this.publishRoleEvent(targetApp, eventType, tenantId, roleId, roleData, publishedBy, tx);
        results.push({ targetApp, ...result });
        continue;
      }
      // H-6: Retry each per-app publish up to 2 times with exponential backoff
      try {
        const result = await this.withRetry(() =>
          this.publishRoleEvent(targetApp, eventType, tenantId, roleId, roleData, publishedBy)
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        Logger.log('error', 'general', 'publishRoleEventToSuite', `Failed to publish role event to ${targetApp} after retries`, { targetApp, error: err.message });
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  async publishRoleEvent(
    targetApplication: string,
    eventType: string,
    tenantId: string,
    roleId: string,
    roleData: Record<string, unknown>,
    publishedBy = 'system',
    tx?: typeof db,
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return this.publishInterAppEvent({
      tx,
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId: roleId,
      // Deterministic — downstream consumers dedupe by eventId on retry.
      // For assignment events, use assignmentId so different assignments of
      // the same role produce distinct eventIds.
      eventId: deriveEventId({
        eventType,
        tenantId,
        entityId: roleId,
        domainOpId:
          (eventType === 'role_assigned' || eventType === 'role_unassigned') &&
          typeof roleData.assignmentId === 'string'
            ? (roleData.assignmentId as string)
            : roleId,
        targetApplication,
      }),
      eventData: {
        roleId,
        roleName: roleData.roleName || roleData.name,
        description: roleData.description,
        permissions: roleData.permissions,
        restrictions: roleData.restrictions,
        metadata: roleData.metadata,
        ...(eventType.includes('created') && {
          createdBy: roleData.createdBy,
          createdAt: roleData.createdAt,
        }),
        ...(eventType.includes('updated') && {
          updatedBy: roleData.updatedBy,
          updatedAt: roleData.updatedAt,
        }),
        ...(eventType.includes('deleted') && {
          deletedBy: roleData.deletedBy,
          deletedAt: roleData.deletedAt,
          transferredToRoleId: roleData.transferredToRoleId,
          affectedUsersCount: roleData.affectedUsersCount,
        }),
        ...(eventType === 'role_assigned' && {
          assignmentId: roleData.assignmentId,
          userId: roleData.userId,
          assignedAt: roleData.assignedAt,
          assignedBy: roleData.assignedBy,
          expiresAt:
            roleData.expiresAt != null
              ? typeof roleData.expiresAt === 'string'
                ? roleData.expiresAt
                : (
                    roleData.expiresAt as { toISOString?: () => string }
                  )?.toISOString?.()
              : undefined,
          entityId: roleData.entityId ?? roleData.entityIdString,
          metadata: roleData.metadata,
        }),
        ...(eventType === 'role_unassigned' && {
          assignmentId: roleData.assignmentId,
          userId: roleData.userId,
          unassignedAt: roleData.unassignedAt,
          unassignedBy: roleData.unassignedBy,
          reason: roleData.reason,
        }),
      },
      publishedBy,
    });
  }

  async publishUserEventToSuite(
    eventType: string,
    tenantId: string,
    userId: string,
    userData: Record<string, unknown>,
    publishedBy = 'system',
    tx?: typeof db,
  ): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> =
      [];
    for (const targetApp of this.businessSuiteApps) {
      if (tx) {
        // tx mode: one attempt, no retry, no per-app catch — a failure MUST
        // propagate so the caller's transaction rolls back (atomic with the write).
        const result = await this.publishUserEvent(targetApp, eventType, tenantId, userId, userData, publishedBy, tx);
        results.push({ targetApp, ...result });
        continue;
      }
      try {
        const result = await this.withRetry(() =>
          this.publishUserEvent(targetApp, eventType, tenantId, userId, userData, publishedBy)
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        Logger.log('error', 'general', 'publishUserEventToSuite', `Failed to publish user event to ${targetApp} after retries`, { targetApp, error: err.message });
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  async publishUserEvent(
    targetApplication: string,
    eventType: string,
    tenantId: string,
    userId: string,
    userData: Record<string, unknown>,
    publishedBy = 'system',
    tx?: typeof db,
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const toIso = (v: unknown): string =>
      typeof v === 'string'
        ? v
        : (v as { toISOString?: () => string })?.toISOString?.() ?? '';

    const eventData: Record<string, unknown> = { userId, email: userData.email };
    if (userData.firstName != null) eventData.firstName = userData.firstName;
    if (userData.lastName != null) eventData.lastName = userData.lastName;
    if (userData.name != null) eventData.name = userData.name;
    if (userData.isActive !== undefined) eventData.isActive = userData.isActive;
    if (userData.createdAt != null) eventData.createdAt = toIso(userData.createdAt);
    if (userData.deactivatedAt != null) eventData.deactivatedAt = toIso(userData.deactivatedAt);
    if (userData.deactivatedBy != null) eventData.deactivatedBy = userData.deactivatedBy;
    if (userData.deletedAt != null) eventData.deletedAt = toIso(userData.deletedAt);
    if (userData.deletedBy != null) eventData.deletedBy = userData.deletedBy;
    if (userData.reason != null) eventData.reason = userData.reason;
    if (userData.idpSub != null) eventData.idpSub = userData.idpSub;

    return this.publishInterAppEvent({
      tx,
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId: userId,
      eventData,
      publishedBy,
    });
  }

  async publishOrgEventToSuite(
    eventType: string,
    tenantId: string,
    orgId: string,
    orgData: Record<string, unknown>,
    publishedBy = 'system'
  ): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> =
      [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.withRetry(() =>
          this.publishOrgEvent(targetApp, eventType, tenantId, orgId, orgData, publishedBy)
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        Logger.log('error', 'general', 'publishOrgEventToSuite', `Failed to publish org event to ${targetApp} after retries`, { targetApp, error: err.message });
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  async publishOrgEvent(
    targetApplication: string,
    eventType: string,
    tenantId: string,
    orgId: string,
    orgData: Record<string, unknown>,
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const entityId = String(
      orgId ||
        (orgData as { orgCode?: string; organizationId?: string }).orgCode ||
        (orgData as { orgCode?: string; organizationId?: string }).organizationId ||
        ''
    );
    return this.publishInterAppEvent({
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId,
      eventData: orgData,
      publishedBy,
    });
  }

  async publishCreditEvent(
    targetApplication: string,
    eventType: string,
    tenantId: string,
    creditData: Record<string, unknown>,
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const entityId = String(
      creditData.entityId ??
        creditData.allocationId ??
        creditData.configId ??
        `credit_${Date.now()}`
    );
    // If a natural domain operation ID is available (allocationId / configId /
    // operationId for consumption), derive a deterministic eventId so retries
    // collapse on the downstream consumer's dedup-by-eventId path.
    const naturalKey =
      (typeof creditData.allocationId === 'string' && creditData.allocationId) ||
      (typeof creditData.configId === 'string' && creditData.configId) ||
      (typeof creditData.operationId === 'string' && creditData.operationId) ||
      null;
    return this.publishInterAppEvent({
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId,
      eventData: creditData,
      publishedBy,
      ...(naturalKey
        ? {
            eventId: deriveEventId({
              eventType,
              tenantId,
              entityId,
              domainOpId: naturalKey,
              targetApplication,
            }),
          }
        : {}),
    });
  }

  async publishOrgAssignmentEventToSuite(
    eventType: string,
    tenantId: string,
    assignmentData: Record<string, unknown>,
    publishedBy = 'system',
    tx?: typeof db,
  ): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> =
      [];
    for (const targetApp of this.businessSuiteApps) {
      if (tx) {
        // tx mode: one attempt, no retry, no per-app catch — a failure MUST
        // propagate so the caller's transaction rolls back (atomic with the write).
        const result = await this.publishOrgAssignmentEvent(targetApp, eventType, tenantId, assignmentData, publishedBy, tx);
        results.push({ targetApp, ...result });
        continue;
      }
      try {
        const result = await this.withRetry(() =>
          this.publishOrgAssignmentEvent(targetApp, eventType, tenantId, assignmentData, publishedBy)
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        Logger.log('error', 'general', 'publishOrgAssignmentEventToSuite', `Failed to publish org assignment event to ${targetApp} after retries`, { targetApp, error: err.message });
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  async publishOrgAssignmentEvent(
    targetApplication: string,
    eventType: string,
    tenantId: string,
    assignmentData: Record<string, unknown>,
    publishedBy = 'system',
    tx?: typeof db,
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const entityId = String(assignmentData.assignmentId ?? assignmentData.userId ?? '');
    return this.publishInterAppEvent({
      tx,
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId,
      eventData: assignmentData,
      publishedBy,
    });
  }

  /**
   * Publish credit allocation event.
   * Sends deltaAmount (additive) so consumers accumulate; does NOT send
   * usedCredits or availableCredits — per-application consumption is owned by the consumer.
   */
  async publishCreditAllocation(
    targetApplication: string,
    tenantId: string,
    entityId: string,
    amount: number,
    metadata: Record<string, unknown> = {},
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return this.publishCreditEvent(
      targetApplication,
      'credit.allocated',
      tenantId,
      {
        entityId,
        deltaAmount: amount,
        amount,
        allocationId: (metadata as { allocationId?: string }).allocationId,
        reason: (metadata as { reason?: string }).reason || 'credit_allocation',
        ...metadata,
      },
      publishedBy
    );
  }

  async publishCreditConsumption(
    targetApplication: string,
    tenantId: string,
    entityId: string,
    userId: string,
    amount: number,
    operationType: string,
    operationId: string,
    metadata: Record<string, unknown> = {},
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return this.publishCreditEvent(
      targetApplication,
      'credit.consumed',
      tenantId,
      { entityId, userId, amount, operationType, operationId, ...metadata },
      publishedBy
    );
  }

  /**
   * Publish a credit.revoked event to a downstream application. Used by admin
   * tooling that pulls allocated credits back from an app (reduces the app's
   * allocated_credits in the wrapper-mirror table on the consumer side).
   */
  async publishCreditRevoked(
    targetApplication: string,
    tenantId: string,
    entityId: string,
    amount: number,
    metadata: Record<string, unknown> = {},
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return this.publishCreditEvent(
      targetApplication,
      'credit.revoked',
      tenantId,
      {
        entityId,
        deltaAmount: amount,
        allocatedCredits: amount,
        revokedAt: new Date().toISOString(),
        ...metadata,
      },
      publishedBy
    );
  }

  /**
   * Publish a configuration.updated event to every app in the business suite.
   * Consumers persist per-key configuration into their local mirror so each
   * app can serve config reads without a cross-service call.
   */
  async publishConfigurationUpdateToSuite(
    tenantId: string,
    configData: {
      entityId?: string;
      configKey: string;
      configCategory?: string;
      configValue: unknown;
      changedBy?: string;
    },
    publishedBy = 'system'
  ): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> = [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.withRetry(() =>
          this.publishInterAppEvent({
            eventType: 'configuration.updated',
            sourceApplication: 'wrapper',
            targetApplication: targetApp,
            tenantId,
            entityId: String(configData.entityId ?? 'global'),
            eventData: {
              entityId: configData.entityId ?? 'global',
              configKey: configData.configKey,
              configCategory: configData.configCategory ?? 'general',
              configValue: configData.configValue,
              changedBy: configData.changedBy ?? publishedBy,
              updatedAt: new Date().toISOString(),
            },
            publishedBy,
          })
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        Logger.log('error', 'general', 'publishConfigurationUpdateToSuite', `Failed to publish configuration.updated to ${targetApp} after retries`, { targetApp, error: err.message, configKey: configData.configKey });
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Retry helper with exponential backoff (default 2 retries: 500 ms → 1 000 ms).
   * Used by suite-broadcast methods to retry failed per-app publishes.
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 2,
    baseDelayMs = 500,
  ): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
        }
      }
    }
    throw lastErr;
  }

  /**
   * No-op — SNS SDK is stateless; there is no persistent connection to close.
   */
  async disconnect(): Promise<void> {
    Logger.log('info', 'general', 'disconnect', 'SNS publisher disconnect called (no-op — SDK is stateless)');
  }

  /**
   * SNS is stateless so we report isConnected=true whenever the publisher is
   * configured, describing SNS/SQS connectivity status.
   */
  getStatus(): { isConnected: boolean; reconnectAttempts: number } {
    return { isConnected: this.isConfigured(), reconnectAttempts: 0 };
  }
}

// Singleton instance
export const snsSqsPublisher = new SnsSqsPublisher();

// Export class for testing
export { SnsSqsPublisher };
