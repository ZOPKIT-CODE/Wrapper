-- Add contact_email and contact_phone to entities if missing
-- Root cause: onboarding was inserting contactEmail but schema/DB lacked the column, so data was dropped or insert failed

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'contact_email') THEN
    ALTER TABLE public.entities ADD COLUMN contact_email varchar(255);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'contact_phone') THEN
    ALTER TABLE public.entities ADD COLUMN contact_phone varchar(50);
  END IF;
END $$;
