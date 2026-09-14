
ALTER TABLE public.profiles ALTER COLUMN balance SET DEFAULT 0;
ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles SET balance = 0;
ALTER TABLE public.profiles ENABLE TRIGGER USER;

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE public.payment_request_status AS ENUM ('pending','approved','rejected','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status public.payment_request_status NOT NULL DEFAULT 'pending',
  asaas_link text,
  asaas_payment_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pr_select_own ON public.payment_requests;
CREATE POLICY pr_select_own ON public.payment_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS pr_insert_own ON public.payment_requests;
CREATE POLICY pr_insert_own ON public.payment_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS pr_update_admin ON public.payment_requests;
CREATE POLICY pr_update_admin ON public.payment_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS payment_requests_touch ON public.payment_requests;
CREATE TRIGGER payment_requests_touch BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT ALL ON public.app_settings TO service_role;

INSERT INTO public.app_settings (key, value) VALUES
  ('campaign_mode', '{"mode":"manual"}'::jsonb),
  ('payment_confirm_mode', '{"mode":"manual"}'::jsonb),
  ('asaas_config', '{"link_template":"","api_key_set":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
