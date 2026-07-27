ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_media_type_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_media_type_check CHECK (media_type IN ('image','video','carousel'));