-- FA migration: enforce one role per (tenant, user, role) at the DB layer.
--
-- Background: wrapper_role_assignments.assignment_id is currently the only UNIQUE key.
-- That lets a re-assignment of the same role to the same user with a fresh
-- assignmentId silently create a duplicate row — the business invariant ("one
-- active assignment per user × role per tenant") is enforced only in application code.
--
-- Adds a partial UNIQUE index keyed on the triple. Partial on `is_active = true`
-- so deactivated historical rows do not block re-assignment of the same role
-- to the same user later.
--
-- Pre-check: SELECT tenant_id, user_id, role_id_string, COUNT(*) FROM
--   wrapper_role_assignments WHERE is_active GROUP BY 1,2,3 HAVING COUNT(*) > 1;
-- Must return 0 rows. Verified at migration authoring time.

CREATE UNIQUE INDEX IF NOT EXISTS uq_wrapper_role_assignments_tenant_user_role_active
  ON wrapper_role_assignments (tenant_id, user_id, role_id_string)
  WHERE is_active = true;

COMMENT ON INDEX uq_wrapper_role_assignments_tenant_user_role_active IS
  'Enforces one ACTIVE role assignment per (tenant, user, role). Partial so deactivated history stays queryable. Application-side dedup in role.handler.ts still chooses assignment_id to keep, but this index is the last line of defense.';
