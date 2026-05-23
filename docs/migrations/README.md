# Bug-fix Migrations (draft)

These SQL files were generated as part of the onboarding-pipeline bug sweep. They are
**drafts** — none are applied. Review each before running.

| Bug | File | Target DB |
|---|---|---|
| 2 | `bug2_crm_processed_mq_events_tenant_id.sql` | CRM |
| 7 (processed_mq_events shape) | `bug7_schema_drift_processed_mq_events.sql` | FA |
| 7 (wrapper_* projection tables) | `bug7_schema_drift_wrapper_projection_tables.sql` | FA (and audit CRM) |

## Why these need review
- Column type changes (`text → uuid`) fail if any row has a non-uuid value.
- Renames (`role_id_string → role_id`) break any code referencing the old name —
  cut over app code first.
- The PK swap in `bug7_schema_drift_processed_mq_events.sql` will fail if
  duplicate `event_id` rows exist; de-dup first.

## Decision NOT to attempt automatic tenant_id unification (Bug 1)
Each app owning its own tenant UUID with `kinde_org_id` as the cross-app key is the
intended design. The pipeline bug was that producers emitted the wrapper's internal
UUID on the event envelope (`event.tenantId`), which downstream consumers interpreted
as kindeOrgId. Fixed in code: see `publishRoleEventToApplications` in
`backend/src/features/roles/routes/roles.ts` — looks up `kindeOrgId` once and uses it
for the envelope. Other producers (`publishRoleEventToSuite`, tenant-management,
invitation-service paths) should be audited for the same pattern.
