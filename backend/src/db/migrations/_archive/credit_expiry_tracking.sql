-- Migration: credit_expiry_tracking
-- Makes campaign_id nullable in seasonal_credit_allocations so manual admin
-- allocations (not tied to a campaign) can also be tracked with an expiry date.

ALTER TABLE seasonal_credit_allocations
  ALTER COLUMN campaign_id DROP NOT NULL;
