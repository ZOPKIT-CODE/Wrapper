-- Grant app_user access to tables created by wrapper_migration_user in 0020-0022.
-- Migrations run as wrapper_migration_user; the app connects as app_user, so newly
-- created tables require explicit grants before the app can read/write them.

GRANT SELECT, INSERT, UPDATE, DELETE ON inter_app_outbox        TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON circuit_breaker_state   TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON credit_category_snapshots TO app_user;
