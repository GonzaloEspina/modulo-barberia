-- Núcleo operativo: reprogramar turnos, portal OTP/sesión, canje de premios FEFO

-- ---------------------------------------------------------------------------
-- Reprogramar turno (drag en calendario)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id UUID,
  p_new_starts_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_org_tz TEXT;
  v_date DATE;
  v_service_ids UUID[];
  v_slot_available BOOLEAN;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND organization_id = private.user_organization_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede reprogramar un turno cancelado';
  END IF;

  IF NOT private.is_admin() AND v_appt.barber_id <> private.user_barber_id() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF v_appt.is_overbooking THEN
    UPDATE public.appointments
    SET
      starts_at = p_new_starts_at,
      ends_at = p_new_starts_at + (v_appt.total_duration_minutes || ' minutes')::interval,
      updated_at = now()
    WHERE id = p_appointment_id;
    RETURN;
  END IF;

  SELECT timezone INTO v_org_tz FROM public.organizations WHERE id = v_appt.organization_id;
  v_date := (p_new_starts_at AT TIME ZONE v_org_tz)::date;

  SELECT array_agg(service_id ORDER BY sort_order)
  INTO v_service_ids
  FROM public.appointment_services
  WHERE appointment_id = p_appointment_id;

  IF v_service_ids IS NULL OR array_length(v_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'El turno no tiene servicios';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM private.get_available_slots(
      v_appt.organization_id, v_date, v_service_ids, v_appt.barber_id, NULL
    ) s
    WHERE s.slot_start = p_new_starts_at
  ) INTO v_slot_available;

  IF NOT v_slot_available THEN
  -- El slot puede estar ocupado por el mismo turno; validar solapamiento real
    IF EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.barber_id = v_appt.barber_id
        AND a.id <> p_appointment_id
        AND a.is_overbooking = false
        AND a.status NOT IN ('cancelled')
        AND a.starts_at < p_new_starts_at + (v_appt.total_duration_minutes || ' minutes')::interval
        AND a.ends_at > p_new_starts_at
    ) THEN
      RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_appt.barber_id::text || v_date::text));

  UPDATE public.appointments
  SET
    starts_at = p_new_starts_at,
    ends_at = p_new_starts_at + (v_appt.total_duration_minutes || ' minutes')::interval,
    attendance_status = 'rescheduled',
    updated_at = now()
  WHERE id = p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment(UUID, TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------------------
-- Portal cliente: verificar OTP y sesión
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_client_otp(
  p_phone TEXT,
  p_code TEXT,
  p_organization_id UUID
)
RETURNS TABLE (
  session_token TEXT,
  client_id UUID,
  client_name TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_client public.clients%ROWTYPE;
  v_otp public.client_portal_otp%ROWTYPE;
  v_token TEXT;
  v_token_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_phone := public.normalize_phone_ar(p_phone);
  IF v_phone = '' OR length(trim(p_code)) <> 6 THEN
    RAISE EXCEPTION 'Teléfono o código inválido';
  END IF;

  SELECT * INTO v_client
  FROM public.clients c
  WHERE c.organization_id = p_organization_id
    AND c.phone_normalized = v_phone
    AND c.deleted_at IS NULL
    AND c.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código incorrecto o expirado';
  END IF;

  SELECT * INTO v_otp
  FROM public.client_portal_otp o
  WHERE o.organization_id = p_organization_id
    AND o.phone_normalized = v_phone
    AND o.expires_at > now()
  ORDER BY o.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código incorrecto o expirado';
  END IF;

  IF v_otp.attempts >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos. Pedí un código nuevo al local.';
  END IF;

  IF v_otp.code_hash <> crypt(p_code, v_otp.code_hash) THEN
    UPDATE public.client_portal_otp SET attempts = attempts + 1 WHERE id = v_otp.id;
    RAISE EXCEPTION 'Código incorrecto o expirado';
  END IF;

  DELETE FROM public.client_portal_otp WHERE id = v_otp.id;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := crypt(v_token, gen_salt('bf'));
  v_expires := now() + interval '2 hours';

  INSERT INTO public.client_portal_sessions (organization_id, client_id, token_hash, expires_at)
  VALUES (p_organization_id, v_client.id, v_token_hash, v_expires);

  session_token := v_token;
  client_id := v_client.id;
  client_name := v_client.first_name || ' ' || v_client.last_name;
  expires_at := v_expires;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.portal_client_from_token(p_token TEXT)
RETURNS TABLE (client_id UUID, organization_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sess public.client_portal_sessions%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 20 THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  SELECT * INTO v_sess
  FROM public.client_portal_sessions s
  WHERE s.expires_at > now()
    AND s.token_hash = crypt(p_token, s.token_hash)
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión expirada. Volvé a ingresar.';
  END IF;

  client_id := v_sess.client_id;
  organization_id := v_sess.organization_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_dashboard(p_session_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_org_id UUID;
  v_result JSONB;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object(
        'id', c.id,
        'first_name', c.first_name,
        'last_name', c.last_name,
        'phone_display', c.phone_display
      )
      FROM public.clients c WHERE c.id = v_client_id
    ),
    'appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'status', a.status,
        'barber_name', b.name,
        'total_amount', a.total_amount
      ) ORDER BY a.starts_at DESC)
      FROM public.appointments a
      JOIN public.barbers b ON b.id = a.barber_id
      WHERE a.client_id = v_client_id
        AND a.organization_id = v_org_id
        AND a.starts_at >= now() - interval '30 days'
        AND a.status <> 'cancelled'
    ), '[]'::jsonb),
    'memberships', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'plan_name', m.plan_name,
        'appointments_remaining', m.appointments_remaining,
        'appointments_total', m.appointments_total,
        'expires_at', m.expires_at,
        'status', m.status
      ) ORDER BY m.expires_at)
      FROM public.client_memberships m
      WHERE m.client_id = v_client_id
        AND m.organization_id = v_org_id
        AND m.deleted_at IS NULL
        AND m.status IN ('active', 'pending_payment')
    ), '[]'::jsonb),
    'point_balance', COALESCE((
      SELECT SUM(pm.available_quantity)
      FROM public.point_movements pm
      WHERE pm.client_id = v_client_id
        AND pm.organization_id = v_org_id
        AND pm.available_quantity > 0
        AND (pm.expires_at IS NULL OR pm.expires_at > now())
    ), 0),
    'redemptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'unique_code', r.unique_code,
        'status', r.status,
        'points_used', r.points_used,
        'reward_name', rw.name,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM public.redemptions r
      JOIN public.rewards rw ON rw.id = r.reward_id
      WHERE r.client_id = v_client_id
        AND r.organization_id = v_org_id
    ), '[]'::jsonb),
    'can_book', public.can_client_book_portal(v_client_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_logout(p_session_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.client_portal_sessions
  WHERE token_hash = crypt(p_session_token, token_hash)
    AND expires_at > now() - interval '1 day';
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_client_otp(TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_dashboard(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_logout(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Canje de premios (FEFO) y gestión de estados
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.consume_client_points_fefo(
  p_org_id UUID,
  p_client_id UUID,
  p_points INTEGER,
  p_redemption_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INTEGER := p_points;
  v_lot public.point_movements%ROWTYPE;
  v_take INTEGER;
BEGIN
  IF p_points <= 0 THEN
    RAISE EXCEPTION 'Puntos inválidos';
  END IF;

  FOR v_lot IN
    SELECT *
    FROM public.point_movements pm
    WHERE pm.client_id = p_client_id
      AND pm.organization_id = p_org_id
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
    organization_id, client_id, redemption_id, movement_type,
    quantity, available_quantity, created_by, reason
  ) VALUES (
    p_org_id, p_client_id, p_redemption_id, 'redemption',
    -p_points, 0, auth.uid(), 'Canje de premio'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_client_id UUID,
  p_reward_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_reward public.rewards%ROWTYPE;
  v_code TEXT;
  v_redemption_id UUID;
  v_existing INTEGER;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT * INTO v_reward
  FROM public.rewards
  WHERE id = p_reward_id
    AND organization_id = v_org_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premio no encontrado';
  END IF;

  IF v_reward.starts_at IS NOT NULL AND v_reward.starts_at > now() THEN
    RAISE EXCEPTION 'Premio aún no vigente';
  END IF;

  IF v_reward.ends_at IS NOT NULL AND v_reward.ends_at < now() THEN
    RAISE EXCEPTION 'Premio vencido';
  END IF;

  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN
    RAISE EXCEPTION 'Sin stock';
  END IF;

  IF v_reward.max_per_client IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing
    FROM public.redemptions
    WHERE client_id = p_client_id
      AND reward_id = p_reward_id
      AND status NOT IN ('cancelled', 'expired');
    IF v_existing >= v_reward.max_per_client THEN
      RAISE EXCEPTION 'Límite de canjes por cliente alcanzado';
    END IF;
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.redemptions (
    organization_id, client_id, reward_id, points_used, unique_code, status
  ) VALUES (
    v_org_id, p_client_id, p_reward_id, v_reward.points_required, v_code, 'requested'
  )
  RETURNING id INTO v_redemption_id;

  PERFORM private.consume_client_points_fefo(
    v_org_id, p_client_id, v_reward.points_required, v_redemption_id
  );

  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards SET stock = stock - 1 WHERE id = p_reward_id;
  END IF;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_redemption_status(
  p_redemption_id UUID,
  p_status public.redemption_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_red public.redemptions%ROWTYPE;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT * INTO v_red
  FROM public.redemptions
  WHERE id = p_redemption_id
    AND organization_id = private.user_organization_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canje no encontrado';
  END IF;

  UPDATE public.redemptions
  SET
    status = p_status,
    delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
    delivered_by = CASE WHEN p_status = 'delivered' THEN auth.uid() ELSE delivered_by END,
    approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE approved_by END,
    updated_at = now()
  WHERE id = p_redemption_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_redemption(p_redemption_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_red public.redemptions%ROWTYPE;
  v_reversal_days INTEGER;
  v_expires TIMESTAMPTZ;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT * INTO v_red
  FROM public.redemptions
  WHERE id = p_redemption_id
    AND organization_id = private.user_organization_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canje no encontrado';
  END IF;

  IF v_red.status IN ('cancelled', 'delivered', 'used') THEN
    RAISE EXCEPTION 'No se puede cancelar este canje';
  END IF;

  SELECT COALESCE((settings->>'redemption_reversal_expiry_days')::integer, 30)
  INTO v_reversal_days
  FROM public.organizations
  WHERE id = v_red.organization_id;

  v_expires := now() + (v_reversal_days || ' days')::interval;

  UPDATE public.redemptions
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_redemption_id;

  INSERT INTO public.point_movements (
    organization_id, client_id, redemption_id, movement_type,
    quantity, available_quantity, expires_at, created_by, reason
  ) VALUES (
    v_red.organization_id, v_red.client_id, p_redemption_id, 'redemption_reversal',
    v_red.points_used, v_red.points_used, v_expires, auth.uid(),
    'Reversión de canje cancelado'
  );

  UPDATE public.rewards
  SET stock = stock + 1
  WHERE id = v_red.reward_id
    AND stock IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_redemption_status(UUID, public.redemption_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_redemption(UUID) TO authenticated;
