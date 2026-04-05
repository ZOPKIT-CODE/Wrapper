import { SNSClient, PublishCommand, GetTopicAttributesCommand } from '@aws-sdk/client-sns';
import * as Sentry from '@sentry/node';
import { CircuitBreaker } from '../../../utils/circuit-breaker.js';
import { maybeOffloadToS3 } from './large-payload-store.js';

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
  // Same relaxed thresholds as the former MQ publisher: 5 failures, 10s cooldown.
  private readonly circuitBreaker = new CircuitBreaker('sns-sqs', 5, 10000);

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
      console.warn('⚠️ ══════════════════════════════════════════════════════════════');
      console.warn('⚠️  SNS/SQS NOT CONFIGURED — event publishing is DISABLED');
      console.warn('⚠️  Set SNS_INTER_APP_TOPIC_ARN to enable event publishing');
      console.warn('⚠️ ══════════════════════════════════════════════════════════════');
      return false;
    }

    try {
      await this.client.send(
        new GetTopicAttributesCommand({ TopicArn: process.env.SNS_INTER_APP_TOPIC_ARN! })
      );
      console.log('✅ ══════════════════════════════════════════════════════════════');
      console.log('✅  SNS/SQS CONNECTED — event publishing is ACTIVE');
      console.log(`✅  Target apps: ${this.businessSuiteApps.join(', ')}`);
      console.log(`✅  Inter-app topic: ${process.env.SNS_INTER_APP_TOPIC_ARN}`);
      console.log('✅ ══════════════════════════════════════════════════════════════');
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ ══════════════════════════════════════════════════════════════');
      console.error('❌  SNS CONNECTIVITY CHECK FAILED — event publishing is DISABLED');
      console.error(`❌  Error: ${error.message}`);
      console.error('❌  Check: AWS credentials, region, topic ARN, IAM permissions');
      console.error('❌ ══════════════════════════════════════════════════════════════');
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
  }: {
    eventType: string;
    sourceApplication: string;
    targetApplication: string;
    tenantId: string;
    entityId: string;
    eventData?: Record<string, unknown>;
    publishedBy?: string;
    eventId?: string;
  }): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    if (!this.isConfigured()) {
      console.error(
        `❌ [SNS-DISABLED] Event DROPPED: ${sourceApplication} → ${targetApplication} (${eventType}) — SNS_INTER_APP_TOPIC_ARN not set`
      );
      throw new Error(
        'SNS publisher is not configured. Set SNS_INTER_APP_TOPIC_ARN environment variable.'
      );
    }

    const t0 = Date.now();
    console.log(
      `[SNS→] tenant=${tenantId} event=${eventType} → ${targetApplication} payload=${JSON.stringify(eventData)}`
    );

    return this.circuitBreaker.execute(async () => {
      try {
        const routingKey = this.generateRoutingKey(targetApplication, eventType);
        const resolvedEventId =
          eventId || `inter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Offload to S3 if payload exceeds 200 KB (SQS hard limit is 256 KB).
        // resolvedEventData is either the original object or { _s3Ref: { bucket, key } }.
        const { eventData: resolvedEventData } = await maybeOffloadToS3(resolvedEventId, eventData);

        const message = {
          eventId: resolvedEventId,
          eventType,
          sourceApplication,
          targetApplication,
          tenantId,
          entityId,
          timestamp: new Date().toISOString(),
          eventData: resolvedEventData,
          publishedBy,
        };

        const response = await this.client.send(
          new PublishCommand({
            TopicArn: process.env.SNS_INTER_APP_TOPIC_ARN!,
            Message: JSON.stringify(message),
            MessageAttributes: {
              targetApplication: { DataType: 'String', StringValue: targetApplication },
              sourceApplication: { DataType: 'String', StringValue: sourceApplication },
              eventType: { DataType: 'String', StringValue: eventType },
              tenantId: { DataType: 'String', StringValue: tenantId },
            },
          })
        );

        const snsMessageId = response.MessageId ?? resolvedEventId;
        const durationMs = Date.now() - t0;

        console.log(
          `[SNS→OK] tenant=${tenantId} event=${eventType} → ${targetApplication} snsMessageId=${snsMessageId} (${durationMs}ms)`
        );

        Sentry.addBreadcrumb({
          category: 'messaging.publish',
          message: `SNS published: ${eventType} → ${targetApplication}`,
          level: 'info',
          data: {
            eventId: resolvedEventId,
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
          eventId: resolvedEventId,
          routingKey,
          messageId: snsMessageId,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[SNS→ERR] tenant=${tenantId} event=${eventType} → ${targetApplication} ✗ ${errMsg}`
        );

        Sentry.withScope((scope) => {
          scope.setTag('messaging.transport', 'sns');
          scope.setTag('messaging.target_app', targetApplication);
          scope.setTag('messaging.event_type', eventType);
          scope.setContext('sns_publish_failure', {
            eventId,
            eventType,
            sourceApplication,
            targetApplication,
            tenantId,
            entityId,
            durationMs: Date.now() - t0,
          });
          Sentry.captureException(error);
        });

        throw error;
      }
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
      console.error(
        `❌ [SNS-DISABLED] Broadcast DROPPED: ${eventType} — SNS_BROADCAST_TOPIC_ARN not set`
      );
      throw new Error(
        'SNS broadcast topic is not configured. Set SNS_BROADCAST_TOPIC_ARN environment variable.'
      );
    }

    const t0 = Date.now();
    console.log(`[SNS→] event=${eventType} → broadcast payload=${JSON.stringify(eventData)}`);

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
          MessageAttributes: {
            eventType: { DataType: 'String', StringValue: eventType },
            broadcast: { DataType: 'String', StringValue: 'true' },
          },
        })
      );

      const durationMs = Date.now() - t0;
      console.log(`[SNS→OK] event=${eventType} → broadcast (${durationMs}ms)`);

      Sentry.addBreadcrumb({
        category: 'messaging.publish',
        message: `SNS broadcast: ${eventType}`,
        level: 'info',
        data: { eventType, durationMs },
      });

      return { success: true, eventType };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SNS→ERR] event=${eventType} → broadcast ✗ ${errMsg}`);

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
    publishedBy = 'system'
  ): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> =
      [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.publishRoleEvent(
          targetApp,
          eventType,
          tenantId,
          roleId,
          roleData,
          publishedBy
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Failed to publish role event to ${targetApp}:`, error);
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
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return this.publishInterAppEvent({
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId: roleId,
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
    publishedBy = 'system'
  ): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> =
      [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.publishUserEvent(
          targetApp,
          eventType,
          tenantId,
          userId,
          userData,
          publishedBy
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Failed to publish user event to ${targetApp}:`, error);
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
    publishedBy = 'system'
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
    if (userData.kindeUserId != null) eventData.kindeUserId = userData.kindeUserId;

    return this.publishInterAppEvent({
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
        const result = await this.publishOrgEvent(
          targetApp,
          eventType,
          tenantId,
          orgId,
          orgData,
          publishedBy
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Failed to publish org event to ${targetApp}:`, error);
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
    return this.publishInterAppEvent({
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId,
      eventData: creditData,
      publishedBy,
    });
  }

  async publishOrgAssignmentEventToSuite(
    eventType: string,
    tenantId: string,
    assignmentData: Record<string, unknown>,
    publishedBy = 'system'
  ): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> =
      [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.publishOrgAssignmentEvent(
          targetApp,
          eventType,
          tenantId,
          assignmentData,
          publishedBy
        );
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Failed to publish org assignment event to ${targetApp}:`, error);
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
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const entityId = String(assignmentData.assignmentId ?? assignmentData.userId ?? '');
    return this.publishInterAppEvent({
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
   * No-op — SNS SDK is stateless; there is no persistent connection to close.
   */
  async disconnect(): Promise<void> {
    console.log('🔌 SNS publisher disconnect called (no-op — SDK is stateless)');
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
