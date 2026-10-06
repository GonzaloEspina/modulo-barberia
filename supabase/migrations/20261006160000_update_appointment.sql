-- Permite editar barbero, horario, servicios y notas de un turno existente.
CREATE OR REPLACE FUNCTION public.update_appointment(
  p_appointment_id UUID,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_notes TEXT DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_org_id UUID;
  v_org_tz TEXT;
  v_service_id UUID;
  v_eff RECORD;
  v_subtotal NUMERIC(12,2) := 0;
  v_service_duration INTEGER := 0;
  v_duration INTEGER := 0;
  v_ends_at TIMESTAMPTZ;
  v_sort INTEGER := 0;
  v_total NUMERIC(12,2);
  v_date DATE;
  v_paid NUMERIC(12,2);
  v_slot_available BOOLEAN;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND organization_id = v_org_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede editar un turno cancelado';
  END IF;

  IF private.is_admin() THEN
    NULL;
  ELSIF private.user_barber_id() IS NOT NULL
    AND (v_appt.barber_id = private.user_barber_id() OR p_barber_id = private.user_barber_id()) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Sin permiso para editar este turno';
  END IF;

  IF p_service_ids IS NULL OR coalesce(array_length(p_service_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Seleccioná al menos un servicio';
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

  IF p_starts_at < now() THEN
    RAISE EXCEPTION 'No se pueden editar turnos al pasado';
  END IF;

  IF NOT private.barber_range_is_open(p_barber_id, p_starts_at, v_ends_at) THEN
    RAISE EXCEPTION 'El horario está fuera del horario de atención o el día está cerrado';
  END IF;

  SELECT timezone INTO v_org_tz FROM public.organizations WHERE id = v_org_id;
  v_date := (p_starts_at AT TIME ZONE v_org_tz)::date;

  IF v_appt.client_membership_id IS NOT NULL THEN
    v_total := 0;
  ELSE
    v_total := GREATEST(0, v_subtotal - coalesce(v_appt.discount_amount, 0));
  END IF;

  SELECT coalesce(sum(p.amount), 0)
  INTO v_paid
  FROM public.payments p
  WHERE p.appointment_id = p_appointment_id
    AND p.is_active = true
    AND p.deleted_at IS NULL;

  IF v_paid > v_total THEN
    RAISE EXCEPTION 'El total del turno no puede ser menor a lo ya pagado (%s)', v_paid;
  END IF;

  IF NOT v_appt.is_overbooking THEN
    SELECT EXISTS (
      SELECT 1
      FROM private.get_available_slots(v_org_id, v_date, p_service_ids, p_barber_id, NULL) s
      WHERE s.slot_start = p_starts_at
    ) INTO v_slot_available;

    IF NOT v_slot_available THEN
      IF EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.barber_id = p_barber_id
          AND a.id <> p_appointment_id
          AND a.is_active = true
          AND a.is_overbooking = false
          AND a.status <> 'cancelled'
          AND a.starts_at < v_ends_at
          AND a.ends_at > p_starts_at
      ) THEN
        RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
      END IF;
    ELSIF EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.barber_id = p_barber_id
        AND a.id <> p_appointment_id
        AND a.is_active = true
        AND a.is_overbooking = false
        AND a.status <> 'cancelled'
        AND a.starts_at < v_ends_at
        AND a.ends_at > p_starts_at
    ) THEN
      RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_barber_id::text || v_date::text));

  UPDATE public.appointments
  SET
    barber_id = p_barber_id,
    starts_at = p_starts_at,
    ends_at = v_ends_at,
    total_duration_minutes = v_duration,
    subtotal = v_subtotal,
    total_amount = v_total,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    attendance_status = CASE
      WHEN v_appt.starts_at IS DISTINCT FROM p_starts_at OR v_appt.barber_id IS DISTINCT FROM p_barber_id
        THEN 'rescheduled'::public.attendance_status
      ELSE v_appt.attendance_status
    END,
    updated_at = now()
  WHERE id = p_appointment_id;

  DELETE FROM public.appointment_services
  WHERE appointment_id = p_appointment_id;

  FOREACH v_service_id IN ARRAY p_service_ids LOOP
    v_sort := v_sort + 1;
    SELECT * INTO v_eff FROM private.get_effective_service(p_barber_id, v_service_id);

    INSERT INTO public.appointment_services (
      organization_id, appointment_id, service_id,
      service_name, price_applied, duration_applied, points_applied, sort_order
    ) VALUES (
      v_org_id, p_appointment_id, v_service_id,
      v_eff.name, v_eff.price, v_eff.duration_minutes, v_eff.points_awarded, v_sort
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_appointment(UUID, UUID, TIMESTAMPTZ, UUID[], TEXT, TIMESTAMPTZ) TO authenticated;
