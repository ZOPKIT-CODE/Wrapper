-- fix_016: Drop remaining speculative columns from tenants (tax/fiscal/security)
--          and drop subscribedTools + usageLimits from subscriptions.
-- Safe to re-run (DROP COLUMN IF EXISTS).
-- Steps 1–2 (banking) and step 4 (entities) were applied in fix_014 / fix_015.
--
-- ROLLBACK: Columns were never read or written by active code — no data to restore.

-- 1. Tenants — drop additional speculative tax/fiscal/security columns
ALTER TABLE tenants
  DROP COLUMN IF EXISTS tax_id,
  DROP COLUMN IF EXISTS tax_id_type,
  DROP COLUMN IF EXISTS vat_number,
  DROP COLUMN IF EXISTS gst_number,
  DROP COLUMN IF EXISTS pan_number,
  DROP COLUMN IF EXISTS company_registration_number,
  DROP COLUMN IF EXISTS fiscal_year_start,
  DROP COLUMN IF EXISTS fiscal_year_end,
  DROP COLUMN IF EXISTS tax_regime,
  DROP COLUMN IF EXISTS is_tax_exempt,
  DROP COLUMN IF EXISTS tax_exemption_reason,
  DROP COLUMN IF EXISTS invoice_prefix,
  DROP COLUMN IF EXISTS invoice_sequence,
  DROP COLUMN IF EXISTS payment_due_days,
  DROP COLUMN IF EXISTS late_payment_penalty,
  DROP COLUMN IF EXISTS enable_two_factor,
  DROP COLUMN IF EXISTS allowed_ip_ranges;

-- 2. Subscriptions — drop speculative feature-flag columns
ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS subscribed_tools,
  DROP COLUMN IF EXISTS usage_limits;
