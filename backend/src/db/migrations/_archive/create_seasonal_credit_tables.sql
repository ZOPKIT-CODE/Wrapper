-- Migration: Create seasonal credit campaigns and allocations tables
-- This migration creates both tables with the target_application field included

-- Create seasonal_credit_campaigns table if it doesn't exist
CREATE TABLE IF NOT EXISTS seasonal_credit_campaigns (
  campaign_id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  
  -- Campaign Metadata
  campaign_name varchar(255) NOT NULL,
  credit_type varchar(50) NOT NULL,
  description text,
  
  -- Credit Distribution Settings
  total_credits numeric(15, 4) NOT NULL,
  credits_per_tenant numeric(15, 4),
  distribution_method varchar(50) DEFAULT 'equal',
  
  -- Targeting
  target_all_tenants boolean DEFAULT false,
  target_tenant_ids uuid[],
  target_applications jsonb DEFAULT '["crm", "hr", "affiliate", "system"]'::jsonb,
  
  -- Distribution Status
  distribution_status varchar(50) DEFAULT 'pending',
  distributed_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  
  -- Timing
  starts_at timestamp DEFAULT now(),
  expires_at timestamp NOT NULL,
  distributed_at timestamp,
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Audit
  created_by uuid REFERENCES tenant_users(user_id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  
  -- Additional Configuration
  metadata jsonb,
  send_notifications boolean DEFAULT true,
  notification_template text
);

-- Create seasonal_credit_allocations table if it doesn't exist
CREATE TABLE IF NOT EXISTS seasonal_credit_allocations (
  allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid NOT NULL REFERENCES seasonal_credit_campaigns(campaign_id),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  
  -- Organization Context (Primary Organization)
  entity_id uuid NOT NULL REFERENCES entities(entity_id),
  entity_type varchar(50) DEFAULT 'organization',
  
  -- Application Targeting
  -- NULL = allocated to primary org (all applications can use)
  -- Specific app code (e.g., 'crm', 'hr') = allocated only to that application
  target_application varchar(50),
  
  -- Credit Details
  allocated_credits numeric(15, 4) NOT NULL,
  used_credits numeric(15, 4) DEFAULT '0',
  
  -- Distribution Status
  distribution_status varchar(50) DEFAULT 'pending',
  distribution_error text,
  
  -- Status
  is_active boolean DEFAULT true,
  is_expired boolean DEFAULT false,
  
  -- Timing
  allocated_at timestamp DEFAULT now(),
  expires_at timestamp NOT NULL,
  
  -- Audit
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_seasonal_campaigns_tenant 
ON seasonal_credit_campaigns(tenant_id);

CREATE INDEX IF NOT EXISTS idx_seasonal_campaigns_status 
ON seasonal_credit_campaigns(distribution_status, is_active);

CREATE INDEX IF NOT EXISTS idx_seasonal_allocations_campaign 
ON seasonal_credit_allocations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_seasonal_allocations_tenant_entity 
ON seasonal_credit_allocations(tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_seasonal_allocations_target_app 
ON seasonal_credit_allocations(target_application) 
WHERE target_application IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seasonal_allocations_expiry 
ON seasonal_credit_allocations(expires_at, is_active, is_expired) 
WHERE is_active = true AND is_expired = false;

CREATE INDEX IF NOT EXISTS idx_seasonal_allocations_expiry_app 
ON seasonal_credit_allocations(expires_at, target_application, is_active, is_expired) 
WHERE is_active = true AND is_expired = false;

-- Add comments for documentation
COMMENT ON TABLE seasonal_credit_campaigns IS 'Stores campaign metadata for distributing free credits to tenants';
COMMENT ON TABLE seasonal_credit_allocations IS 'Tracks individual credit allocations to tenants'' primary organizations. Supports both organization-wide and application-specific allocations';

COMMENT ON COLUMN seasonal_credit_allocations.target_application IS 
'NULL = allocated to primary org (all applications can use), specific app code (e.g., crm, hr) = allocated only to that application';

















