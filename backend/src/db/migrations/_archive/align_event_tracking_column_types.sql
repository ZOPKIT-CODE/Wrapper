-- Strict parity: align event_tracking column types to production.
-- Production uses text + timestamptz for these fields.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'event_id'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE event_tracking ALTER COLUMN event_id TYPE text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'event_type'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE event_tracking ALTER COLUMN event_type TYPE text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'tenant_id'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE event_tracking ALTER COLUMN tenant_id TYPE text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'entity_id'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE event_tracking ALTER COLUMN entity_id TYPE text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'stream_key'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE event_tracking ALTER COLUMN stream_key TYPE text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'published_by'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE event_tracking ALTER COLUMN published_by TYPE text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'status'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE event_tracking ALTER COLUMN status TYPE text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'published_at'
      AND udt_name <> 'timestamptz'
  ) THEN
    ALTER TABLE event_tracking
      ALTER COLUMN published_at TYPE timestamptz
      USING published_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'acknowledged_at'
      AND udt_name <> 'timestamptz'
  ) THEN
    ALTER TABLE event_tracking
      ALTER COLUMN acknowledged_at TYPE timestamptz
      USING acknowledged_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'last_retry_at'
      AND udt_name <> 'timestamptz'
  ) THEN
    ALTER TABLE event_tracking
      ALTER COLUMN last_retry_at TYPE timestamptz
      USING last_retry_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'created_at'
      AND udt_name <> 'timestamptz'
  ) THEN
    ALTER TABLE event_tracking
      ALTER COLUMN created_at TYPE timestamptz
      USING created_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_tracking'
      AND column_name = 'updated_at'
      AND udt_name <> 'timestamptz'
  ) THEN
    ALTER TABLE event_tracking
      ALTER COLUMN updated_at TYPE timestamptz
      USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;
