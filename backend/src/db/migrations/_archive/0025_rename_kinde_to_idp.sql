-- Kinde -> Cognito (IdP) migration: rename the legacy kinde_* columns to idp_*.
-- The columns already hold IdP (Cognito) subject/org values; this is a pure rename
-- (metadata-only, data-preserving). Idempotent via IF EXISTS guards so it is safe to
-- re-run. The inter-app WIRE contract (MQ keys, internal SSO HTTP fields) intentionally
-- stays kinde_* for now — ops-management is still on Kinde; that wire flip is a later,
-- ecosystem-coordinated step.

-- tenant_users.kinde_user_id -> idp_sub (+ index)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'kinde_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'idp_sub') THEN
    ALTER TABLE tenant_users RENAME COLUMN kinde_user_id TO idp_sub;
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS idx_tenant_users_kinde_user_id RENAME TO idx_tenant_users_idp_sub;
--> statement-breakpoint

-- tenants.kinde_org_id -> idp_org_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'kinde_org_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'idp_org_id') THEN
    ALTER TABLE tenants RENAME COLUMN kinde_org_id TO idp_org_id;
  END IF;
END $$;
--> statement-breakpoint

-- onboarding_form_data.kinde_user_id -> idp_sub (+ indexes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_form_data' AND column_name = 'kinde_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'onboarding_form_data' AND column_name = 'idp_sub') THEN
    ALTER TABLE onboarding_form_data RENAME COLUMN kinde_user_id TO idp_sub;
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS idx_onboarding_form_data_kinde_user_id RENAME TO idx_onboarding_form_data_idp_sub;
--> statement-breakpoint
ALTER INDEX IF EXISTS idx_onboarding_form_data_kinde_user_email RENAME TO idx_onboarding_form_data_idp_sub_email;
--> statement-breakpoint

-- custom_roles.kinde_role_id -> idp_role_id, kinde_role_key -> idp_role_key
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_roles' AND column_name = 'kinde_role_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_roles' AND column_name = 'idp_role_id') THEN
    ALTER TABLE custom_roles RENAME COLUMN kinde_role_id TO idp_role_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_roles' AND column_name = 'kinde_role_key')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_roles' AND column_name = 'idp_role_key') THEN
    ALTER TABLE custom_roles RENAME COLUMN kinde_role_key TO idp_role_key;
  END IF;
END $$;
--> statement-breakpoint

-- platform_staff.kinde_user_id -> idp_sub (+ index)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_staff' AND column_name = 'kinde_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_staff' AND column_name = 'idp_sub') THEN
    ALTER TABLE platform_staff RENAME COLUMN kinde_user_id TO idp_sub;
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS idx_platform_staff_kinde_user_id RENAME TO idx_platform_staff_idp_sub;
--> statement-breakpoint

-- platform_audit_logs.kinde_user_id -> idp_sub
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_audit_logs' AND column_name = 'kinde_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_audit_logs' AND column_name = 'idp_sub') THEN
    ALTER TABLE platform_audit_logs RENAME COLUMN kinde_user_id TO idp_sub;
  END IF;
END $$;
