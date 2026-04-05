import { v4 as uuidv4 } from 'uuid';
import { sql as dbSql } from '../../../db/index.js';

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
   * Look up user's kindeUserId and email from the DB so consumers can resolve the user
   * without needing a separate wrapper_user_id_mapping table.
   */
  static async lookupUserIdentifiers(userId: string) {
    try {
      const [row] = await dbSql`
        SELECT kinde_user_id, email FROM tenant_users WHERE user_id = ${userId} LIMIT 1
      `;
      return row ? { userKindeId: row.kinde_user_id || null, userEmail: row.email || null } : {};
    } catch (err: unknown) {
      const e = err as Error;
      console.warn('⚠️ [ORG-ASSIGNMENT] Could not look up user identifiers:', e.message);
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
  static async publishOrgAssignmentCreated(assignmentData: Record<string, unknown>, options: Record<string, unknown> = {}) {
    const startTime = Date.now();

    console.log(`📡 [ORG-ASSIGNMENT-CREATE] Publishing creation event:`, {
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
          userKindeId: userIds.userKindeId || null,
          userEmail: userIds.userEmail || null,
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

      // Publish with retry logic
      const result = await this.publishWithRetry(event, String(enrichedData.tenantId ?? ''));

      // Log success with performance metrics
      const duration = Date.now() - startTime;
      console.log(`✅ [ORG-ASSIGNMENT-CREATE] Successfully published creation event: ${event.data.assignmentId} (${duration}ms)`, {
        eventId: event.eventId,
        streamId: (result as Record<string, unknown>).stream,
        pubsubSubscribers: (result as Record<string, unknown>).pubsub
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
      console.error(`❌ [ORG-ASSIGNMENT-CREATE] Failed to publish creation event (${duration}ms):`, {
        error: error.message,
        stack: error.stack,
        assignmentData: { 
          assignmentId: assignmentData.assignmentId,
          userId: assignmentData.userId,
          organizationId: assignmentData.organizationId,
          tenantId: assignmentData.tenantId
        }
      });

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
  static async publishWithRetry(event: Record<string, unknown>, tenantId: string) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // Import SNS/SQS publisher
        const { snsSqsPublisher } = await import('../../messaging/utils/sns-sqs-publisher.js');
        
        // Extract event type and data
        const eventData = (event.data || event) as Record<string, unknown>;
        const eventType = String(event.eventType ?? eventData.eventType ?? '');
        const assignmentData = eventData;

        // Publish to RabbitMQ - publish to all business suite apps
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
        console.log(`✅ [ORG-ASSIGNMENT] Published to SNS: ${eventType}`, {
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
        console.warn(`⚠️ Publish attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS} failed:`, error.message);

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
  static async publishOrgAssignmentUpdated(assignmentData: Record<string, unknown>, options: Record<string, unknown> = {}) {
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
          userKindeId: userIds.userKindeId || null,
          userEmail: userIds.userEmail || null,
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

      // Publish with retry logic
      const result = await this.publishWithRetry(event, String(enrichedData.tenantId ?? ''));

      // Log success with performance metrics
      const duration = Date.now() - startTime;
      console.log(`✅ Published org assignment updated: ${event.data.assignmentId} (${duration}ms)`);

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
      console.error(`❌ Failed to publish org assignment updated (${duration}ms):`, {
        error: error.message,
        assignmentData: { ...assignmentData, metadata: undefined },
        stack: error.stack
      });

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
  static async publishOrgAssignmentDeactivated(assignmentData: Record<string, unknown>) {
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
      // Use publishWithRetry which now uses RabbitMQ
      const result = await this.publishWithRetry(event, String(assignmentData.tenantId ?? ''));
      console.log(`📡 Published organization assignment deactivated event: ${event.data.assignmentId}`);
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to publish organization assignment deactivated event:', error);
      throw error;
    }
  }

  /**
   * Publish organization assignment activated event
   */
  static async publishOrgAssignmentActivated(assignmentData: Record<string, unknown>) {
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
      // Use publishWithRetry which now uses RabbitMQ
      const result = await this.publishWithRetry(event, String(assignmentData.tenantId ?? ''));
      console.log(`📡 Published organization assignment activated event: ${event.data.assignmentId}`);
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to publish organization assignment activated event:', error);
      throw error;
    }
  }

  /**
   * Publish organization assignment deleted event
   */
  static async publishOrgAssignmentDeleted(assignmentData: Record<string, unknown>) {
    const eventId = uuidv4();
    const startTime = Date.now();

    console.log(`📡 [ORG-ASSIGNMENT-DELETE] Publishing deletion event:`, {
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
      // Use publishWithRetry which now uses RabbitMQ
      const result = await this.publishWithRetry(event, String(assignmentData.tenantId ?? ''));
      const duration = Date.now() - startTime;
      console.log(`✅ [ORG-ASSIGNMENT-DELETE] Successfully published deletion event: ${event.data.assignmentId} (${duration}ms)`);
      return result;
    } catch (err: unknown) {
      const error = err as Error;
      const duration = Date.now() - startTime;
      console.error(`❌ [ORG-ASSIGNMENT-DELETE] Failed to publish deletion event (${duration}ms):`, {
        error: error.message,
        stack: error.stack,
        assignmentId: assignmentData.assignmentId,
        tenantId: assignmentData.tenantId
      });
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

    console.log(`📦 Starting bulk publish of ${assignments.length} ${eventType} events`);

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
          console.log(`📊 Bulk publish progress: ${i + 1}/${assignments.length} ${eventType} events`);
        }

        // Rate limiting - configurable delay between publishes
        if (i < assignments.length - 1 && delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (err: unknown) {
        const error = err as Error;
        console.error(`❌ Failed to publish ${eventType} event for assignment ${(assignment as Record<string, unknown>).assignmentId || `index-${i}`}:`, error.message);
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

    console.log(`✅ Bulk publish completed: ${successCount} success, ${failureCount} failed (${totalDuration}ms total)`);

    return {
      total: assignments.length,
      successful: successCount,
      failed: failureCount,
      duration: totalDuration,
      results
    };
  }
}
