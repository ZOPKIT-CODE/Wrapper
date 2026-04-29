import { pgTable, uuid, timestamp, integer, varchar, text, index } from 'drizzle-orm/pg-core';

/**
 * Credit Expiry Cron Runs
 * Records every execution of processExpiredCredits() — both scheduled and manual.
 * Used by the admin dashboard Cron Status panel.
 * Rows older than 30 days are pruned at query time (no separate cleanup job needed).
 */
export const creditExpiryRuns = pgTable('credit_expiry_runs', {
  runId:             uuid('run_id').primaryKey().defaultRandom(),
  ranAt:             timestamp('ran_at', { withTimezone: true }).defaultNow().notNull(),
  // 'cron' | 'manual_admin' | 'api_trigger'
  triggerSource:     varchar('trigger_source', { length: 50 }).default('cron').notNull(),
  // userId if triggered manually; null for scheduled cron
  triggeredBy:       uuid('triggered_by'),
  batchesProcessed:  integer('batches_processed').default(0).notNull(),
  errorCount:        integer('error_count').default(0).notNull(),
  durationMs:        integer('duration_ms'),
  // 'success' | 'partial' | 'error'
  status:            varchar('status', { length: 20 }).default('success').notNull(),
  errorMessage:      text('error_message'),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxExpiryRunsRanAt: index('idx_expiry_runs_ran_at').on(table.ranAt),
}));
