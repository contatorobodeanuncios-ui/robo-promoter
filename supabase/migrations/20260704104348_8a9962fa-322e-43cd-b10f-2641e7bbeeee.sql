
-- ============ ENUM campaign_status: novos valores ============
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'aguardando_vinculo_meta';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'rodando';
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'encerrada_saldo_consumido';

-- ============ CAMPAIGNS: novos campos ============
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS funding_type text NOT NULL DEFAULT 'wallet'
    CHECK (funding_type IN ('wallet','pix_dedicated')),
  ADD COLUMN IF NOT EXISTS pix_total_budget numeric(12,2),
  ADD COLUMN IF NOT EXISTS pix_remaining_budget numeric(12,2),
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text,
  ADD COLUMN IF NOT EXISTS meta_campaign_id text,
  ADD COLUMN IF NOT EXISTS meta_pixel_id text,
  ADD COLUMN IF NOT EXISTS metrics_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS metrics_last_error text;

-- ============ PROFILES: aprovação, telefone, prefs, LGPD ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','banned')),
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT
    '{"daily":true,"alerts":true,"aiAuto":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ============ ASAAS WEBHOOK EVENTS (idempotência) ============
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payment_id text,
  external_reference text,
  raw_payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.asaas_webhook_events TO service_role;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============ ACCESS REQUESTS ============
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own access request"
  ON public.access_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users create own access request"
  ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PUSH SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own push subs"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_push_subs_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SUPPORT CHAT ============
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','respondido','fechado')),
  last_message_at timestamptz,
  unread_by_admin boolean NOT NULL DEFAULT true,
  unread_by_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own conversations"
  ON public.support_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users create own conversations"
  ON public.support_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_support_conv_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('client','admin')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own conversation messages"
  ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "users insert own messages"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender = 'client' AND EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE INDEX IF NOT EXISTS idx_support_messages_conv
  ON public.support_messages(conversation_id, created_at);

-- ============ ADMIN AUDIT LOG ============
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log(target_type, target_id);
