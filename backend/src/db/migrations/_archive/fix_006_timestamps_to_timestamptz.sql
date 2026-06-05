-- M006: Convert timestamp without time zone → timestamptz across all tables.
-- Pre-flight: server timezone = UTC, so existing values are already UTC.
-- The AT TIME ZONE 'UTC' USING clause is a metadata-only reinterpretation — no data shifts.
--
-- ROLLBACK (repeat per column):
--   ALTER TABLE <table> ALTER COLUMN <col> TYPE timestamp without time zone
--     USING <col> AT TIME ZONE 'UTC';

ALTER TABLE audit_logs
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE notifications
  ALTER COLUMN created_at   TYPE timestamptz USING created_at   AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at   TYPE timestamptz USING updated_at   AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at   TYPE timestamptz USING expires_at   AT TIME ZONE 'UTC',
  ALTER COLUMN scheduled_at TYPE timestamptz USING scheduled_at AT TIME ZONE 'UTC';

ALTER TABLE credits
  ALTER COLUMN last_updated_at TYPE timestamptz USING last_updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at      TYPE timestamptz USING created_at      AT TIME ZONE 'UTC';

ALTER TABLE credit_transactions
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE credit_purchases
  ALTER COLUMN expiry_date  TYPE timestamptz USING expiry_date  AT TIME ZONE 'UTC',
  ALTER COLUMN requested_at TYPE timestamptz USING requested_at AT TIME ZONE 'UTC',
  ALTER COLUMN paid_at      TYPE timestamptz USING paid_at      AT TIME ZONE 'UTC',
  ALTER COLUMN credited_at  TYPE timestamptz USING credited_at  AT TIME ZONE 'UTC',
  ALTER COLUMN created_at   TYPE timestamptz USING created_at   AT TIME ZONE 'UTC';

ALTER TABLE credit_configurations
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE credit_usage
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE tenant_invitations
  ALTER COLUMN expires_at   TYPE timestamptz USING expires_at   AT TIME ZONE 'UTC',
  ALTER COLUMN accepted_at  TYPE timestamptz USING accepted_at  AT TIME ZONE 'UTC',
  ALTER COLUMN cancelled_at TYPE timestamptz USING cancelled_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at   TYPE timestamptz USING created_at   AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at   TYPE timestamptz USING updated_at   AT TIME ZONE 'UTC';

ALTER TABLE user_sessions
  ALTER COLUMN login_at         TYPE timestamptz USING login_at         AT TIME ZONE 'UTC',
  ALTER COLUMN last_activity_at TYPE timestamptz USING last_activity_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at       TYPE timestamptz USING expires_at       AT TIME ZONE 'UTC';

ALTER TABLE responsible_persons
  ALTER COLUMN assigned_at  TYPE timestamptz USING assigned_at  AT TIME ZONE 'UTC',
  ALTER COLUMN valid_from   TYPE timestamptz USING valid_from   AT TIME ZONE 'UTC',
  ALTER COLUMN valid_until  TYPE timestamptz USING valid_until  AT TIME ZONE 'UTC',
  ALTER COLUMN confirmed_at TYPE timestamptz USING confirmed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at   TYPE timestamptz USING created_at   AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at   TYPE timestamptz USING updated_at   AT TIME ZONE 'UTC';

ALTER TABLE onboarding_events
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE onboarding_form_data
  ALTER COLUMN last_saved TYPE timestamptz USING last_saved AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE custom_roles
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE entities
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE organization_memberships
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE tenant_users
  ALTER COLUMN invited_at     TYPE timestamptz USING invited_at     AT TIME ZONE 'UTC',
  ALTER COLUMN last_active_at TYPE timestamptz USING last_active_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_login_at  TYPE timestamptz USING last_login_at  AT TIME ZONE 'UTC',
  ALTER COLUMN created_at     TYPE timestamptz USING created_at     AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at     TYPE timestamptz USING updated_at     AT TIME ZONE 'UTC';

ALTER TABLE subscriptions
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE payments
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
