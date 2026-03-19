import amqp from 'amqplib';

/** Minimal type for amqplib connection (library types can vary) */
interface AmqpConnectionLike {
  createConfirmChannel(): Promise<AmqpChannelLike>;
  on(event: string, cb: (...args: unknown[]) => void): void;
  close(): Promise<void>;
}

/** Minimal type for amqplib confirm channel */
interface AmqpChannelLike {
  assertExchange(name: string, type: string, options: Record<string, unknown>): Promise<unknown>;
  on(event: string, cb: (...args: unknown[]) => void): void;
  publish(exchange: string, routingKey: string, content: Buffer, options: Record<string, unknown>, callback?: (err: Error | null) => void): boolean;
  once(event: string, cb: () => void): void;
  close(): Promise<void>;
}

/**
 * Amazon MQ Publisher
 * 
 * Handles publishing events to Amazon MQ (RabbitMQ) for inter-application messaging.
 * Replaces Redis Streams publishing with AMQP-based messaging.
 */
class AmazonMQPublisher {
  private connection: AmqpConnectionLike | null = null;
  private channel: AmqpChannelLike | null = null;
  private isConnected = false;
  private readonly exchange = 'inter-app-events';
  private readonly broadcastExchange = 'inter-app-broadcast';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000; // 5 seconds
  private readonly businessSuiteApps: string[];

  constructor() {
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
   * Check if Amazon MQ credentials are configured in environment variables.
   */
  isConfigured(): boolean {
    const url = process.env.AMAZON_MQ_URL;
    if (url && url.startsWith('amqp')) return true;
    return !!(
      (process.env.AMAZON_MQ_HOSTNAME || process.env.AMAZON_MQ_HOST) &&
      process.env.AMAZON_MQ_USERNAME &&
      process.env.AMAZON_MQ_PASSWORD
    );
  }

  /**
   * Attempt to connect at startup. Logs diagnostics on failure but does not
   * crash the server so other features keep working.
   */
  async initializeAtStartup(): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('⚠️ ══════════════════════════════════════════════════════════════');
      console.warn('⚠️  AMAZON MQ NOT CONFIGURED — event publishing is DISABLED');
      console.warn('⚠️  Set AMAZON_MQ_URL or AMAZON_MQ_HOSTNAME/USERNAME/PASSWORD');
      console.warn('⚠️ ══════════════════════════════════════════════════════════════');
      return false;
    }

