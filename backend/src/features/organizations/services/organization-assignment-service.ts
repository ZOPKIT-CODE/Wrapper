import { v4 as uuidv4 } from 'uuid';
import { sql as dbSql, type db } from '../../../db/index.js';
import Logger from '../../../utils/logger.js';

/**
 * Organization Assignment Redis Streams Service
 * Publishes real-time events for organization assignments to CRM
 *
 * Features:
 * - Dual publishing (Redis Streams + Pub/Sub)
 * - Comprehensive error handling and retry logic
 * - Event validation and enrichment
 * - Performance monitoring and metrics
 * - Batch operations with rate limiting
 */
export class OrganizationAssignmentService {

  // Configuration constants
  static STREAM_KEY = 'crm:organization-assignments';
  static EVENT_VERSION = '1.1';
  static MAX_RETRY_ATTEMPTS = 3;
  static RETRY_DELAY_MS = 1000;
  static BATCH_DELAY_MS = 50;

  /**
   * Validate assignment data before publishing
   */
  static validateAssignmentData(data: Record<string, unknown> & { tenantId?: string; userId?: string; organizationId?: string; assignmentId?: string }) {
    const required = ['tenantId', 'userId', 'organizationId'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate UUIDs
    const uuidFields = ['tenantId', 'userId', 'organizationId', 'assignedBy'];
    for (const field of uuidFields) {
      const val = data[field];
      if (val != null && val !== '' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val))) {
        throw new Error(`Invalid UUID format for field: ${field}`);
      }
    }

