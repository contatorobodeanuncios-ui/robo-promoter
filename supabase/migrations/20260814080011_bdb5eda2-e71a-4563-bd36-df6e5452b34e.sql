CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text,
  session_id text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_created ON public.user_activity_events (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.user_activity_events TO authenticated;
GRANT ALL ON public.user_activity_events TO service_role;
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own activity insert" ON public.user_activity_events;
CREATE POLICY "own activity insert" ON public.user_activity_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own activity select" ON public.user_activity_events;
CREATE POLICY "own activity select" ON public.user_activity_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));