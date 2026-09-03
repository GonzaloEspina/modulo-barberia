-- Admin can credit or debit a client's point balance.

CREATE OR REPLACE FUNCTION public.adjust_client_points(
  p_client_id UUID,
  p_quantity INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_cfg public.points_config%ROWTYPE;
  v_expires TIMESTAMPTZ;
  v_points INTEGER;
  v_remaining INTEGER;
  v_lot public.point_movements%ROWTYPE;
  v_take INTEGER;
  v_reason TEXT;
  v_balance INTEGER;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF p_quantity = 0 THEN
    RAISE EXCEPTION 'Indicá una cantidad distinta de cero';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = p_client_id
      AND c.organization_id = v_org_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  v_reason := nullif(trim(COALESCE(p_reason, '')), '');

  IF p_quantity > 0 THEN
    SELECT * INTO v_cfg
    FROM public.points_config
    WHERE organization_id = v_org_id;

    v_expires := CASE COALESCE(v_cfg.expiration_type, 'none')
      WHEN 'days' THEN now() + (v_cfg.expiration_value || ' days')::interval
      WHEN 'months' THEN date_trunc('month', now() + (v_cfg.expiration_value || ' months')::interval) + interval '1 month - 1 day'
      ELSE NULL
    END;

    INSERT INTO public.point_movements (
      organization_id, client_id, movement_type,
      quantity, available_quantity, expires_at, created_by, reason
    ) VALUES (
      v_org_id, p_client_id, 'manual_credit',
      p_quantity, p_quantity, v_expires, auth.uid(),
      COALESCE(v_reason, 'Ajuste manual')
    );
  ELSE
    v_points := abs(p_quantity);
    v_remaining := v_points;

    FOR v_lot IN
      SELECT *
      FROM public.point_movements pm
      WHERE pm.client_id = p_client_id
        AND pm.organization_id = v_org_id
        AND pm.available_quantity > 0
        AND (pm.expires_at IS NULL OR pm.expires_at > now())
      ORDER BY pm.expires_at NULLS LAST, pm.created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.available_quantity, v_remaining);
      UPDATE public.point_movements
      SET available_quantity = available_quantity - v_take
      WHERE id = v_lot.id;
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Saldo de puntos insuficiente';
    END IF;

    INSERT INTO public.point_movements (
      organization_id, client_id, movement_type,
      quantity, available_quantity, created_by, reason
    ) VALUES (
      v_org_id, p_client_id, 'manual_debit',
      -v_points, 0, auth.uid(),
      COALESCE(v_reason, 'Ajuste manual')
    );
  END IF;

  SELECT COALESCE(SUM(pm.available_quantity), 0)::INTEGER
  INTO v_balance
  FROM public.point_movements pm
  WHERE pm.client_id = p_client_id
    AND pm.organization_id = v_org_id
    AND pm.available_quantity > 0
    AND (pm.expires_at IS NULL OR pm.expires_at > now());

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_client_points(UUID, INTEGER, TEXT) TO authenticated;
