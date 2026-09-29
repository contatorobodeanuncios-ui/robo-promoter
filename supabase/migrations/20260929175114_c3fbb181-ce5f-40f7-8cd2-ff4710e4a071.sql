CREATE OR REPLACE FUNCTION public.admin_auth_session_ips(_user_id uuid)
RETURNS TABLE(ip text, created_at timestamptz, updated_at timestamptz, user_agent text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT host(s.ip)::text, s.created_at, s.updated_at, s.user_agent
  FROM auth.sessions s WHERE s.user_id = _user_id
  ORDER BY s.created_at DESC LIMIT 10
$$;
REVOKE ALL ON FUNCTION public.admin_auth_session_ips(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_auth_session_ips(uuid) TO service_role;