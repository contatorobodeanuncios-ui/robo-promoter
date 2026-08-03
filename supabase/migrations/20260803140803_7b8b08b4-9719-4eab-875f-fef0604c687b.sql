ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS service_fee numeric NOT NULL DEFAULT 0;