-- Consolidate the standalone `layouts` CRM module into `system` config.
-- Layouts is one slice of system configuration (record-view layout admin);
-- having it as its own module created a redundant sidebar entry and a
-- one-off permission scope. New permission codes:
--   crm.layouts.read   -> crm.system.layouts_read
--   crm.layouts.manage -> crm.system.layouts_manage
--
-- This migration handles the wrapper-side surface area:
--   1. application_modules: append layouts_read/manage to system.permissions,
--      then DELETE the layouts row.
--   2. credit_configurations: add the two new global ops, delete the two old.
--   3. custom_roles: rewrite permissions->'crm' to move layouts entries into
--      the system bucket (only matters for tenants whose roles enumerated the
--      old codes; safe no-op otherwise).
--
-- Source-of-truth update lives in data/permission-matrix.ts.

-- 1. Splice layouts_read + layouts_manage into the system module's permissions
WITH new_perms AS (
  SELECT '[
    {"code":"layouts_read","name":"View Layouts","description":"View record-view layout definitions"},
    {"code":"layouts_manage","name":"Manage Layouts","description":"Create, edit, and assign record-view layouts (admin only)"}
  ]'::jsonb AS extra
)
UPDATE application_modules am
SET permissions = to_jsonb(
  ( ((am.permissions::jsonb #>> '{}')::jsonb || (SELECT extra FROM new_perms))::text )
)
FROM applications a
WHERE am.app_id = a.app_id
  AND a.app_code = 'crm'
  AND am.module_code = 'system'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements((am.permissions::jsonb #>> '{}')::jsonb) p
    WHERE p->>'code' = 'layouts_read'
  );

-- 2. Drop the standalone layouts module
DELETE FROM application_modules am
USING applications a
WHERE am.app_id = a.app_id AND a.app_code = 'crm' AND am.module_code = 'layouts';

-- 3. Add the two new global credit_configurations rows (idempotent)
INSERT INTO credit_configurations (operation_code, operation_name, category, credit_cost, is_global, is_active, tenant_id, created_by, scope, priority)
VALUES
  ('crm.system.layouts_read',   'View Layouts',  'crm', 1, true, true, NULL, '94649ce9-9725-43c5-85e6-9d5f66d72d62'::uuid, 'global', 100),
  ('crm.system.layouts_manage', 'Manage Layouts','crm', 3, true, true, NULL, '94649ce9-9725-43c5-85e6-9d5f66d72d62'::uuid, 'global', 100)
ON CONFLICT (tenant_id, operation_code) DO NOTHING;

-- 4. Drop the obsolete global credit_configurations rows
DELETE FROM credit_configurations
WHERE operation_code IN ('crm.layouts.read','crm.layouts.manage') AND is_global = true;

-- 5. Rewrite custom_roles.permissions: move permissions->'crm'->'layouts' contents
--    into permissions->'crm'->'system' as layouts_read / layouts_manage entries.
--    Only updates rows that actually held the old keys; no-op for free-tier roles
--    that never had layouts/system perms.
WITH targets AS (
  SELECT role_id, tenant_id, permissions::jsonb AS perms
  FROM custom_roles
  WHERE permissions::jsonb -> 'crm' ? 'layouts'
)
UPDATE custom_roles cr
SET permissions = (
      -- Drop the old layouts key
      ((t.perms - 'crm') ||
       jsonb_build_object(
         'crm',
         ((t.perms->'crm') - 'layouts') ||
         jsonb_build_object(
           'system',
           COALESCE(t.perms->'crm'->'system', '[]'::jsonb) ||
             CASE
               WHEN (t.perms->'crm'->'layouts')::jsonb @> '["read"]'::jsonb
                    AND NOT (COALESCE(t.perms->'crm'->'system', '[]'::jsonb) @> '["layouts_read"]'::jsonb)
                 THEN '["layouts_read"]'::jsonb
               ELSE '[]'::jsonb
             END ||
             CASE
               WHEN (t.perms->'crm'->'layouts')::jsonb @> '["manage"]'::jsonb
                    AND NOT (COALESCE(t.perms->'crm'->'system', '[]'::jsonb) @> '["layouts_manage"]'::jsonb)
                 THEN '["layouts_manage"]'::jsonb
               ELSE '[]'::jsonb
             END
         )
       ))
    ),
    updated_at = now()
FROM targets t
WHERE cr.role_id = t.role_id AND cr.tenant_id = t.tenant_id;
