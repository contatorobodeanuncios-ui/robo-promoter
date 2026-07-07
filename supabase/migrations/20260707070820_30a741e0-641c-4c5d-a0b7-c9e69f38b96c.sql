-- access_requests: admin review
CREATE POLICY "Admins can view all access requests"
  ON public.access_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update access requests"
  ON public.access_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- admin_audit_log: admin SELECT
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- admin_notes: admin INSERT/UPDATE
CREATE POLICY "Admins can insert notes"
  ON public.admin_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update notes"
  ON public.admin_notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- app_settings: admin INSERT/UPDATE
CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- asaas_webhook_events: admin SELECT
CREATE POLICY "Admins can view webhook events"
  ON public.asaas_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- manual_balance_adjustments: admin INSERT
CREATE POLICY "Admins can insert balance adjustments"
  ON public.manual_balance_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

-- wipe_events: user INSERT of own row
CREATE POLICY "Users can insert their own wipe events"
  ON public.wipe_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- Trigger functions are invoked by the DB engine, not via API. has_role is
-- called by RLS policies internally and does not need public EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_balance_update() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_campaign_metric_update() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;