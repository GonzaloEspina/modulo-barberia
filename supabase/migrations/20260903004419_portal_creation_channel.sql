-- Portal bookings used creation_channel = 'portal', which is not in the enum.
-- Valid values: admin, barber, client_portal, import.

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

  RETURN v_appointment_id;
END;
$$;
