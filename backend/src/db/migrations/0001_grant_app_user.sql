-- Grant the app runtime role (app_user) access to the tables the migration role creates.
-- The schema baseline (0000_baseline.sql) is produced via `pg_dump --no-privileges`, which
-- intentionally drops grants — so these custom app_user grants are re-applied here, on top of
-- the schema baseline. Assumes the `app_user` role already exists (created by infra in real
-- environments, and by the integration global-setup for tests).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inter_app_outbox          TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circuit_breaker_state     TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_category_snapshots TO app_user;
