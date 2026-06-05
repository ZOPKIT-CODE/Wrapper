-- Migration: Drop credit allocation tables
-- These tables are no longer needed as applications manage their own credit consumption
-- Date: 2024
-- Reason: Simplifying credit architecture - wrapper handles organization credits, applications handle their own usage

-- Drop credit_allocation_transactions table first (has foreign key to credit_allocations)
DROP TABLE IF EXISTS "credit_allocation_transactions" CASCADE;

-- Drop credit_allocations table
DROP TABLE IF EXISTS "credit_allocations" CASCADE;

-- Note: This migration removes application-specific credit allocation infrastructure
-- Applications (CRM, HR, etc.) should manage their own credit consumption tracking
-- The wrapper only maintains the core credits and credit_transactions tables

















