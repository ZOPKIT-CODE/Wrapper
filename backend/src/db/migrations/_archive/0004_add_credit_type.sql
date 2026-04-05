-- Add credit_type column to credit_allocations table
-- This differentiates between free credits (from plans) and paid credits (purchased separately)

ALTER TABLE credit_allocations
ADD COLUMN credit_type VARCHAR(20) DEFAULT 'free' CHECK (credit_type IN ('free', 'paid'));

-- Update allocation_type to include 'subscription' for plan-based allocations
ALTER TABLE credit_allocations
ADD CONSTRAINT check_allocation_type
CHECK (allocation_type IN ('manual', 'automatic', 'bulk', 'subscription'));

-- Add comment for clarity
COMMENT ON COLUMN credit_allocations.credit_type IS 'Type of credits: free (from plan) or paid (purchased separately)';
COMMENT ON COLUMN credit_allocations.allocation_type IS 'How credits were allocated: manual, automatic, bulk, or subscription';
