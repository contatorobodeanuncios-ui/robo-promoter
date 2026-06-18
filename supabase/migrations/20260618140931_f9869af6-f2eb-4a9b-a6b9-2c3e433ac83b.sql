
-- 1. Prevent client UPDATE of campaign metric columns
CREATE OR REPLACE FUNCTION public.prevent_campaign_metric_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' THEN
    IF NEW.spent IS DISTINCT FROM OLD.spent
       OR NEW.clicks IS DISTINCT FROM OLD.clicks
       OR NEW.impressions IS DISTINCT FROM OLD.impressions
       OR NEW.ctr IS DISTINCT FROM OLD.ctr
       OR NEW.cpc IS DISTINCT FROM OLD.cpc
       OR NEW.total_paid IS DISTINCT FROM OLD.total_paid THEN
      RAISE EXCEPTION 'campaign metric fields can only be modified by the server';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_campaign_metric_update_trg ON public.campaigns;
CREATE TRIGGER prevent_campaign_metric_update_trg
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.prevent_campaign_metric_update();

-- 2. Enforce positive amount on payment_requests
ALTER TABLE public.payment_requests
  DROP CONSTRAINT IF EXISTS payment_requests_amount_positive;
ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_amount_positive CHECK (amount >= 20 AND amount <= 100000);

-- 3. wipe_events must be inserted server-side only
DROP POLICY IF EXISTS wipe_events_insert_own ON public.wipe_events;
REVOKE INSERT ON public.wipe_events FROM authenticated;
REVOKE INSERT ON public.wipe_events FROM anon;
