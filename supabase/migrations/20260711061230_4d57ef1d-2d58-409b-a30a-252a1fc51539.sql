
-- Admin SELECT/UPDATE on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin SELECT on wipe_events
DROP POLICY IF EXISTS "Admins can view all wipe events" ON public.wipe_events;
CREATE POLICY "Admins can view all wipe events"
  ON public.wipe_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
