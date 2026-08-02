ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_archived_reason_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_archived_reason_check
  CHECK (archived_reason IS NULL OR archived_reason IN ('deleted','awaiting_payment'));

CREATE INDEX IF NOT EXISTS campaigns_archived_at_idx ON public.campaigns (archived_at);