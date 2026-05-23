-- FA migration: pending_user_identities
--
-- Replaces the in-process Map cache in user.handler.ts that stored email/kindeId for
-- a user whose tenant_users row didn't exist yet, so the subsequent
-- organization.assignment.created could backfill identity.
--
-- The in-process cache fails in any horizontally-scaled consumer setup: user.created
-- and org.assignment.created land in different SQS receives, potentially routed to
-- different consumer processes. A DB-backed cache makes the backfill correct under
-- concurrency and process restarts.
--
-- Expiry is enforced by an `expires_at` column + a nightly purge job (mirrors the
-- existing `purge-events.job.ts` pattern). The PK is composite to allow per-tenant
-- isolation without a secondary index.

CREATE TABLE IF NOT EXISTS pending_user_identities (
  tenant_id        text        NOT NULL,
  wrapper_user_id  text        NOT NULL,
  email            text,
  kinde_id         text,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, wrapper_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_user_identities_expires_at
  ON pending_user_identities (expires_at);

COMMENT ON TABLE pending_user_identities IS
  'Buffers user identity (email/kindeId) when user.created arrives before the user row exists. Drained by organization.assignment.created backfill. Rows expire and are purged by the nightly job.';
