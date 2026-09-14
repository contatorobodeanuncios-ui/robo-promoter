
-- 1) Anexos no chat
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage policies para o bucket support-attachments (criado antes via tool).
DROP POLICY IF EXISTS "support attach owner upload" ON storage.objects;
CREATE POLICY "support attach owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = 'support'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "support attach owner read" ON storage.objects;
CREATE POLICY "support attach owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      ((storage.foldername(name))[1] = 'support'
        AND (storage.foldername(name))[2] = auth.uid()::text)
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "support attach admin upload" ON storage.objects;
CREATE POLICY "support attach admin upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'));

-- 2) Auditoria Meta
CREATE TABLE IF NOT EXISTS public.campaign_meta_link_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text,
  old_meta_campaign_id text,
  new_meta_campaign_id text,
  old_meta_ad_account_id text,
  new_meta_ad_account_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.campaign_meta_link_audit TO authenticated;
GRANT ALL ON public.campaign_meta_link_audit TO service_role;
ALTER TABLE public.campaign_meta_link_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_link_audit_admin_read" ON public.campaign_meta_link_audit;
CREATE POLICY "meta_link_audit_admin_read"
  ON public.campaign_meta_link_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_meta_link_audit_campaign
  ON public.campaign_meta_link_audit(campaign_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_campaign_meta_link_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changer uuid;
  changer_email text;
BEGIN
  IF NEW.meta_campaign_id IS DISTINCT FROM OLD.meta_campaign_id
     OR NEW.meta_ad_account_id IS DISTINCT FROM OLD.meta_ad_account_id THEN
    changer := auth.uid();
    IF changer IS NOT NULL THEN
      SELECT email INTO changer_email FROM auth.users WHERE id = changer;
    END IF;
    INSERT INTO public.campaign_meta_link_audit(
      campaign_id, changed_by, changed_by_email,
      old_meta_campaign_id, new_meta_campaign_id,
      old_meta_ad_account_id, new_meta_ad_account_id
    ) VALUES (
      NEW.id, changer, changer_email,
      OLD.meta_campaign_id, NEW.meta_campaign_id,
      OLD.meta_ad_account_id, NEW.meta_ad_account_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaigns_meta_link_audit_trg ON public.campaigns;
CREATE TRIGGER campaigns_meta_link_audit_trg
  AFTER UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.log_campaign_meta_link_change();

-- 3) Reviews de IA
DO $$ BEGIN
  CREATE TYPE public.campaign_ai_verdict AS ENUM ('good','warn','bad','no_data');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.campaign_ai_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  verdict public.campaign_ai_verdict NOT NULL DEFAULT 'no_data',
  summary text NOT NULL DEFAULT '',
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.campaign_ai_reviews TO authenticated;
GRANT ALL ON public.campaign_ai_reviews TO service_role;
ALTER TABLE public.campaign_ai_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_reviews_admin_read" ON public.campaign_ai_reviews;
CREATE POLICY "ai_reviews_admin_read"
  ON public.campaign_ai_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_reviews_campaign
  ON public.campaign_ai_reviews(campaign_id, created_at DESC);

-- 4) Magic links (auditoria)
CREATE TABLE IF NOT EXISTS public.admin_magic_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  target_user_id uuid NOT NULL,
  target_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_magic_link_events TO authenticated;
GRANT ALL ON public.admin_magic_link_events TO service_role;
ALTER TABLE public.admin_magic_link_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "magic_link_admin_read" ON public.admin_magic_link_events;
CREATE POLICY "magic_link_admin_read"
  ON public.admin_magic_link_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
