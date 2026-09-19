CREATE OR REPLACE FUNCTION public.admin_bulk_add_balance(
  _admin_id uuid,
  _admin_email text,
  _mode text,
  _amount numeric,
  _user_ids uuid[] DEFAULT NULL,
  _hours integer DEFAULT NULL
)
RETURNS TABLE(affected_count integer, unit_amount numeric, total_amount numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_total numeric := 0;
  v_cutoff timestamptz;
BEGIN
  IF _admin_id IS NULL OR NULLIF(BTRIM(_admin_email), '') IS NULL THEN
    RAISE EXCEPTION 'Administrador inválido';
  END IF;

  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  IF _mode NOT IN ('specific', 'recent_hours', 'last_day', 'all') THEN
    RAISE EXCEPTION 'Critério inválido';
  END IF;

  IF _mode = 'specific' AND COALESCE(cardinality(_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um cliente';
  END IF;

  IF _mode = 'recent_hours' AND (_hours IS NULL OR _hours < 1 OR _hours > 8760) THEN
    RAISE EXCEPTION 'Período inválido';
  END IF;

  IF _mode IN ('recent_hours', 'last_day') THEN
    v_cutoff := now() - make_interval(hours => CASE WHEN _mode = 'last_day' THEN 24 ELSE _hours END);
  END IF;

  WITH updated AS (
    UPDATE public.profiles AS p
       SET balance = ROUND((COALESCE(p.balance, 0) + _amount)::numeric, 2)
     WHERE CASE _mode
       WHEN 'specific' THEN p.id = ANY(_user_ids)
       WHEN 'recent_hours' THEN p.created_at >= v_cutoff
       WHEN 'last_day' THEN p.created_at >= v_cutoff
       WHEN 'all' THEN true
       ELSE false
     END
     RETURNING p.id
  )
  SELECT COUNT(*)::integer INTO v_count FROM updated;

  v_total := ROUND((v_count * _amount)::numeric, 2);

  INSERT INTO public.admin_audit_log (
    admin_email,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    LOWER(BTRIM(_admin_email)),
    'balance_bulk_add',
    'profiles',
    NULL,
    jsonb_build_object(
      'admin_id', _admin_id,
      'affected_count', v_count,
      'unit_amount', ROUND(_amount, 2),
      'total_amount', v_total,
      'criterion', _mode,
      'hours', CASE WHEN _mode = 'last_day' THEN 24 WHEN _mode = 'recent_hours' THEN _hours ELSE NULL END,
      'selected_user_ids', CASE WHEN _mode = 'specific' THEN to_jsonb(_user_ids) ELSE NULL END,
      'executed_at', now()
    )
  );

  RETURN QUERY SELECT v_count, ROUND(_amount, 2), v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_add_balance(uuid, text, text, numeric, uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_add_balance(uuid, text, text, numeric, uuid[], integer) TO service_role;