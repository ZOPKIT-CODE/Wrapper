-- fix_015: Drop speculative tax/compliance/fiscal columns from tenants
--          and dead/duplicate fields from entities.
-- Safe to re-run (DROP COLUMN IF EXISTS).
--
-- ROLLBACK: Columns were never read or written by active code — no data to restore.

BEGIN;

-- 1. Tenants — drop 17 speculative tax/compliance/insurance columns
ALTER TABLE tenants
  DROP COLUMN IF EXISTS tax_residence_country,
  DROP COLUMN IF EXISTS tax_exempt_status,
  DROP COLUMN IF EXISTS tax_exemption_certificate_number,
  DROP COLUMN IF EXISTS tax_exemption_expiry_date,
  DROP COLUMN IF EXISTS withholding_tax_applicable,
  DROP COLUMN IF EXISTS withholding_tax_rate,
  DROP COLUMN IF EXISTS tax_treaty_country,
  DROP COLUMN IF EXISTS w9_status_us,
  DROP COLUMN IF EXISTS w8_form_type_us,
  DROP COLUMN IF EXISTS reverse_charge_mechanism,
  DROP COLUMN IF EXISTS vat_gst_rate_applicable,
  DROP COLUMN IF EXISTS regulatory_compliance_status,
  DROP COLUMN IF EXISTS industry_specific_licenses,
  DROP COLUMN IF EXISTS data_protection_registration,
  DROP COLUMN IF EXISTS professional_indemnity_insurance,
  DROP COLUMN IF EXISTS insurance_policy_number,
  DROP COLUMN IF EXISTS insurance_expiry_date;

-- 2. Entities — drop 5 dead/duplicate fields
ALTER TABLE entities
  DROP COLUMN IF EXISTS coordinates,
  DROP COLUMN IF EXISTS business_hours,
  DROP COLUMN IF EXISTS capacity,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS primary_color;

COMMIT;
