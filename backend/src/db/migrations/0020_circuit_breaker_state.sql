-- Circuit breaker state persistence for the SNS publisher.
-- Allows state to survive pod restarts and be shared across pods.
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  name             TEXT PRIMARY KEY,
  state            TEXT    NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half-open')),
  failures         INTEGER NOT NULL DEFAULT 0,
  last_failure_time BIGINT  NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
