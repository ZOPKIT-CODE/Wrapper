import { pgTable, uuid, text, jsonb, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Transactional outbox for inter-app SNS events.
 *
 * Every call to enqueueEvent() inserts a row here BEFORE attempting an SNS
 * publish. On publish success we set published_at = now(); on failure (circuit
 * breaker open, network error, etc.) we leave published_at NULL so the outbox
 * poller can retry it later.
 *
 * This is intentionally separate from event_tracking — event_tracking is the
 * historical/audit log of every publish attempt (success or failure), while
 * inter_app_outbox is a small, mutable, work-queue-style table that only
 * carries events still in-flight or pending retry.
 */
export const interAppOutbox = pgTable('inter_app_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: text('event_id').notNull(),
  eventType: text('event_type').notNull(),
  targetApplication: text('target_application').notNull(),
  payload: jsonb('payload').notNull(),
  messageAttributes: jsonb('message_attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastError: text('last_error'),
}, (table) => ({
  eventIdUnique: uniqueIndex('inter_app_outbox_event_id_unique').on(table.eventId),
  // Drizzle can model the partial index by name; the actual WHERE clause is
  // enforced by the SQL migration. Listing it here keeps the schema introspection happy.
  unpublishedIdx: index('idx_inter_app_outbox_unpublished').on(table.createdAt),
}));
