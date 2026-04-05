import { pgTable, uuid, varchar, timestamp, text, jsonb, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
// tenant_id and entity_id are uuid (changed from text via M007)

export const eventTracking = pgTable('event_tracking', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: text('event_id').notNull(),
  eventType: text('event_type').notNull(),
  tenantId: uuid('tenant_id').notNull(),   // M007: changed TEXT → UUID
  entityId: uuid('entity_id'),             // M007: changed TEXT → UUID
  streamKey: text('stream_key').notNull(),
  sourceApplication: varchar('source_application', { length: 50 }).notNull(),
  targetApplication: varchar('target_application', { length: 50 }).notNull(),
  eventData: jsonb('event_data').default({}),
  publishedBy: text('published_by'),
  metadata: jsonb('metadata').default({}),
  status: text('status').notNull(), // 'published', 'failed'
  errorMessage: text('error_message'),
  isRetryable: boolean('is_retryable').default(true),
  retryCount: integer('retry_count').default(0),
  lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow(),
  acknowledged: boolean('acknowledged').default(false),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  // Existing index names in current schema usage
  eventIdUnique: uniqueIndex('event_tracking_event_id_unique').on(table.eventId),
  eventIdKey: uniqueIndex('event_tracking_event_id_key').on(table.eventId),
  eventIdIdx: index('event_tracking_event_id_idx').on(table.eventId),
  eventTypeIdx: index('event_tracking_event_type_idx').on(table.eventType),
  tenantIdIdx: index('event_tracking_tenant_id_idx').on(table.tenantId),
  statusIdx: index('event_tracking_status_idx').on(table.status),
  publishedAtIdx: index('event_tracking_published_at_idx').on(table.publishedAt),
  createdAtIdx: index('event_tracking_created_at_idx').on(table.createdAt),

  // Additional legacy/production index names for strict parity
  idxEventTrackingTenant: index('idx_event_tracking_tenant').on(table.tenantId),
  idxEventTrackingEventId: index('idx_event_tracking_event_id').on(table.eventId),
  idxEventTrackingStatus: index('idx_event_tracking_status').on(table.status),
  idxEventTrackingAcknowledged: index('idx_event_tracking_acknowledged').on(table.acknowledged),
  idxEventTrackingPublishedAt: index('idx_event_tracking_published_at').on(table.publishedAt),
  idxEventTrackingAcknowledgedAt: index('idx_event_tracking_acknowledged_at').on(table.acknowledgedAt),
  idxEventTrackingSourceApp: index('idx_event_tracking_source_app').on(table.sourceApplication),
  idxEventTrackingTargetApp: index('idx_event_tracking_target_app').on(table.targetApplication),

  // Composite indexes present in production; modeled without partial clauses in schema definitions.
  eventTrackingAcknowledgedIdx: index('event_tracking_acknowledged_idx').on(table.acknowledged, table.targetApplication, table.createdAt),
  eventTrackingReplayIdx: index('event_tracking_replay_idx').on(table.status, table.retryCount, table.publishedAt),
  eventTrackingTargetAppIdx: index('event_tracking_target_app_idx').on(table.targetApplication, table.status),
  eventTrackingTenantTypeIdx: index('event_tracking_tenant_type_idx').on(table.tenantId, table.eventType, table.createdAt)
}));