    return true;
  }

  /**
   * Look up user's idpSub and email from the DB so consumers can resolve the user
   * without needing a separate wrapper_user_id_mapping table.
   */
  static async lookupUserIdentifiers(userId: string) {
    try {
      const [row] = await dbSql`
        SELECT idp_sub, email FROM tenant_users WHERE user_id = ${userId} LIMIT 1
      `;
      return row ? { userIdpSub: row.idp_sub || null, userEmail: row.email || null } : {};
    } catch (err: unknown) {
      const e = err as Error;
      Logger.log('warning', 'user', 'org-assignment', 'Could not look up user identifiers', { error: e.message });
      return {};
    }
  }

  /**
   * Enrich event data with additional context
   */
  static enrichEventData(assignmentData: Record<string, unknown>): Record<string, unknown> {
    const metadata = assignmentData.metadata;
    const metadataSpread = typeof metadata === 'object' && metadata !== null ? metadata as Record<string, unknown> : {};
    return {
      ...assignmentData,
      // Add computed fields
      eventTimestamp: new Date().toISOString(),
      organizationCode: assignmentData.organizationCode ?? assignmentData.organizationId,
      assignmentType: assignmentData.assignmentType ?? 'direct',
      isActive: assignmentData.isActive !== false,
      priority: assignmentData.priority ?? 1,
      metadata: {
        source: 'organization-assignment-service',
        version: this.EVENT_VERSION,
        ...metadataSpread
      }
    };
  }

  /**
   * Publish organization assignment created event with enhanced error handling
   */
  static async publishOrgAssignmentCreated(assignmentData: Record<string, unknown>, options: Record<string, unknown> = {}, tx?: typeof db) {
    const startTime = Date.now();

    Logger.log('info', 'user', 'publish-org-assignment-created', 'Publishing creation event', {
      assignmentId: assignmentData.assignmentId,
      userId: assignmentData.userId,
      organizationId: assignmentData.organizationId,
      tenantId: assignmentData.tenantId,
      assignedBy: assignmentData.assignedBy
    });

    try {
      // Validate input data
      this.validateAssignmentData(assignmentData);

      // Enrich event data
      const enrichedData = this.enrichEventData(assignmentData);

      // Resolve user identifiers so consumers (CRM, Ops, Accounting) can match the user
      const userIds = await this.lookupUserIdentifiers(String(enrichedData.userId ?? ''));

      // Create event payload
      const event = {
        eventId: uuidv4(),
        eventType: 'organization.assignment.created',
        source: 'wrapper-app',
        version: this.EVENT_VERSION,
        timestamp: new Date().toISOString(),
        tenantId: enrichedData.tenantId,
        data: {
          assignmentId: enrichedData.assignmentId || `assignment-${Date.now()}`,
          userId: enrichedData.userId,
          idpSub: userIds.userIdpSub || null,
          email: userIds.userEmail || null,
          organizationId: enrichedData.organizationId,
          organizationCode: enrichedData.organizationCode,
          assignmentType: enrichedData.assignmentType,
          accessLevel: enrichedData.accessLevel || 'standard',
          isActive: enrichedData.isActive,
          isPrimary: enrichedData.isPrimary || false,
          assignedAt: enrichedData.assignedAt || enrichedData.eventTimestamp,
          priority: enrichedData.priority,
          assignedBy: enrichedData.assignedBy,
          metadata: enrichedData.metadata
        }
      };

      // Publish with retry logic (tx-bound when a caller transaction is supplied)
      const result = await this.publishWithRetry(event, String(enrichedData.tenantId ?? ''), tx);

      // Log success with performance metrics
      const duration = Date.now() - startTime;
      Logger.log('info', 'user', 'publish-org-assignment-created', 'Successfully published creation event', {
        assignmentId: event.data.assignmentId,
        durationMs: duration,
        eventId: event.eventId
      });

      return {
        success: true,
        eventId: event.eventId,
        assignmentId: event.data.assignmentId,
        duration,
        result
      };

    } catch (err: unknown) {
      const error = err as Error;
      const duration = Date.now() - startTime;
      Logger.log('error', 'user', 'publish-org-assignment-created', 'Failed to publish creation event', {
        durationMs: duration,
        error: error.message,
        assignmentId: assignmentData.assignmentId,
        userId: assignmentData.userId,
        organizationId: assignmentData.organizationId,
        tenantId: assignmentData.tenantId
      });

      // tx mode: surface the failure so the caller's transaction rolls back (the
      // event must be atomic with the membership write). Non-tx: stay best-effort.
      if (tx) throw err;

      return {
        success: false,
        error: error.message,
        duration,
        assignmentData: assignmentData
      };
    }
  }

  /**
   * Core publishing logic with retry mechanism
   * Publishes via SNS
   */
  static async publishWithRetry(event: Record<string, unknown>, tenantId: string, tx?: typeof db) {
    if (tx) {
      // tx mode: write the outbox rows in the caller's transaction, ONE attempt
      // (no retry — a failed statement aborts the tx), and propagate so the caller
      // rolls back. No synchronous SNS; the poller delivers after commit.
      const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
      const eventData = (event.data || event) as Record<string, unknown>;
      const eventType = String(event.eventType ?? eventData.eventType ?? '');
      const results = await snsSqsPublisher.publishOrgAssignmentEventToSuite(
        eventType,
        tenantId,
        eventData,
        String(eventData.assignedBy ?? eventData.updatedBy ?? 'system'),
        tx,
      );
      const res = (results.find((r: { success?: boolean }) => r.success) ?? results[0]) as { eventId?: string; routingKey?: string };
      return { success: results.some((r: { success?: boolean }) => r.success), eventId: res?.eventId, routingKey: res?.routingKey, attempts: 1 };
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // Import SNS/SQS publisher
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        
        // Extract event type and data
        const eventData = (event.data || event) as Record<string, unknown>;
        const eventType = String(event.eventType ?? eventData.eventType ?? '');
        const assignmentData = eventData;

        // Publish via SNS - fan out to all business suite app SQS queues
        const results = await snsSqsPublisher.publishOrgAssignmentEventToSuite(
          eventType,
          tenantId,
          assignmentData as Record<string, unknown>,
          String(assignmentData.assignedBy ?? assignmentData.updatedBy ?? 'system')
        );

        // Results is an array of { targetApp, success, eventId, routingKey, ... }
        const firstSuccess = results.find((r: { success?: boolean }) => r.success);
        const result = firstSuccess || results[0];
        const res = result as { eventId?: string; routingKey?: string };
        Logger.log('info', 'user', 'publish-with-retry', 'Published to SNS', {
          eventType,
          eventId: res.eventId,
          routingKey: res.routingKey,
          assignmentId: assignmentData.assignmentId,
          targetApps: results.map((r: { targetApp?: string }) => r.targetApp).join(', '),
          attempt
        });

        return {
          success: results.some((r: { success?: boolean }) => r.success),
          eventId: res.eventId,
          routingKey: res.routingKey,
          attempts: attempt
        };

      } catch (err: unknown) {
        lastError = err;
        const error = err as Error;
        Logger.log('warning', 'user', 'publish-with-retry', 'Publish attempt failed', { attempt, maxAttempts: this.MAX_RETRY_ATTEMPTS, error: error.message });

        if (attempt < this.MAX_RETRY_ATTEMPTS) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS * attempt));
        }
      }
    }

    throw new Error(`Failed to publish after ${this.MAX_RETRY_ATTEMPTS} attempts: ${(lastError as Error).message}`);
  }

  /**
   * Publish organization assignment updated event
   */
  static async publishOrgAssignmentUpdated(assignmentData: Record<string, unknown>, options: Record<string, unknown> = {}, tx?: typeof db) {
    const startTime = Date.now();

    try {
      // Validate required fields for updates
      if (!assignmentData.assignmentId) {
        throw new Error('Missing required field: assignmentId');
      }
      this.validateAssignmentData(assignmentData);

      // Enrich event data
      const enrichedData = this.enrichEventData(assignmentData);

      // Resolve user identifiers so consumers can match the user
      const userIds = await this.lookupUserIdentifiers(String(enrichedData.userId ?? ''));

      // Create event payload
      const event = {
        eventId: uuidv4(),
        eventType: 'organization.assignment.updated',
        source: 'wrapper-app',
        version: this.EVENT_VERSION,
        timestamp: new Date().toISOString(),
        tenantId: enrichedData.tenantId,
        data: {
          assignmentId: enrichedData.assignmentId,
          userId: enrichedData.userId,
          idpSub: userIds.userIdpSub || null,
          email: userIds.userEmail || null,
          organizationId: enrichedData.organizationId,
          organizationCode: enrichedData.organizationCode,
          assignmentType: enrichedData.assignmentType,
          accessLevel: enrichedData.accessLevel,
          isActive: enrichedData.isActive,
          isPrimary: enrichedData.isPrimary,
          assignedAt: enrichedData.assignedAt,
          priority: enrichedData.priority,
          assignedBy: enrichedData.assignedBy,
          updatedBy: enrichedData.updatedBy || enrichedData.assignedBy,
          changes: enrichedData.changes || {},
          updatedAt: enrichedData.eventTimestamp,
          metadata: enrichedData.metadata
        }
      };

      // Publish with retry logic (tx-bound when a caller transaction is supplied)
      const result = await this.publishWithRetry(event, String(enrichedData.tenantId ?? ''), tx);

      // Log success with performance metrics
      const duration = Date.now() - startTime;
      Logger.log('info', 'user', 'publish-org-assignment-updated', 'Published org assignment updated', { assignmentId: event.data.assignmentId, durationMs: duration });

      return {
        success: true,
        eventId: event.eventId,
        assignmentId: event.data.assignmentId,
        duration,
        result
      };

    } catch (err: unknown) {
      const error = err as Error;
      const duration = Date.now() - startTime;
      Logger.log('error', 'user', 'publish-org-assignment-updated', 'Failed to publish org assignment updated', { durationMs: duration, error: error.message });

      // tx mode: surface so the caller's transaction rolls back. Non-tx: best-effort.
      if (tx) throw err;

      return {
        success: false,
        error: error.message,
        duration,
        assignmentData: assignmentData
      };
    }
  }

  /**
   * Publish organization assignment deactivated event
   */
  static async publishOrgAssignmentDeactivated(assignmentData: Record<string, unknown>, tx?: typeof db) {
    const eventId = uuidv4();

    const event = {
      eventId,
      eventType: 'organization.assignment.deactivated',
      source: 'wrapper-app',
      version: '1.0',
      timestamp: new Date().toISOString(),
      tenantId: assignmentData.tenantId,
      data: {
        assignmentId: assignmentData.assignmentId,
        userId: assignmentData.userId,
        organizationId: assignmentData.organizationId,
        deactivatedBy: assignmentData.deactivatedBy,
        reason: assignmentData.reason || 'user_request'
      }
    };

    try {
      // Use publishWithRetry (publishes via SNS → SQS)
      const result = await this.publishWithRetry(event, String(assignmentData.tenantId ?? ''), tx);
      Logger.log('info', 'user', 'publish-org-assignment-deactivated', 'Published organization assignment deactivated event', { assignmentId: event.data.assignmentId });
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'user', 'publish-org-assignment-deactivated', 'Failed to publish organization assignment deactivated event', { error: error.message });
      throw error;
    }
  }

  /**
   * Publish organization assignment activated event
   */
  static async publishOrgAssignmentActivated(assignmentData: Record<string, unknown>, tx?: typeof db) {
    const eventId = uuidv4();

    const event = {
      eventId,
      eventType: 'organization.assignment.activated',
      source: 'wrapper-app',
      version: '1.0',
      timestamp: new Date().toISOString(),
      tenantId: assignmentData.tenantId,
      data: {
        assignmentId: assignmentData.assignmentId,
        userId: assignmentData.userId,
        organizationId: assignmentData.organizationId,
        activatedBy: assignmentData.activatedBy
      }
    };

    try {
      // Use publishWithRetry (publishes via SNS → SQS)
      const result = await this.publishWithRetry(event, String(assignmentData.tenantId ?? ''), tx);
      Logger.log('info', 'user', 'publish-org-assignment-activated', 'Published organization assignment activated event', { assignmentId: event.data.assignmentId });
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'user', 'publish-org-assignment-activated', 'Failed to publish organization assignment activated event', { error: error.message });
      throw error;
    }
  }

  /**
   * Publish organization assignment deleted event
   */
  static async publishOrgAssignmentDeleted(assignmentData: Record<string, unknown>, tx?: typeof db) {
    const eventId = uuidv4();
    const startTime = Date.now();

    Logger.log('info', 'user', 'publish-org-assignment-deleted', 'Publishing deletion event', {
      assignmentId: assignmentData.assignmentId,
      userId: assignmentData.userId,
      organizationId: assignmentData.organizationId,
      tenantId: assignmentData.tenantId,
      deletedBy: assignmentData.deletedBy,
      reason: assignmentData.reason || 'permanent_removal',
      eventId
    });

    const event = {
      eventId,
      eventType: 'organization.assignment.deleted',
      source: 'wrapper-app',
      version: '1.0',
      timestamp: new Date().toISOString(),
      tenantId: assignmentData.tenantId,
      data: {
        assignmentId: assignmentData.assignmentId,
        userId: assignmentData.userId,
        organizationId: assignmentData.organizationId,
        deletedBy: assignmentData.deletedBy,
        reason: assignmentData.reason || 'permanent_removal'
      }
    };

    try {
      // Use publishWithRetry (tx-bound when a caller transaction is supplied)
      const result = await this.publishWithRetry(event, String(assignmentData.tenantId ?? ''), tx);
      const duration = Date.now() - startTime;
      Logger.log('info', 'user', 'publish-org-assignment-deleted', 'Successfully published deletion event', { assignmentId: event.data.assignmentId, durationMs: duration });
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      const duration = Date.now() - startTime;
      Logger.log('error', 'user', 'publish-org-assignment-deleted', 'Failed to publish deletion event', { durationMs: duration, error: error.message, assignmentId: assignmentData.assignmentId, tenantId: assignmentData.tenantId });
      throw error;
    }
  }

  /**
   * Helper method to create assignment ID
   */
  static generateAssignmentId(userId: string, organizationId: string) {
    return `${userId}_${organizationId}_${Date.now()}`;
  }

  /**
   * Bulk publish assignment events with enhanced error handling and rate limiting
   */
  static async publishBulkAssignments(assignments: Record<string, unknown>[], eventType = 'created', options: Record<string, unknown> = {}) {
    const startTime = Date.now();
    const results: unknown[] = [];
    const batchSize = (options.batchSize as number) || 10;
    const delay = (options.delay as number) || this.BATCH_DELAY_MS;

    Logger.log('info', 'user', 'publish-bulk-assignments', 'Starting bulk publish', { count: assignments.length, eventType });

    // Validate event type
    const validEventTypes = ['created', 'updated', 'deactivated', 'activated', 'deleted'];
    if (!validEventTypes.includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}. Must be one of: ${validEventTypes.join(', ')}`);
    }

    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];

      try {
        let result;
        switch (eventType) {
          case 'created':
            result = await this.publishOrgAssignmentCreated(assignment, options);
            break;
          case 'updated':
            result = await this.publishOrgAssignmentUpdated(assignment, options);
            break;
          case 'deactivated':
            result = await this.publishOrgAssignmentDeactivated(assignment);
            break;
          case 'activated':
            result = await this.publishOrgAssignmentActivated(assignment);
            break;
          case 'deleted':
            result = await this.publishOrgAssignmentDeleted(assignment);
            break;
        }

        const resultObj = result as { assignmentId?: string; eventId?: string };
        results.push({
          success: true,
          assignmentId: (assignment as Record<string, unknown>).assignmentId || resultObj.assignmentId,
          eventId: resultObj.eventId,
          result,
          index: i
        });

        // Progress logging for large batches
        if ((i + 1) % batchSize === 0 || i === assignments.length - 1) {
          Logger.log('info', 'user', 'publish-bulk-assignments', 'Bulk publish progress', { completed: i + 1, total: assignments.length, eventType });
        }

        // Rate limiting - configurable delay between publishes
        if (i < assignments.length - 1 && delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('error', 'user', 'publish-bulk-assignments', `Failed to publish ${eventType} event for assignment`, { assignmentId: (assignment as Record<string, unknown>).assignmentId || `index-${i}`, error: error.message });
        results.push({
          success: false,
          assignmentId: (assignment as Record<string, unknown>).assignmentId || `index-${i}`,
          error: error.message,
          index: i,
          assignment: assignment
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const typedResults = results as { success?: boolean }[];
    const successCount = typedResults.filter(r => r.success).length;
    const failureCount = typedResults.filter(r => !r.success).length;

    Logger.log('info', 'user', 'publish-bulk-assignments', 'Bulk publish completed', { successCount, failureCount, durationMs: totalDuration });

    return {
      total: assignments.length,
      successful: successCount,
      failed: failureCount,
      duration: totalDuration,
      results
    };
  }
}
