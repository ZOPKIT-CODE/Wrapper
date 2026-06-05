-- Drop unused columns from organization_memberships
ALTER TABLE "organization_memberships"
  DROP COLUMN IF EXISTS "role_name",
  DROP COLUMN IF EXISTS "permissions",
  DROP COLUMN IF EXISTS "job_title",
  DROP COLUMN IF EXISTS "department",
  DROP COLUMN IF EXISTS "team",
  DROP COLUMN IF EXISTS "employee_id",
  DROP COLUMN IF EXISTS "last_accessed_at";

-- Drop unique constraint on entity_code before dropping the column
ALTER TABLE "entities" DROP CONSTRAINT IF EXISTS "entities_entity_code_unique";

-- Drop unused columns from entities
ALTER TABLE "entities"
  DROP COLUMN IF EXISTS "entity_code",
  DROP COLUMN IF EXISTS "organization_type",
  DROP COLUMN IF EXISTS "branding_config",
  DROP COLUMN IF EXISTS "credit_allocation",
  DROP COLUMN IF EXISTS "credit_policy",
  DROP COLUMN IF EXISTS "inherit_settings",
  DROP COLUMN IF EXISTS "inherit_branding",
  DROP COLUMN IF EXISTS "is_default",
  DROP COLUMN IF EXISTS "is_headquarters",
  DROP COLUMN IF EXISTS "onboarding_completed",
  DROP COLUMN IF EXISTS "onboarded_at";
