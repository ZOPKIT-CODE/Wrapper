-- Drop the log_credit_config_change trigger and function
-- The trigger inserts into change_log, which was dropped in drop_unused_tables.sql.
-- Without change_log, the trigger causes 500 errors when creating/updating operation costs.
--
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f src/db/migrations/drop_log_credit_config_change_trigger.sql

BEGIN;

-- Drop the trigger (must be dropped before the function)
DROP TRIGGER IF EXISTS credit_config_changes_trigger ON credit_configurations;

-- Drop the function
DROP FUNCTION IF EXISTS log_credit_config_change();

COMMIT;