    try {
      await this.connect();
      console.log('✅ ══════════════════════════════════════════════════════════════');
      console.log('✅  AMAZON MQ CONNECTED — event publishing is ACTIVE');
      console.log(`✅  Target apps: ${this.businessSuiteApps.join(', ')}`);
      console.log('✅ ══════════════════════════════════════════════════════════════');
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ ══════════════════════════════════════════════════════════════');
      console.error('❌  AMAZON MQ CONNECTION FAILED — event publishing is DISABLED');
      console.error(`❌  Error: ${error.message}`);
      console.error('❌  Events will NOT be published until the connection is restored.');
      console.error('❌  Check: credentials, hostname, port, network/firewall, TLS settings');
      console.error('❌ ══════════════════════════════════════════════════════════════');
      return false;
    }
  }

  /**
   * Connect to Amazon MQ
   * Supports both URL string format and object format
   */
  async connect() {
    if (this.isConnected && this.connection && this.channel) {
      return;
    }

    try {
      // Try URL format first
      const url = process.env.AMAZON_MQ_URL;
      
      // If URL format, use it directly
      // Otherwise, try object format from environment variables
      let connectionOptions;
      
      if (url && url.startsWith('amqp')) {
        // URL format: amqps://user:pass@host:port
        connectionOptions = url;
      } else {
        // Object format: use individual environment variables
        const hostname = process.env.AMAZON_MQ_HOSTNAME || process.env.AMAZON_MQ_HOST;
        const username = process.env.AMAZON_MQ_USERNAME;
        const password = process.env.AMAZON_MQ_PASSWORD;
        const port = parseInt(process.env.AMAZON_MQ_PORT ?? '', 10) || 5671;
        const protocol = (process.env.AMAZON_MQ_PROTOCOL || 'amqps') as 'amqp' | 'amqps';
        
        if (!hostname || !username || !password) {
          throw new Error('AMAZON_MQ_URL or AMAZON_MQ_HOSTNAME/USERNAME/PASSWORD environment variables must be set');
        }
        
        connectionOptions = {
          protocol,
          hostname,
          port,
          username,
          password
        };
      }

      console.log('🔌 Connecting to Amazon MQ...');
      this.connection = (await amqp.connect(connectionOptions as string)) as AmqpConnectionLike;
      
      // Use confirm channel for guaranteed publishing
      this.channel = (await this.connection.createConfirmChannel()) as AmqpChannelLike;

      // Assert exchanges exist (idempotent - won't recreate if they exist)
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      await this.channel.assertExchange(this.broadcastExchange, 'fanout', { durable: true });

      // Set up return callback to detect unrouted messages
      // This fires when mandatory=true and message can't be routed to any queue
      this.channel.on('return', (...args: unknown[]) => {
        const msg = args[0] as { fields: { routingKey: string; exchange: string; replyCode: number; replyText: string }; content?: Buffer };
        const routingKey = msg.fields.routingKey;
        const exchange = msg.fields.exchange;
        const replyCode = msg.fields.replyCode;
        const replyText = msg.fields.replyText;
        const messageContent = msg.content ? msg.content.toString() : 'N/A';
        
        console.error(`❌ MESSAGE NOT ROUTED: Message returned by broker (unroutable)`);
        console.error(`   Exchange: ${exchange}`);
        console.error(`   Routing Key: ${routingKey}`);
        console.error(`   Reply Code: ${replyCode}`);
        console.error(`   Reply Text: ${replyText}`);
        console.error(`   Message Content: ${messageContent.substring(0, 200)}...`);
        console.error(`   ⚠️ This means no queue is bound to match routing key "${routingKey}"`);
        console.error(`   💡 Check queue bindings in RabbitMQ UI or run: node scripts/verify-and-fix-bindings.js`);
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Connected to Amazon MQ');

      // Handle connection errors
      this.connection!.on('error', (...args: unknown[]) => {
        const err = args[0] as Error;
        console.error('❌ Amazon MQ connection error:', err);
        this.isConnected = false;
        this.handleReconnect();
      });

      this.connection!.on('close', () => {
        console.warn('⚠️ Amazon MQ connection closed');
        this.isConnected = false;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleReconnect();
        }
      });

    } catch (error) {
      console.error('❌ Failed to connect to Amazon MQ:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Handle reconnection
   */
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect to Amazon MQ (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
    
    try {
      await this.connect();
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
    }
  }

  /**
   * Generate routing key from event data
   * Converts: { targetApplication: 'crm', eventType: 'user.created' }
   * To: 'crm.user.created'
   * 
   * Also handles: 'user_created' -> 'user.created'
   * Maps 'operations' -> 'ops' so messages reach ops-events (bound to ops.#).
   */
  generateRoutingKey(targetApplication: string, eventType: string): string {
    // Normalize eventType: replace underscores with dots
    const normalizedEventType = eventType.replace(/_/g, '.');
    // Map app names to queue binding prefixes (ops-events is bound to ops.#, not operations.#)
    const routingPrefix = targetApplication === 'operations' ? 'ops' : targetApplication;
    return `${routingPrefix}.${normalizedEventType}`;
  }

  /**
   * Publish inter-application event
   * Replaces Redis Streams publishInterAppEvent
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
      console.error(`❌ [MQ-DISABLED] Event DROPPED: ${sourceApplication} → ${targetApplication} (${eventType}) — Amazon MQ not configured`);
      throw new Error('Amazon MQ is not configured. Set AMAZON_MQ_URL or AMAZON_MQ_HOSTNAME/USERNAME/PASSWORD environment variables.');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const routingKey = this.generateRoutingKey(targetApplication, eventType);
      const resolvedEventId = eventId || `inter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const message = {
        eventId: resolvedEventId,
        eventType,
        sourceApplication,
        targetApplication,
        tenantId,
        entityId,
        timestamp: new Date().toISOString(),
        eventData,
        publishedBy
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));

      // Helper function to perform the actual publish with confirmation
      const doPublish = (): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
          let callbackFired = false;
          const timeout = setTimeout(() => {
            if (!callbackFired) {
              console.error(`⏱️ Publish confirmation timeout for ${message.eventId} (routingKey: ${routingKey})`);
              reject(new Error(`Publish confirmation timeout for ${message.eventId}`));
            }
          }, 10000); // Increased timeout to 10 seconds

          console.log(`📝 Attempting to publish message ${message.eventId} with routingKey: ${routingKey} to exchange: ${this.exchange}`);

          const ch = this.channel as AmqpChannelLike;
          const published = ch.publish(
            this.exchange,
            routingKey,
            messageBuffer,
            {
              persistent: true, // Message survives broker restart
              mandatory: true, // Return message if it can't be routed to any queue
              messageId: message.eventId,
              timestamp: Date.now(),
              headers: {
                sourceApp: sourceApplication,
                targetApp: targetApplication,
                tenantId,
                entityId,
                eventType
              }
            },
            (err: Error | null) => {
              callbackFired = true;
              clearTimeout(timeout);
              // This callback is called when publish is confirmed (no err) or fails (err set)
              // Note: This confirms broker ACCEPTED the message, not that it was ROUTED to a queue
              // Use the 'return' event handler to detect unrouted messages
              if (err) {
                console.error(`❌ Broker rejected message ${message.eventId}:`, err);
                reject(err);
              } else {
                console.log(`✅ Broker confirmed receipt of message ${message.eventId} (routingKey: ${routingKey})`);
                // Note: If message can't be routed, it will trigger the 'return' event
                // We resolve here because broker accepted it, routing is checked separately
                resolve(undefined);
              }
            }
          );

          if (!published) {
            console.warn(`⚠️ Buffer full for message ${message.eventId}, waiting for drain...`);
            clearTimeout(timeout);
            // Buffer full, wait for drain event then retry
            this.channel!.once('drain', () => {
              console.log(`💧 Drain event received, retrying publish for ${message.eventId}`);
              doPublish().then(resolve).catch(reject);
            });
          } else {
            console.log(`📤 Message ${message.eventId} queued in buffer, waiting for broker confirmation...`);
          }
        });
      };

      await doPublish();

      console.log(`📤 Published to Amazon MQ: ${sourceApplication} → ${targetApplication} (${routingKey})`);
      
      return {
        success: true,
        eventId: message.eventId,
        routingKey,
        messageId: message.eventId
      };

    } catch (error) {
      console.error('❌ Failed to publish to Amazon MQ:', error);
      
      // Try to reconnect if connection lost
      if (!this.isConnected) {
        await this.handleReconnect();
      }
      
      throw error;
    }
  }

  /**
   * Publish role event to all business suite applications
   */
  async publishRoleEventToSuite(eventType: string, tenantId: string, roleId: string, roleData: Record<string, unknown>, publishedBy = 'system'): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> = [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.publishRoleEvent(targetApp, eventType, tenantId, roleId, roleData, publishedBy);
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Failed to publish role event to ${targetApp}:`, error);
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Publish role event to target application
   */
  async publishRoleEvent(targetApplication: string, eventType: string, tenantId: string, roleId: string, roleData: Record<string, unknown>, publishedBy = 'system'): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return await this.publishInterAppEvent({
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
          createdAt: roleData.createdAt
        }),
        ...(eventType.includes('updated') && {
          updatedBy: roleData.updatedBy,
          updatedAt: roleData.updatedAt
        }),
        ...(eventType.includes('deleted') && {
          deletedBy: roleData.deletedBy,
          deletedAt: roleData.deletedAt,
          transferredToRoleId: roleData.transferredToRoleId,
          affectedUsersCount: roleData.affectedUsersCount
        }),
        ...(eventType === 'role_assigned' && {
          assignmentId: roleData.assignmentId,
          userId: roleData.userId,
          assignedAt: roleData.assignedAt,
          assignedBy: roleData.assignedBy,
          expiresAt: roleData.expiresAt != null ? (typeof roleData.expiresAt === 'string' ? roleData.expiresAt : (roleData.expiresAt as { toISOString?: () => string })?.toISOString?.()) : undefined,
          entityId: roleData.entityId ?? roleData.entityIdString,
          metadata: roleData.metadata
        }),
        ...(eventType === 'role_unassigned' && {
          assignmentId: roleData.assignmentId,
          userId: roleData.userId,
          unassignedAt: roleData.unassignedAt,
          unassignedBy: roleData.unassignedBy,
          reason: roleData.reason
        })
      },
      publishedBy
    });
  }

  /**
   * Publish user event to all business suite applications
   */
  async publishUserEventToSuite(eventType: string, tenantId: string, userId: string, userData: Record<string, unknown>, publishedBy = 'system'): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> = [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.publishUserEvent(targetApp, eventType, tenantId, userId, userData, publishedBy);
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Failed to publish user event to ${targetApp}:`, error);
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Publish user event to target application
   */
  async publishUserEvent(targetApplication: string, eventType: string, tenantId: string, userId: string, userData: Record<string, unknown>, publishedBy = 'system'): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const toIso = (v: unknown): string => (typeof v === 'string' ? v : (v as { toISOString?: () => string })?.toISOString?.() ?? '');
    const eventData: Record<string, unknown> = {
      userId,
      email: userData.email
    };
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

    return await this.publishInterAppEvent({
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId: userId,
      eventData,
      publishedBy
    });
  }

  /**
   * Publish organization event to all business suite applications
   */
  async publishOrgEventToSuite(eventType: string, tenantId: string, orgId: string, orgData: Record<string, unknown>, publishedBy = 'system'): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> = [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.publishOrgEvent(targetApp, eventType, tenantId, orgId, orgData, publishedBy);
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Failed to publish org event to ${targetApp}:`, error);
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Publish organization event to target application
   */
  async publishOrgEvent(targetApplication: string, eventType: string, tenantId: string, orgId: string, orgData: Record<string, unknown>, publishedBy = 'system'): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const entityId = String(orgId || (orgData as { orgCode?: string; organizationId?: string }).orgCode || (orgData as { orgCode?: string; organizationId?: string }).organizationId || '');
    return await this.publishInterAppEvent({
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId,
      eventData: orgData,
      publishedBy
    });
  }

  /**
   * Publish credit event to target application
   */
  async publishCreditEvent(targetApplication: string, eventType: string, tenantId: string, creditData: Record<string, unknown>, publishedBy = 'system'): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const entityId = String(creditData.entityId ?? creditData.allocationId ?? creditData.configId ?? `credit_${Date.now()}`);
    return await this.publishInterAppEvent({
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId,
      eventData: creditData,
      publishedBy
    });
  }

  /**
   * Publish organization assignment event to all business suite applications
   */
  async publishOrgAssignmentEventToSuite(eventType: string, tenantId: string, assignmentData: Record<string, unknown>, publishedBy = 'system'): Promise<Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }>> {
    const results: Array<{ targetApp: string; success?: boolean; eventId?: string; error?: string }> = [];
    for (const targetApp of this.businessSuiteApps) {
      try {
        const result = await this.publishOrgAssignmentEvent(targetApp, eventType, tenantId, assignmentData, publishedBy);
        results.push({ targetApp, ...result });
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Failed to publish org assignment event to ${targetApp}:`, error);
        results.push({ targetApp, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Publish organization assignment event to target application
   */
  async publishOrgAssignmentEvent(targetApplication: string, eventType: string, tenantId: string, assignmentData: Record<string, unknown>, publishedBy = 'system'): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    const entityId = String(assignmentData.assignmentId ?? assignmentData.userId ?? '');
    return await this.publishInterAppEvent({
      eventType,
      sourceApplication: 'wrapper',
      targetApplication,
      tenantId,
      entityId,
      eventData: assignmentData,
      publishedBy
    });
  }

  /**
   * Publish credit allocation event.
   * Sends deltaAmount (additive) so consumers (e.g. FA) accumulate; do NOT send
   * usedCredits or availableCredits — per-application consumption is owned by the consumer.
   */
  async publishCreditAllocation(targetApplication: string, tenantId: string, entityId: string, amount: number, metadata: Record<string, unknown> = {}, publishedBy = 'system'): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return await this.publishCreditEvent(
      targetApplication,
      'credit.allocated',
      tenantId,
      {
        entityId,
        deltaAmount: amount,
        amount,
        allocationId: (metadata as { allocationId?: string }).allocationId,
        reason: ((metadata as { reason?: string }).reason) || 'credit_allocation',
        ...metadata
      },
      publishedBy
    );
  }

  /**
   * Publish credit consumption event
   */
  async publishCreditConsumption(targetApplication: string, tenantId: string, entityId: string, userId: string, amount: number, operationType: string, operationId: string, metadata: Record<string, unknown> = {}, publishedBy = 'system'): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return await this.publishCreditEvent(
      targetApplication,
      'credit.consumed',
      tenantId,
      {
        entityId,
        userId,
        amount,
        operationType,
        operationId,
        ...metadata
      },
      publishedBy
    );
  }

  /**
   * Publish broadcast event (all applications)
   * Uses fanout exchange which ignores routing key
   */
  async publishBroadcast(eventType: string, eventData: Record<string, unknown>, publishedBy = 'system'): Promise<{ success: boolean; eventType: string }> {
    if (!this.isConfigured()) {
      console.error(`❌ [MQ-DISABLED] Broadcast DROPPED: ${eventType} — Amazon MQ not configured`);
      throw new Error('Amazon MQ is not configured.');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const message = {
        eventType,
        timestamp: new Date().toISOString(),
        eventData,
        publishedBy
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));

      // Wrap in Promise to wait for confirmation
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Broadcast publish confirmation timeout for ${eventType}`));
        }, 5000);

        const ch = this.channel as AmqpChannelLike;
        const published = ch.publish(
          this.broadcastExchange,
          '', // Fanout exchange ignores routing key
          messageBuffer,
          {
            persistent: true,
            timestamp: Date.now(),
            headers: {
              eventType,
              broadcast: true
            }
          },
          (err: Error | null) => {
            clearTimeout(timeout);
            if (err) {
              console.error(`❌ Failed to publish broadcast ${eventType}:`, err);
              reject(err);
            } else {
              resolve();
            }
          }
        );

        if (!published) {
          clearTimeout(timeout);
          // Buffer full, wait for drain event
          this.channel!.once('drain', () => {
            // Retry publish after drain
            this.publishBroadcast(eventType, eventData, publishedBy).then(() => resolve()).catch(reject);
          });
        }
      });

      console.log(`📢 Published broadcast to Amazon MQ: ${eventType}`);
      
      return {
        success: true,
        eventType
      };

    } catch (error) {
      console.error('❌ Failed to publish broadcast:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Amazon MQ
   */
  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.isConnected = false;
      console.log('🔌 Disconnected from Amazon MQ');
    } catch (error: unknown) {
      console.error('❌ Error disconnecting from Amazon MQ:', error);
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { isConnected: boolean; reconnectAttempts: number } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton instance
export const amazonMQPublisher = new AmazonMQPublisher();

// Also export class for testing
export { AmazonMQPublisher };

