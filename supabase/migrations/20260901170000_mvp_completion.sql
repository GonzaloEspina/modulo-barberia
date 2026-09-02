-- MVP: puntos automáticos, inasistencias, portal reservas, plataforma

-- ---------------------------------------------------------------------------
-- Puntos: idempotencia + acreditación automática según points_config
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.credit_points(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_cfg public.points_config%ROWTYPE;
  v_points INTEGER := 0;
  v_expires TIMESTAMPTZ;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.point_movements pm
    WHERE pm.appointment_id = p_appointment_id
      AND pm.movement_type = 'service_credit'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_cfg FROM public.points_config WHERE organization_id = v_appt.organization_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN; END IF;

  IF v_appt.client_membership_id IS NOT NULL THEN
    IF NOT COALESCE(
      (SELECT (settings->>'membership_credit_points')::boolean FROM public.organizations WHERE id = v_appt.organization_id),
      true
    ) THEN
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(SUM(points_applied), 0) INTO v_points
  FROM public.appointment_services WHERE appointment_id = p_appointment_id;

  IF v_points <= 0 THEN RETURN; END IF;

  v_expires := CASE v_cfg.expiration_type
    WHEN 'days' THEN now() + (v_cfg.expiration_value || ' days')::interval
    WHEN 'months' THEN date_trunc('month', now() + (v_cfg.expiration_value || ' months')::interval) + interval '1 month - 1 day'
    ELSE NULL
  END;

  INSERT INTO public.point_movements (
    organization_id, client_id, appointment_id, movement_type,
    quantity, available_quantity, expires_at, created_by, reason
  ) VALUES (
    v_appt.organization_id, v_appt.client_id, p_appointment_id, 'service_credit',
    v_points, v_points, v_expires, auth.uid(), 'Acreditación por servicio'
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.appointment_is_fully_paid(p_appointment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(private.appointment_paid_total(p_appointment_id), 0)
    >= COALESCE((SELECT total_amount FROM public.appointments WHERE id = p_appointment_id), 0);
$$;

CREATE OR REPLACE FUNCTION private.try_auto_credit_points(
  p_appointment_id UUID,
  p_event public.point_credit_moment
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.points_config%ROWTYPE;
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.appointments WHERE id = p_appointment_id;
  IF v_org_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_cfg FROM public.points_config WHERE organization_id = v_org_id;
  IF NOT FOUND OR NOT v_cfg.enabled OR v_cfg.credit_moment <> p_event THEN
    RETURN;
  END IF;

  IF v_cfg.require_payment_for_credit AND NOT private.appointment_is_fully_paid(p_appointment_id) THEN
    RETURN;
  END IF;

  PERFORM public.credit_points(p_appointment_id);
END;
$$;

CREATE OR REPLACE FUNCTION private.appointments_auto_credit_trg_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.try_auto_credit_points(NEW.id, 'on_create');
    IF NEW.status = 'confirmed' THEN
      PERFORM private.try_auto_credit_points(NEW.id, 'on_confirm');
    END IF;
    IF NEW.status = 'completed' THEN
      PERFORM private.try_auto_credit_points(NEW.id, 'on_complete');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'confirmed' THEN
        PERFORM private.try_auto_credit_points(NEW.id, 'on_confirm');
      ELSIF NEW.status = 'completed' THEN
        PERFORM private.try_auto_credit_points(NEW.id, 'on_complete');
      END IF;
    END IF;

    IF NEW.attendance_status IS DISTINCT FROM OLD.attendance_status
       AND NEW.attendance_status = 'no_show' THEN
      PERFORM private.evaluate_client_absence_warning(NEW.client_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_auto_credit_trg ON public.appointments;
CREATE TRIGGER appointments_auto_credit_trg
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION private.appointments_auto_credit_trg_fn();

CREATE OR REPLACE FUNCTION private.payments_auto_credit_trg_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    PERFORM private.try_auto_credit_points(NEW.appointment_id, 'on_payment');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_auto_credit_trg ON public.payments;
CREATE TRIGGER payments_auto_credit_trg
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.payments_auto_credit_trg_fn();

-- ---------------------------------------------------------------------------
-- Motor de inasistencias
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.count_client_absences(
  p_client_id UUID,
  p_org_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.absence_config%ROWTYPE;
  v_count INTEGER := 0;
  v_appt RECORD;
  v_period_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_cfg
  FROM public.absence_config
  WHERE organization_id = p_org_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_cfg.rule_type = 'within_period' THEN
    v_period_start := now() - (
      v_cfg.period_value::text || ' ' ||
      CASE v_cfg.period_unit
        WHEN 'days' THEN 'days'
        WHEN 'weeks' THEN 'weeks'
        ELSE 'months'
      END
    )::interval;

    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.appointments a
    WHERE a.client_id = p_client_id
      AND a.organization_id = p_org_id
      AND a.status <> 'cancelled'
      AND a.attendance_status = ANY (v_cfg.counting_statuses)
      AND a.starts_at >= v_period_start;

    RETURN v_count;
  END IF;

  -- consecutive: desde el turno más reciente hacia atrás
  FOR v_appt IN
    SELECT a.attendance_status
    FROM public.appointments a
    WHERE a.client_id = p_client_id
      AND a.organization_id = p_org_id
      AND a.status <> 'cancelled'
      AND a.starts_at <= now()
    ORDER BY a.starts_at DESC
  LOOP
    IF v_appt.attendance_status = ANY (v_cfg.counting_statuses) THEN
      v_count := v_count + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.evaluate_client_absence_warning(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.clients%ROWTYPE;
  v_cfg public.absence_config%ROWTYPE;
  v_count INTEGER;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_cfg
  FROM public.absence_config
  WHERE organization_id = v_client.organization_id AND is_active = true;

  IF NOT FOUND THEN RETURN; END IF;

  v_count := private.count_client_absences(p_client_id, v_client.organization_id);

  IF v_count >= v_cfg.threshold_count THEN
    v_reason := CASE v_cfg.rule_type
      WHEN 'consecutive' THEN
        format('Alerta automática: %s inasistencias consecutivas (umbral %s)', v_count, v_cfg.threshold_count)
      ELSE
        format(
          'Alerta automática: %s inasistencias en los últimos %s %s (umbral %s)',
          v_count, v_cfg.period_value, v_cfg.period_unit, v_cfg.threshold_count
        )
    END;

    UPDATE public.clients
    SET
      manual_warning = true,
      manual_warning_reason = v_reason,
      updated_at = now()
    WHERE id = p_client_id
      AND (manual_warning IS DISTINCT FROM true OR manual_warning_reason IS DISTINCT FROM v_reason);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_client_absence_warning(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.clients%ROWTYPE;
  v_cfg public.absence_config%ROWTYPE;
  v_count INTEGER;
  v_warning BOOLEAN;
  v_message TEXT;
BEGIN
  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  IF NOT private.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.appointments a
       WHERE a.client_id = p_client_id
         AND a.barber_id = private.user_barber_id()
     ) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT * INTO v_cfg
  FROM public.absence_config
  WHERE organization_id = v_client.organization_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('warning', false, 'absence_count', 0);
  END IF;

  v_count := private.count_client_absences(p_client_id, v_client.organization_id);
  v_warning := v_count >= v_cfg.threshold_count OR v_client.manual_warning;

  v_message := CASE
    WHEN v_client.manual_warning AND v_client.manual_warning_reason IS NOT NULL THEN v_client.manual_warning_reason
    WHEN v_count >= v_cfg.threshold_count THEN
      CASE v_cfg.rule_type
        WHEN 'consecutive' THEN format('%s faltas consecutivas (umbral %s)', v_count, v_cfg.threshold_count)
        ELSE format('%s faltas en el período configurado (umbral %s)', v_count, v_cfg.threshold_count)
      END
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'warning', v_warning,
    'absence_count', v_count,
    'threshold', v_cfg.threshold_count,
    'rule_type', v_cfg.rule_type,
    'message', v_message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_absence_warning(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Portal: reserva online
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_list_services(p_session_token TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  duration_minutes INTEGER,
  price NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  RETURN QUERY
  SELECT s.id, s.name, s.duration_minutes, s.price
  FROM public.services s
  WHERE s.organization_id = v_org_id
    AND s.is_active = true
    AND s.deleted_at IS NULL
  ORDER BY s.display_order, s.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_list_barbers(
  p_session_token TEXT,
  p_service_ids UUID[]
)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  RETURN QUERY
  SELECT b.id, b.name
  FROM public.barbers b
  WHERE b.organization_id = v_org_id
    AND b.is_active = true
    AND b.deleted_at IS NULL
    AND private.barber_can_perform_services(b.id, p_service_ids)
  ORDER BY b.display_order, b.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_available_slots(
  p_session_token TEXT,
  p_date DATE,
  p_service_ids UUID[],
  p_barber_id UUID DEFAULT NULL
)
RETURNS TABLE (
  barber_id UUID,
  barber_name TEXT,
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  total_duration_minutes INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  RETURN QUERY
  SELECT s.barber_id, s.barber_name, s.slot_start, s.slot_end, s.total_duration_minutes
  FROM private.get_available_slots(v_org_id, p_date, p_service_ids, p_barber_id, NULL) s;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_create_appointment(
  p_session_token TEXT,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_org_id UUID;
  v_appointment_id UUID;
  v_service_id UUID;
  v_eff RECORD;
  v_subtotal NUMERIC(12,2) := 0;
  v_duration INTEGER := 0;
  v_ends_at TIMESTAMPTZ;
  v_sort INTEGER := 0;
  v_date DATE;
  v_slot_available BOOLEAN;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  IF NOT public.can_client_book_portal(v_client_id) THEN
    RAISE EXCEPTION 'No tenés permiso para reservar online';
  END IF;

  IF NOT private.barber_can_perform_services(p_barber_id, p_service_ids) THEN
    RAISE EXCEPTION 'El barbero no realiza los servicios seleccionados';
  END IF;

  FOREACH v_service_id IN ARRAY p_service_ids LOOP
    SELECT * INTO v_eff FROM private.get_effective_service(p_barber_id, v_service_id);
    IF NOT FOUND OR v_eff.is_available IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Servicio no disponible';
    END IF;
    v_subtotal := v_subtotal + v_eff.price;
    v_duration := v_duration + v_eff.duration_minutes;
  END LOOP;

  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;
  v_date := (p_starts_at AT TIME ZONE (SELECT timezone FROM public.organizations WHERE id = v_org_id))::date;

  SELECT EXISTS (
    SELECT 1
    FROM private.get_available_slots(v_org_id, v_date, p_service_ids, p_barber_id, NULL) s
    WHERE s.slot_start = p_starts_at
  ) INTO v_slot_available;

  IF NOT v_slot_available THEN
    RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_barber_id::text || v_date::text));

  INSERT INTO public.appointments (
    organization_id, client_id, barber_id,
    starts_at, ends_at, total_duration_minutes,
    subtotal, discount_amount, total_amount,
    status, attendance_status,
    notes, creation_channel, created_by
  ) VALUES (
    v_org_id, v_client_id, p_barber_id,
    p_starts_at, v_ends_at, v_duration,
    v_subtotal, 0, v_subtotal,
    COALESCE(
      (SELECT (settings->>'default_appointment_status')::public.appointment_status FROM public.organizations WHERE id = v_org_id),
      'pending'::public.appointment_status
    ),
    'pending',
    p_notes,
    'portal',
    NULL
  )
  RETURNING id INTO v_appointment_id;

  FOREACH v_service_id IN ARRAY p_service_ids LOOP
    v_sort := v_sort + 1;
    SELECT * INTO v_eff FROM private.get_effective_service(p_barber_id, v_service_id);

    INSERT INTO public.appointment_services (
      organization_id, appointment_id, service_id,
      service_name, price_applied, duration_applied, points_applied, sort_order
    ) VALUES (
      v_org_id, v_appointment_id, v_service_id,
      v_eff.name, v_eff.price, v_eff.duration_minutes, v_eff.points_awarded, v_sort
    );
  END LOOP;

  INSERT INTO public.appointment_status_history (
    organization_id, appointment_id, new_status, new_attendance, reason
  )
  SELECT organization_id, id, status, attendance_status, 'Reserva portal'
  FROM public.appointments WHERE id = v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_list_services(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_list_barbers(TEXT, UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_available_slots(TEXT, DATE, UUID[], UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_appointment(TEXT, UUID, TIMESTAMPTZ, UUID[], TEXT) TO anon, authenticated;

-- OTP por cliente (ficha)
CREATE OR REPLACE FUNCTION public.generate_client_otp_for_client(p_client_id UUID, p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  SELECT phone_normalized INTO v_phone
  FROM public.clients
  WHERE id = p_client_id
    AND organization_id = private.user_organization_id()
    AND deleted_at IS NULL;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  RETURN public.generate_client_otp(v_phone, p_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_client_otp_for_client(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Plataforma: crear org, asignar admin, cambiar contexto
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_create_organization(
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  INSERT INTO public.organizations (name, phone, address)
  VALUES (trim(p_name), NULLIF(trim(p_phone), ''), NULLIF(trim(p_address), ''))
  RETURNING id INTO v_org_id;

  INSERT INTO public.points_config (organization_id) VALUES (v_org_id);
  INSERT INTO public.absence_config (organization_id) VALUES (v_org_id);

  INSERT INTO public.payment_methods (organization_id, name, display_order) VALUES
    (v_org_id, 'Efectivo', 1),
    (v_org_id, 'Transferencia', 2),
    (v_org_id, 'Tarjeta', 3);

  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_assign_org_admin(p_org_id UUID, p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado con ese email';
  END IF;

  INSERT INTO public.profiles (id, organization_id, role, full_name, permissions)
  VALUES (
    v_user_id, p_org_id, 'admin', COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_user_id), 'Administrador'),
    '{"can_register_payments": true, "can_edit_own_schedule": true}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    role = 'admin',
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_switch_organization(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  UPDATE public.profiles
  SET organization_id = p_org_id, role = 'admin', updated_at = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_create_organization(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_assign_org_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_switch_organization(UUID) TO authenticated;
