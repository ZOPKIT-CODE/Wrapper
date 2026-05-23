-- Bug 2: CRM processed_mq_events.tenant_id was populated with the wrapper's internal
-- tenant UUID (passed as `event.tenantId` on the envelope). CRM identifies tenants by
-- kindeOrgId; the current value is meaningless for CRM joins.
--
-- Forward fix is in code (Bug 3 producer fix sends kindeOrgId on envelope going forward).
-- This migration is a one-time backfill: rewrite the existing rows to point at CRM's
-- internal tenant UUID resolved via kinde_org_id matching, where possible.
--
-- REVIEW BEFORE APPLYING. Apply against CRM database only.

BEGIN;

-- Snapshot before (audit trail). Comment out if not desired.
CREATE TABLE IF NOT EXISTS _bug2_processed_mq_events_backup AS
  SELECT * FROM processed_mq_events;

-- For every row whose tenant_id does not match a CRM tenant, try to map via the
-- wrapper_onboarding_snapshots payload (snapshot.tenant.kindeOrgId → tenants.id).
UPDATE processed_mq_events p
SET    tenant_id = t.id::text
FROM   wrapper_onboarding_snapshots w
JOIN   tenants t ON t.kinde_org_id = (w.snapshot_payload #>> '{tenantInfo,kindeOrgId}')
WHERE  p.event_id = w.mq_event_id
  AND  p.tenant_id IS DISTINCT FROM t.id::text;

-- Rows we couldn't map stay as-is (likely orphans from earlier test runs; consider
-- DELETE if state='failed' and tenant_id has no matching tenant).

COMMIT;
