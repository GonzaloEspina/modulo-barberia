-- Turnos que ocupan varios cupos: ends_at opcional (mayor a la duración de servicios)

DROP FUNCTION IF EXISTS public.create_appointment(UUID, UUID, TIMESTAMPTZ, UUID[], UUID, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS private.create_appointment(UUID, UUID, TIMESTAMPTZ, UUID[], UUID, BOOLEAN, TEXT, TEXT, public.creation_channel);

CREATE OR REPLACE FUNCTION private.create_appointment(
  p_client_id UUID,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_client_membership_id UUID DEFAULT NULL,
  p_is_overbooking BOOLEAN DEFAULT false,
  p_overbooking_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_creation_channel public.creation_channel DEFAULT 'admin',
  p_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_appointment_id UUID;
  v_service_id UUID;
  v_eff RECORD;
  v_subtotal NUMERIC(12,2) := 0;
  v_service_duration INTEGER := 0;
  v_duration INTEGER := 0;
  v_points INTEGER := 0;
  v_ends_at TIMESTAMPTZ;
  v_sort INTEGER := 0;
  v_membership public.client_memberships%ROWTYPE;
  v_total NUMERIC(12,2);
  v_date DATE;
  v_slot_available BOOLEAN;
  v_range_busy BOOLEAN;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  IF private.is_admin() THEN
    NULL;
  ELSIF private.user_barber_id() = p_barber_id THEN
    IF p_is_overbooking THEN
      RAISE EXCEPTION 'Los barberos no pueden crear sobreturnos';
    END IF;
    p_creation_channel := 'barber';
  ELSE
    RAISE EXCEPTION 'Sin permiso para crear turnos';
  END IF;

  IF p_is_overbooking AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden crear sobreturnos';
  END IF;

  IF NOT private.barber_can_perform_services(p_barber_id, p_service_ids) THEN
    RAISE EXCEPTION 'El barbero no puede realizar todos los servicios seleccionados';
  END IF;

  FOREACH v_service_id IN ARRAY p_service_ids LOOP
    SELECT * INTO v_eff FROM private.get_effective_service(p_barber_id, v_service_id);
    IF NOT FOUND OR v_eff.is_available IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Servicio no disponible para el barbero';
    END IF;
    v_subtotal := v_subtotal + v_eff.price;
    v_service_duration := v_service_duration + v_eff.duration_minutes;
    v_points := v_points + v_eff.points_awarded;
  END LOOP;

  IF p_ends_at IS NULL THEN
    v_ends_at := p_starts_at + (v_service_duration || ' minutes')::interval;
    v_duration := v_service_duration;
  ELSE
    IF p_ends_at <= p_starts_at THEN
      RAISE EXCEPTION 'El fin del turno debe ser posterior al inicio';
    END IF;
    v_ends_at := p_ends_at;
    v_duration := GREATEST(
      1,
      ROUND(EXTRACT(EPOCH FROM (p_ends_at - p_starts_at)) / 60.0)::INTEGER
    );
    IF v_duration < v_service_duration THEN
      RAISE EXCEPTION 'La duración del bloque es menor a la de los servicios';
    END IF;
  END IF;

  v_total := v_subtotal;
  v_date := (p_starts_at AT TIME ZONE (SELECT timezone FROM public.organizations WHERE id = v_org_id))::date;

  IF p_client_membership_id IS NOT NULL THEN
    SELECT * INTO v_membership
    FROM public.client_memberships cm
    WHERE cm.id = p_client_membership_id
      AND cm.client_id = p_client_id
      AND cm.organization_id = v_org_id
      AND cm.deleted_at IS NULL
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Membresía no encontrada';
    END IF;

    IF v_membership.status <> 'active' OR NOT v_membership.payment_confirmed THEN
      RAISE EXCEPTION 'Membresía no activa';
    END IF;

    IF v_membership.appointments_remaining <= 0 THEN
      RAISE EXCEPTION 'Membresía sin turnos restantes';
    END IF;

    IF v_membership.expires_at < CURRENT_DATE THEN
      RAISE EXCEPTION 'Membresía vencida';
    END IF;

    v_total := 0;
  END IF;

  IF NOT p_is_overbooking THEN
    SELECT EXISTS (
      SELECT 1
      FROM private.get_available_slots(v_org_id, v_date, p_service_ids, p_barber_id, NULL) s
      WHERE s.slot_start = p_starts_at
    ) INTO v_slot_available;

    IF NOT v_slot_available THEN
      RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
    END IF;

    IF p_ends_at IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM private.get_available_slots(v_org_id, v_date, p_service_ids, p_barber_id, NULL) s
        WHERE s.slot_start = p_ends_at - (v_service_duration || ' minutes')::interval
      ) INTO v_slot_available;

      IF NOT v_slot_available THEN
        RAISE EXCEPTION 'Los cupos adicionales ya no están disponibles';
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.barber_id = p_barber_id
          AND a.is_overbooking = false
          AND a.status <> 'cancelled'
          AND a.deleted_at IS NULL
          AND a.starts_at < v_ends_at
          AND a.ends_at > p_starts_at
      ) INTO v_range_busy;

      IF v_range_busy THEN
        RAISE EXCEPTION 'El rango horario seleccionado ya no está disponible';
      END IF;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_barber_id::text || v_date::text));

  INSERT INTO public.appointments (
    organization_id, client_id, barber_id,
    starts_at, ends_at, total_duration_minutes,
    subtotal, discount_amount, total_amount,
    status, attendance_status,
    client_membership_id, membership_turns_consumed,
    is_overbooking, overbooking_reason, overbooking_created_by,
    notes, creation_channel, created_by
  ) VALUES (
    v_org_id, p_client_id, p_barber_id,
    p_starts_at, v_ends_at, v_duration,
    v_subtotal, 0, v_total,
    COALESCE(
      (SELECT (settings->>'default_appointment_status')::public.appointment_status FROM public.organizations WHERE id = v_org_id),
      'pending'::public.appointment_status
    ),
    'pending',
    p_client_membership_id,
    CASE WHEN p_client_membership_id IS NOT NULL THEN 1 ELSE 0 END,
    p_is_overbooking,
    p_overbooking_reason,
    CASE WHEN p_is_overbooking THEN auth.uid() ELSE NULL END,
    p_notes,
    p_creation_channel,
    auth.uid()
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

  IF p_client_membership_id IS NOT NULL THEN
    UPDATE public.client_memberships
    SET
      appointments_remaining = appointments_remaining - 1,
      status = CASE WHEN appointments_remaining - 1 <= 0 THEN 'exhausted'::public.client_membership_status ELSE status END,
      updated_at = now()
    WHERE id = p_client_membership_id;
  END IF;

  INSERT INTO public.appointment_status_history (
    organization_id, appointment_id,
    new_status, new_attendance, changed_by, reason
  )
  SELECT organization_id, id, status, attendance_status, auth.uid(), 'Creación'
  FROM public.appointments WHERE id = v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_client_id UUID,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_client_membership_id UUID DEFAULT NULL,
  p_is_overbooking BOOLEAN DEFAULT false,
  p_overbooking_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN private.create_appointment(
    p_client_id, p_barber_id, p_starts_at, p_service_ids,
    p_client_membership_id, p_is_overbooking, p_overbooking_reason, p_notes,
    'admin', p_ends_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointment(UUID, UUID, TIMESTAMPTZ, UUID[], UUID, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
