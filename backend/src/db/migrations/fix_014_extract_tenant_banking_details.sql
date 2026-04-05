-- fix_014: Extract banking details from tenants → tenant_banking_details.
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING guards).
--
-- ROLLBACK:
--   ALTER TABLE tenants ADD COLUMN bank_name VARCHAR(255), ADD COLUMN bank_branch VARCHAR(255), ...
--   INSERT INTO tenants (...) SELECT ... FROM tenant_banking_details ON CONFLICT DO NOTHING;
--   DROP TABLE IF EXISTS tenant_banking_details;

-- 1. Create the new table
CREATE TABLE IF NOT EXISTS tenant_banking_details (
  banking_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  bank_name                 VARCHAR(255),
  bank_branch               VARCHAR(255),
  account_holder_name       VARCHAR(255),
  account_number            VARCHAR(50),
  account_type              VARCHAR(50),
  bank_account_currency     VARCHAR(3),

  swift_bic_code            VARCHAR(11),
  iban                      VARCHAR(34),
  routing_number_us         VARCHAR(9),
  sort_code_uk              VARCHAR(6),
  ifsc_code_india           VARCHAR(11),
  bsb_number_australia      VARCHAR(6),

  payment_terms             VARCHAR(50),
  preferred_payment_method  VARCHAR(50),
  credit_limit              DECIMAL(15, 2),

  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_banking_tenant_id
  ON tenant_banking_details(tenant_id);

-- 2. Migrate existing banking data from tenants (only rows with at least one field set)
INSERT INTO tenant_banking_details (
  tenant_id, bank_name, bank_branch, account_holder_name, account_number,
  account_type, bank_account_currency, swift_bic_code, iban,
  routing_number_us, sort_code_uk, ifsc_code_india, bsb_number_australia,
  payment_terms, preferred_payment_method, credit_limit
)
SELECT
  tenant_id, bank_name, bank_branch, account_holder_name, account_number,
  account_type, bank_account_currency, swift_bic_code, iban,
  routing_number_us, sort_code_uk, ifsc_code_india, bsb_number_australia,
  payment_terms, preferred_payment_method, credit_limit
FROM tenants
WHERE (
  bank_name IS NOT NULL OR account_number IS NOT NULL OR
  swift_bic_code IS NOT NULL OR ifsc_code_india IS NOT NULL OR
  iban IS NOT NULL OR routing_number_us IS NOT NULL
)
ON CONFLICT (tenant_id) DO NOTHING;

-- 3. Drop banking columns from tenants
ALTER TABLE tenants
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_branch,
  DROP COLUMN IF EXISTS account_holder_name,
  DROP COLUMN IF EXISTS account_number,
  DROP COLUMN IF EXISTS account_type,
  DROP COLUMN IF EXISTS bank_account_currency,
  DROP COLUMN IF EXISTS swift_bic_code,
  DROP COLUMN IF EXISTS iban,
  DROP COLUMN IF EXISTS routing_number_us,
  DROP COLUMN IF EXISTS sort_code_uk,
  DROP COLUMN IF EXISTS ifsc_code_india,
  DROP COLUMN IF EXISTS bsb_number_australia,
  DROP COLUMN IF EXISTS payment_terms,
  DROP COLUMN IF EXISTS credit_limit,
  DROP COLUMN IF EXISTS preferred_payment_method;
