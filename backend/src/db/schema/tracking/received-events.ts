import { pgTable, uuid, text, jsonb, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Durable audit log of every event received from CRM/FA via SQS.
 * Populated in sqs-consumer before handler dispatch, then updated to
 * 'processed' | 'skipped' | 'failed' after the handler runs.
 *
 * UNIQUE(event_id) makes SQS redelivery idempotent — same event upserts
 * and bumps receive_count rather than inserting a duplicate row.
 */
export const receivedEvents = pgTable('received_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: text('event_id').notNull(),
  eventType: text('event_type').notNull(),
  sourceApplication: text('source_application').notNull(),
  targetApplication: text('target_application').notNull(),
  tenantId: uuid('tenant_id'),
  entityId: text('entity_id'),
  correlationId: text('correlation_id'),
  causationId: text('causation_id'),
  schemaVersion: text('schema_version'),
  payload: jsonb('payload').notNull(),
  rawEnvelope: jsonb('raw_envelope').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  handlerStatus: text('handler_status').notNull().default('pending'),
  handlerError: text('handler_error'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  receiveCount: integer('receive_count').notNull().default(1),
  sqsMessageId: text('sqs_message_id'),
}, (table) => ({
  eventIdUnique: uniqueIndex('received_events_event_id_unique').on(table.eventId),
  tenantIdx: index('idx_received_events_tenant').on(table.tenantId),
  typeIdx: index('idx_received_events_type').on(table.eventType),
  receivedAtIdx: index('idx_received_events_received_at').on(table.receivedAt),
  statusIdx: index('idx_received_events_status').on(table.handlerStatus),
}));
