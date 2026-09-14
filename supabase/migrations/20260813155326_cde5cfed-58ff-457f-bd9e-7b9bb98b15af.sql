-- 1. Plano Pro Max
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free','pro','trial_pro','credits','pro_max'));

-- 2. Fila (prioridade + FIFO) e views extras nas campanhas
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS queue_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS extra_views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_paid numeric NOT NULL DEFAULT 0;

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS queue_priority integer NOT NULL DEFAULT 0;

-- 3. Novo tipo de cobrança: turbinar alcance
ALTER TYPE public.payment_request_kind ADD VALUE IF NOT EXISTS 'campaign_boost';

-- 4. Tabela de turbinadas (views extras compradas)
CREATE TABLE IF NOT EXISTS public.campaign_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  views integer NOT NULL,
  amount numeric NOT NULL,
  media_budget numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_request_id uuid REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

GRANT SELECT, INSERT ON public.campaign_boosts TO authenticated;
GRANT ALL ON public.campaign_boosts TO service_role;
ALTER TABLE public.campaign_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boosts_select_own" ON public.campaign_boosts;
CREATE POLICY "boosts_select_own" ON public.campaign_boosts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "boosts_insert_own" ON public.campaign_boosts;
CREATE POLICY "boosts_insert_own" ON public.campaign_boosts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Links Pro Max editáveis pelo admin
INSERT INTO public.app_settings (key, value)
VALUES ('promax_links', '{"seller_school_url":"","whatsapp_url":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;