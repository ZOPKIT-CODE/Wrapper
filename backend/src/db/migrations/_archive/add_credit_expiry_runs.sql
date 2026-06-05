-- Migration: create credit_expiry_runs table
-- Records every execution of processExpiredCredits() for admin cron health monitoring.

CREATE TABLE IF NOT EXISTS credit_expiry_runs (
  run_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_source    VARCHAR(50)  NOT NULL DEFAULT 'cron',
  triggered_by      UUID,
  batches_processed INTEGER      NOT NULL DEFAULT 0,
  error_count       INTEGER      NOT NULL DEFAULT 0,
  duration_ms       INTEGER,
  status            VARCHAR(20)  NOT NULL DEFAULT 'success',
  error_message     TEXT,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expiry_runs_ran_at ON credit_expiry_runs (ran_at DESC);
