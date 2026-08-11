ALTER TABLE public.profiles ALTER COLUMN plan SET DEFAULT 'credits';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS credits_total integer;