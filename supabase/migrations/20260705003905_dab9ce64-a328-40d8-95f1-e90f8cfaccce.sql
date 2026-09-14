
-- meta_metrics_runs
CREATE TABLE public.meta_metrics_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  processed_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_message text,
  duration_ms integer
);
GRANT SELECT ON public.meta_metrics_runs TO authenticated;
GRANT ALL ON public.meta_metrics_runs TO service_role;
ALTER TABLE public.meta_metrics_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read meta_metrics_runs"
  ON public.meta_metrics_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- admin_notes
CREATE TABLE public.admin_notes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.admin_notes TO authenticated;
GRANT ALL ON public.admin_notes TO service_role;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read admin_notes"
  ON public.admin_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- manual_balance_adjustments
CREATE TABLE public.manual_balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  delta numeric(12,2) NOT NULL,
  reason text NOT NULL,
  balance_after numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manual_balance_adjustments TO authenticated;
GRANT ALL ON public.manual_balance_adjustments TO service_role;
ALTER TABLE public.manual_balance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read balance adjustments"
  ON public.manual_balance_adjustments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users read own balance adjustments"
  ON public.manual_balance_adjustments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_mba_user_created ON public.manual_balance_adjustments(user_id, created_at DESC);
CREATE INDEX idx_mmr_started ON public.meta_metrics_runs(started_at DESC);
