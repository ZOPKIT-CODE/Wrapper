-- fix_013: India-first column defaults, stripe_customer_id index, drop low-value indexes.
--
-- ROLLBACK:
--   ALTER TABLE tenants ALTER COLUMN default_locale SET DEFAULT 'en-US';
--   ALTER TABLE tenants ALTER COLUMN default_currency SET DEFAULT 'USD';
--   ALTER TABLE tenants ALTER COLUMN default_timezone SET DEFAULT 'UTC';
--   ALTER TABLE organization_memberships ALTER COLUMN timezone SET DEFAULT 'UTC';
--   ALTER TABLE entities ALTER COLUMN timezone SET DEFAULT 'UTC';
--   ALTER TABLE entities ALTER COLUMN currency SET DEFAULT 'USD';
--   DROP INDEX IF EXISTS idx_tenants_stripe_customer_id;
--   (Low-value indexes were already gone — nothing to restore.)

-- 1. Fix column defaults to India-first
ALTER TABLE tenants ALTER COLUMN default_locale   SET DEFAULT 'en-IN';
ALTER TABLE tenants ALTER COLUMN default_currency SET DEFAULT 'INR';
ALTER TABLE tenants ALTER COLUMN default_timezone SET DEFAULT 'Asia/Kolkata';

ALTER TABLE organization_memberships ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';

ALTER TABLE entities ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';
ALTER TABLE entities ALTER COLUMN currency SET DEFAULT 'INR';

-- 2. Add missing stripe_customer_id index (critical for webhook lookups)
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id
  ON tenants(stripe_customer_id);

-- 3. Drop low-value indexes replaced by the above
DROP INDEX IF EXISTS idx_tenants_tax_registered;
DROP INDEX IF EXISTS idx_tenants_vat_gst_registered;
DROP INDEX IF EXISTS idx_tenants_organization_size;
DROP INDEX IF EXISTS idx_tenants_billing_email;
DROP INDEX IF EXISTS idx_tenants_support_email;
DROP INDEX IF EXISTS idx_tenants_bank_name;
DROP INDEX IF EXISTS idx_tenants_tax_exempt_status;
DROP INDEX IF EXISTS idx_tenants_tax_residence_country;
DROP INDEX IF EXISTS idx_tenants_regulatory_compliance_status;
