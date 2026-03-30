-- Migration: Create contact_submissions table
-- Stores contact form and demo form submissions from the public landing page
-- Platform-level table (no tenant_id) - these are pre-signup inquiries

CREATE TABLE IF NOT EXISTS "contact_submissions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "company" varchar(255),
  "phone" varchar(50),
  "job_title" varchar(255),
  "company_size" varchar(50),
  "preferred_time" varchar(50),
  "comments" text,
  "source" varchar(20) NOT NULL DEFAULT 'contact',
  "ip" varchar(45),
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_contact_submissions_email" ON "contact_submissions" ("email");
CREATE INDEX IF NOT EXISTS "idx_contact_submissions_source" ON "contact_submissions" ("source");
CREATE INDEX IF NOT EXISTS "idx_contact_submissions_created_at" ON "contact_submissions" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_contact_submissions_email_source" ON "contact_submissions" ("email", "source");
