-- Let portal clients apply a claimed discount coupon when booking.
-- Staff permission stays on apply_appointment_coupon; the private helper
-- uses the appointment's organization so portal sessions can call it.

CREATE OR REPLACE FUNCTION private.apply_redemption_to_appointment(
  p_appointment_id UUID,
  p_redemption_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_appt public.appointments%ROWTYPE;
  v_red public.redemptions%ROWTYPE;
  v_reward public.rewards%ROWTYPE;
  v_discount NUMERIC(12,2) := 0;
  v_paid NUMERIC(12,2);
  v_new_total NUMERIC(12,2);
  v_new_status public.redemption_status;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  v_org_id := v_appt.organization_id;

  IF v_appt.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede aplicar un cupón a un turno cancelado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.redemptions r
    WHERE r.appointment_id = v_appt.id
  ) THEN
    RAISE EXCEPTION 'Este turno ya tiene un cupón aplicado';
  END IF;

  SELECT * INTO v_red
  FROM public.redemptions
  WHERE id = p_redemption_id
    AND organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupón no encontrado';
  END IF;

  IF v_red.client_id <> v_appt.client_id THEN
    RAISE EXCEPTION 'El cupón no pertenece a este cliente';
  END IF;

  IF v_red.status NOT IN ('requested', 'approved') OR v_red.appointment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este cupón ya no está disponible';
  END IF;

  SELECT * INTO v_reward FROM public.rewards WHERE id = v_red.reward_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premio no encontrado';
  END IF;

  IF v_reward.reward_type = 'percentage_discount' THEN
    v_discount := ROUND(v_appt.subtotal * COALESCE(v_reward.value, 0) / 100.0, 2);
  ELSIF v_reward.reward_type = 'fixed_discount' THEN
    v_discount := COALESCE(v_reward.value, 0);
  ELSIF v_reward.reward_type = 'free_service' THEN
    SELECT aps.price_applied INTO v_discount
    FROM public.appointment_services aps
    WHERE aps.appointment_id = v_appt.id
      AND aps.service_id = v_reward.service_id
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Este cupón es para un servicio que no está en el turno';
    END IF;
  ELSE
    RAISE EXCEPTION 'Este cupón no se puede aplicar a un turno';
  END IF;

  v_discount := LEAST(GREATEST(v_discount, 0), v_appt.subtotal);

  v_new_status := 'used'::public.redemption_status;

  IF v_appt.client_membership_id IS NULL AND v_discount > 0 THEN
    v_new_total := GREATEST(v_appt.subtotal - v_discount, 0);
    v_paid := private.appointment_paid_total(v_appt.id);
    IF v_paid > v_new_total THEN
      RAISE EXCEPTION 'El turno ya tiene pagos mayores al total con descuento';
    END IF;

    UPDATE public.appointments
    SET
      discount_amount = v_discount,
      total_amount = v_new_total,
      updated_at = now()
    WHERE id = v_appt.id;
  END IF;

  UPDATE public.redemptions
  SET
    appointment_id = v_appt.id,
    status = v_new_status,
    approved_by = COALESCE(approved_by, auth.uid()),
    notes = COALESCE(notes, 'Aplicado al turno'),
    updated_at = now()
  WHERE id = v_red.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_appointment_coupon(
  p_appointment_id UUID,
  p_redemption_id UUID DEFAULT NULL,
  p_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_appt public.appointments%ROWTYPE;
  v_redemption_id UUID;
  v_code TEXT;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.organization_id = v_org_id
    AND a.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  IF NOT private.is_admin() AND v_appt.barber_id <> private.user_barber_id() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  v_redemption_id := p_redemption_id;

  IF v_redemption_id IS NULL THEN
    v_code := upper(trim(COALESCE(p_code, '')));
    IF v_code = '' THEN
      RAISE EXCEPTION 'Seleccioná un cupón o ingresá el código';
    END IF;

    SELECT r.id INTO v_redemption_id
    FROM public.redemptions r
    WHERE r.organization_id = v_org_id
      AND r.client_id = v_appt.client_id
      AND r.unique_code = v_code
    LIMIT 1;

    IF v_redemption_id IS NULL THEN
      RAISE EXCEPTION 'Código inválido para este cliente';
    END IF;
  END IF;

  PERFORM private.apply_redemption_to_appointment(p_appointment_id, v_redemption_id);
END;
$$;

DROP FUNCTION IF EXISTS public.portal_create_appointment(TEXT, UUID, TIMESTAMPTZ, UUID[], TEXT);

CREATE FUNCTION public.portal_create_appointment(
  p_session_token TEXT,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_notes TEXT DEFAULT NULL,
  p_redemption_id UUID DEFAULT NULL,
  p_code TEXT DEFAULT NULL
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
  v_redemption_id UUID;
  v_code TEXT;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  IF NOT public.can_client_book_portal(v_client_id) THEN
    RAISE EXCEPTION 'No tenés permiso para reservar online';
  END IF;

  PERFORM private.assert_portal_services_visible(v_org_id, p_service_ids);

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
    'client_portal',
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

  v_redemption_id := p_redemption_id;
  IF v_redemption_id IS NULL AND COALESCE(trim(p_code), '') <> '' THEN
    v_code := upper(trim(p_code));
    SELECT r.id INTO v_redemption_id
    FROM public.redemptions r
    WHERE r.organization_id = v_org_id
      AND r.client_id = v_client_id
      AND r.unique_code = v_code
    LIMIT 1;

    IF v_redemption_id IS NULL THEN
      RAISE EXCEPTION 'Código inválido';
    END IF;
  END IF;

  IF v_redemption_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.redemptions r
      WHERE r.id = v_redemption_id
        AND r.client_id = v_client_id
        AND r.organization_id = v_org_id
    ) THEN
      RAISE EXCEPTION 'El cupón no pertenece a tu cuenta';
    END IF;

    PERFORM private.apply_redemption_to_appointment(v_appointment_id, v_redemption_id);
  END IF;

  RETURN v_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_create_appointment(TEXT, UUID, TIMESTAMPTZ, UUID[], TEXT, UUID, TEXT)
  TO anon, authenticated;

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
  v_client public.clients%ROWTYPE;
  v_mode public.portal_booking_mode;
  v_balance INTEGER;
  v_next_expires TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  SELECT * INTO v_client FROM public.clients WHERE id = v_client_id;

  SELECT (settings->>'portal_booking_mode')::public.portal_booking_mode
  INTO v_mode
  FROM public.organizations WHERE id = v_org_id;

  SELECT
    COALESCE(SUM(pm.available_quantity), 0)::INTEGER,
    MIN(pm.expires_at) FILTER (
      WHERE pm.available_quantity > 0 AND pm.expires_at IS NOT NULL
    )
  INTO v_balance, v_next_expires
  FROM public.point_movements pm
  WHERE pm.client_id = v_client_id
    AND pm.organization_id = v_org_id
    AND pm.available_quantity > 0
    AND (pm.expires_at IS NULL OR pm.expires_at > now());

  SELECT jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client.id,
      'first_name', v_client.first_name,
      'last_name', v_client.last_name,
      'phone_display', v_client.phone_display
    ),
    'organization', (
      SELECT jsonb_build_object('name', o.name)
      FROM public.organizations o WHERE o.id = v_org_id
    ),
    'portal_booking_mode', v_mode,
    'booking_override', v_client.booking_override,
    'can_book', public.can_client_book_portal(v_client_id),
    'upcoming_appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'status', a.status,
        'barber_name', b.name,
        'service_names', (
          SELECT string_agg(aps.service_name, ', ' ORDER BY aps.sort_order)
          FROM public.appointment_services aps
          WHERE aps.appointment_id = a.id
        ),
        'total_amount', a.total_amount
      ) ORDER BY a.starts_at ASC)
      FROM public.appointments a
      JOIN public.barbers b ON b.id = a.barber_id
      WHERE a.client_id = v_client_id
        AND a.organization_id = v_org_id
        AND a.starts_at >= now()
        AND a.status <> 'cancelled'
    ), '[]'::jsonb),
    'past_appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'status', a.status,
        'barber_name', b.name,
        'service_names', (
          SELECT string_agg(aps.service_name, ', ' ORDER BY aps.sort_order)
          FROM public.appointment_services aps
          WHERE aps.appointment_id = a.id
        ),
        'total_amount', a.total_amount
      ) ORDER BY a.starts_at DESC)
      FROM public.appointments a
      JOIN public.barbers b ON b.id = a.barber_id
      WHERE a.client_id = v_client_id
        AND a.organization_id = v_org_id
        AND a.starts_at < now()
        AND a.starts_at >= now() - interval '12 months'
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
    'point_balance', v_balance,
    'point_next_expires_at', v_next_expires,
    'rewards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rw.id,
        'name', rw.name,
        'description', rw.description,
        'points_required', rw.points_required,
        'reward_type', rw.reward_type,
        'value', rw.value,
        'stock', rw.stock,
        'can_redeem',
          v_balance >= rw.points_required
          AND (
            rw.max_per_client IS NULL
            OR (
              SELECT COUNT(*)
              FROM public.redemptions r
              WHERE r.client_id = v_client_id
                AND r.reward_id = rw.id
                AND r.status NOT IN ('cancelled', 'expired')
            ) < rw.max_per_client
          )
      ) ORDER BY rw.points_required, rw.name)
      FROM public.rewards rw
      WHERE rw.organization_id = v_org_id
        AND rw.is_active = true
        AND (rw.starts_at IS NULL OR rw.starts_at <= now())
        AND (rw.ends_at IS NULL OR rw.ends_at > now())
        AND (rw.stock IS NULL OR rw.stock > 0)
    ), '[]'::jsonb),
    'redemptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'unique_code', r.unique_code,
        'status', r.status,
        'points_used', r.points_used,
        'reward_name', rw.name,
        'reward_type', rw.reward_type,
        'value', rw.value,
        'service_id', rw.service_id,
        'appointment_id', r.appointment_id,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM public.redemptions r
      JOIN public.rewards rw ON rw.id = r.reward_id
      WHERE r.client_id = v_client_id
        AND r.organization_id = v_org_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
