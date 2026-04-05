-- Add Financial Accounting required fields to entities table.
-- Run this as the table owner (e.g. in Supabase: SQL Editor, or with postgres/service_role URL).
-- Idempotent: each column is added only if it does not exist.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'legal_name') THEN
    ALTER TABLE public.entities ADD COLUMN legal_name varchar(255);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'country') THEN
    ALTER TABLE public.entities ADD COLUMN country varchar(3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'fiscal_year_end') THEN
    ALTER TABLE public.entities ADD COLUMN fiscal_year_end varchar(10) DEFAULT '12-31';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'tax_id') THEN
    ALTER TABLE public.entities ADD COLUMN tax_id varchar(50);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'registration_number') THEN
    ALTER TABLE public.entities ADD COLUMN registration_number varchar(100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'contact_website') THEN
    ALTER TABLE public.entities ADD COLUMN contact_website varchar(500);
  END IF;
END $$;
