CREATE TABLE public.payment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id uuid NOT NULL UNIQUE REFERENCES public.payment_requests(id),
  user_id uuid NOT NULL,
  account_email text,
  ip text, user_agent text, session_id text, city text, country text,
  terms_accepted boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamptz, terms_ip text, terms_version text,
  balance_before numeric, balance_after numeric, bonus numeric,
  status_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_evidence TO service_role;
ALTER TABLE public.payment_evidence ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payment_evidence_touch BEFORE UPDATE ON public.payment_evidence FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX ON public.payment_evidence(user_id);

CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip text, user_agent text, city text, country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.login_events(user_id, created_at DESC);

CREATE TABLE public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  version text NOT NULL,
  context text,
  payment_request_id uuid,
  ip text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.terms_acceptances TO service_role;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.terms_acceptances(user_id, created_at DESC);

ALTER TABLE public.user_activity_events
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text;