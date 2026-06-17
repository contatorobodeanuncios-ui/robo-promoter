
CREATE TABLE public.wipe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  user_name text,
  campaigns_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wipe_events TO authenticated;
GRANT ALL ON public.wipe_events TO service_role;

ALTER TABLE public.wipe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wipe_events_insert_own" ON public.wipe_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wipe_events_select_own" ON public.wipe_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX wipe_events_user_id_idx ON public.wipe_events(user_id);
CREATE INDEX wipe_events_created_at_idx ON public.wipe_events(created_at DESC);
