
CREATE TABLE public.access_link_slugs (
  slug text PRIMARY KEY,
  target_url text NOT NULL,
  target_user_id uuid,
  created_by_email text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.access_link_slugs TO authenticated;
GRANT ALL ON public.access_link_slugs TO service_role;
ALTER TABLE public.access_link_slugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage access link slugs" ON public.access_link_slugs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
