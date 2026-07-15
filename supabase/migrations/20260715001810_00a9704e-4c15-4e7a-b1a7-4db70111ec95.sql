
-- 1. payment_requests: separar campanha vs saldo
DO $$ BEGIN
  CREATE TYPE public.payment_request_kind AS ENUM ('campaign_budget','balance_topup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS type public.payment_request_kind,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Backfill: se asaas_link contém 'cmp:' assumimos campanha, senão saldo
UPDATE public.payment_requests
   SET type = CASE
     WHEN asaas_link ILIKE '%cmp:%' THEN 'campaign_budget'::public.payment_request_kind
     ELSE 'balance_topup'::public.payment_request_kind
   END
 WHERE type IS NULL;

ALTER TABLE public.payment_requests
  ALTER COLUMN type SET DEFAULT 'balance_topup'::public.payment_request_kind;

-- 2. Audit table para tentativas de PIX
CREATE TABLE IF NOT EXISTS public.pix_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id uuid REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  campaign_id uuid,
  asaas_customer_id text,
  asaas_payment_id text,
  http_status integer,
  ok boolean NOT NULL DEFAULT false,
  error_message text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pix_attempts TO authenticated;
GRANT ALL ON public.pix_attempts TO service_role;
ALTER TABLE public.pix_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read pix_attempts" ON public.pix_attempts;
CREATE POLICY "admins read pix_attempts" ON public.pix_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_pix_attempts_created ON public.pix_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pix_attempts_user ON public.pix_attempts (user_id, created_at DESC);

-- 3. campaigns: timeline real e effective status Meta
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_effective_status text;

-- 4. campaign_status enum: em_revisao
DO $$ BEGIN
  ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'em_revisao';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. support_messages: aceitar 'client' | 'user' | 'admin'
ALTER TABLE public.support_messages
  DROP CONSTRAINT IF EXISTS support_messages_sender_check;
ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_sender_check
  CHECK (sender = ANY (ARRAY['client'::text,'user'::text,'admin'::text]));

DROP POLICY IF EXISTS "users insert own messages" ON public.support_messages;
CREATE POLICY "users insert own messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender IN ('client','user')
    AND EXISTS (
      SELECT 1 FROM public.support_conversations c
       WHERE c.id = support_messages.conversation_id
         AND c.user_id = auth.uid()
    )
  );

-- Admin envia como 'admin'
DROP POLICY IF EXISTS "admins insert messages" ON public.support_messages;
CREATE POLICY "admins insert messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender = 'admin' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins view all messages" ON public.support_messages;
CREATE POLICY "admins view all messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins view all conversations" ON public.support_conversations;
CREATE POLICY "admins view all conversations" ON public.support_conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins update conversations" ON public.support_conversations;
CREATE POLICY "admins update conversations" ON public.support_conversations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "users update own conversations" ON public.support_conversations;
CREATE POLICY "users update own conversations" ON public.support_conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
