
-- 1) Campos novos em campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_running_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS reach integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS results integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpm numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_result numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_url text;

-- 2) Trigger de bloqueio de métricas: permitir novos campos como métricas do servidor
CREATE OR REPLACE FUNCTION public.prevent_campaign_metric_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) <> 'service_role' THEN
    IF NEW.spent IS DISTINCT FROM OLD.spent
       OR NEW.clicks IS DISTINCT FROM OLD.clicks
       OR NEW.impressions IS DISTINCT FROM OLD.impressions
       OR NEW.ctr IS DISTINCT FROM OLD.ctr
       OR NEW.cpc IS DISTINCT FROM OLD.cpc
       OR NEW.total_paid IS DISTINCT FROM OLD.total_paid
       OR NEW.reach IS DISTINCT FROM OLD.reach
       OR NEW.results IS DISTINCT FROM OLD.results
       OR NEW.revenue IS DISTINCT FROM OLD.revenue
       OR NEW.frequency IS DISTINCT FROM OLD.frequency
       OR NEW.cpm IS DISTINCT FROM OLD.cpm
       OR NEW.cost_per_result IS DISTINCT FROM OLD.cost_per_result
       OR NEW.pix_remaining_budget IS DISTINCT FROM OLD.pix_remaining_budget
       OR NEW.started_running_at IS DISTINCT FROM OLD.started_running_at
       OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
       OR NEW.paused_at IS DISTINCT FROM OLD.paused_at THEN
      RAISE EXCEPTION 'campaign metric fields can only be modified by the server';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3) Habilita realtime no chat de suporte
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_conversations REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- 4) Auto-pausa: campanhas PIX com saldo dedicado consumido
CREATE OR REPLACE FUNCTION public.auto_pause_pix_campaigns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer;
BEGIN
  WITH updated AS (
    UPDATE public.campaigns
       SET status = 'encerrada_saldo_consumido',
           ended_at = COALESCE(ended_at, now())
     WHERE funding_type = 'pix_dedicated'
       AND pix_total_budget IS NOT NULL
       AND pix_total_budget > 0
       AND spent >= pix_total_budget
       AND status NOT IN ('encerrada_saldo_consumido','paused')
     RETURNING 1
  )
  SELECT count(*) INTO n FROM updated;
  RETURN COALESCE(n,0);
END;
$$;

-- 5) Cria access_request automaticamente ao criar novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user_access_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.access_requests (user_id, email, display_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    'pending'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created_access_request ON auth.users;
CREATE TRIGGER trg_on_auth_user_created_access_request
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_access_request();

-- Backfill: usuários existentes sem access_request
INSERT INTO public.access_requests (user_id, email, display_name, status)
SELECT u.id, u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
       'approved'
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.access_requests r WHERE r.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- 6) Agenda auto-pause a cada 5 minutos
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  PERFORM cron.unschedule('auto-pause-pix-campaigns');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'auto-pause-pix-campaigns',
  '*/5 * * * *',
  $$SELECT public.auto_pause_pix_campaigns();$$
);
