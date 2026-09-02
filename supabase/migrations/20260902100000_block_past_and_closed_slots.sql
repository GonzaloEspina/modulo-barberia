-- No permitir turnos en el pasado ni fuera del horario de atención

CREATE OR REPLACE FUNCTION private.barber_range_is_open(
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_timezone TEXT;
  v_date DATE;
  v_end_date DATE;
  day_bounds RECORD;
  v_windows INTEGER[] := '{}';
  w_start INTEGER;
  w_end INTEGER;
  start_min INTEGER;
  end_min INTEGER;
  i INTEGER;
BEGIN
  IF p_ends_at <= p_starts_at THEN
    RETURN false;
  END IF;

  SELECT b.organization_id, o.timezone
  INTO v_org_id, v_timezone
  FROM public.barbers b
  JOIN public.organizations o ON o.id = b.organization_id
  WHERE b.id = p_barber_id
    AND b.deleted_at IS NULL
    AND b.is_active = true;

  IF v_org_id IS NULL OR v_timezone IS NULL THEN
    RETURN false;
  END IF;

  v_date := (p_starts_at AT TIME ZONE v_timezone)::date;
  v_end_date := (p_ends_at AT TIME ZONE v_timezone)::date;
  IF v_end_date <> v_date THEN
    RETURN false;
  END IF;

  SELECT * INTO day_bounds FROM private.local_day_bounds(v_date, v_timezone);

  FOR w_start, w_end IN
    SELECT bw.start_minute, bw.end_minute
    FROM private.get_barber_base_windows(p_barber_id, v_date) bw
  LOOP
    v_windows := v_windows || ARRAY[w_start, w_end];
  END LOOP;

  v_windows := private.apply_schedule_exceptions_to_windows(
    p_barber_id,
    v_org_id,
    v_date,
    v_windows
  );

  IF v_windows IS NULL OR array_length(v_windows, 1) IS NULL THEN
    RETURN false;
  END IF;

  start_min := FLOOR(EXTRACT(EPOCH FROM (p_starts_at - day_bounds.day_start)) / 60)::INTEGER;
  end_min := CEIL(EXTRACT(EPOCH FROM (p_ends_at - day_bounds.day_start)) / 60)::INTEGER;

  FOR i IN 1..array_length(v_windows, 1) BY 2 LOOP
    IF v_windows[i] <= start_min AND v_windows[i + 1] >= end_min THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION private.barber_range_is_open(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_available_slots(
  p_org_id UUID,
  p_date DATE,
  p_service_ids UUID[],
  p_barber_id UUID DEFAULT NULL,
  p_slot_interval INTEGER DEFAULT NULL
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
  v_timezone TEXT;
  v_interval INTEGER;
  v_preview_mode BOOLEAN;
  barber_rec RECORD;
  v_windows INTEGER[];
  i INTEGER;
  w_start INTEGER;
  w_end INTEGER;
  slot_min INTEGER;
  slot_end_min INTEGER;
  v_duration INTEGER;
  day_bounds RECORD;
  slot_start_ts TIMESTAMPTZ;
  slot_end_ts TIMESTAMPTZ;
  busy RECORD;
  overlaps_busy BOOLEAN;
BEGIN
  SELECT timezone INTO v_timezone
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  IF p_slot_interval IS NULL THEN
    SELECT COALESCE((settings->>'appointment_slot_interval_minutes')::INTEGER, 15)
    INTO v_interval
    FROM public.organizations
    WHERE id = p_org_id;
  ELSE
    v_interval := p_slot_interval;
  END IF;

  v_preview_mode := p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL;

  SELECT * INTO day_bounds FROM private.local_day_bounds(p_date, v_timezone);

  FOR barber_rec IN
    SELECT b.id, b.name
    FROM public.barbers b
    WHERE b.organization_id = p_org_id
      AND b.deleted_at IS NULL
      AND b.is_active = true
      AND (p_barber_id IS NULL OR b.id = p_barber_id)
      AND (
        v_preview_mode
        OR private.barber_can_perform_services(b.id, p_service_ids)
      )
    ORDER BY b.display_order, b.name
  LOOP
    IF v_preview_mode THEN
      v_duration := v_interval;
    ELSE
      v_duration := private.sum_effective_service_duration(barber_rec.id, p_service_ids);
      IF v_duration IS NULL OR v_duration <= 0 THEN
        CONTINUE;
      END IF;
    END IF;

    v_windows := '{}';
    FOR w_start, w_end IN
      SELECT bw.start_minute, bw.end_minute
      FROM private.get_barber_base_windows(barber_rec.id, p_date) bw
    LOOP
      v_windows := v_windows || ARRAY[w_start, w_end];
    END LOOP;

    v_windows := private.apply_schedule_exceptions_to_windows(
      barber_rec.id,
      p_org_id,
      p_date,
      v_windows
    );

    IF v_windows IS NULL OR array_length(v_windows, 1) IS NULL THEN
      CONTINUE;
    END IF;

    FOR i IN 1..array_length(v_windows, 1) BY 2 LOOP
      w_start := v_windows[i];
      w_end := v_windows[i + 1];

      IF w_end - w_start < v_duration THEN
        CONTINUE;
      END IF;

      slot_min := w_start;
      WHILE slot_min + v_duration <= w_end LOOP
        slot_end_min := slot_min + v_duration;

        slot_start_ts := day_bounds.day_start + (slot_min || ' minutes')::INTERVAL;
        slot_end_ts := day_bounds.day_start + (slot_end_min || ' minutes')::INTERVAL;

        IF slot_start_ts < now() THEN
          slot_min := slot_min + v_interval;
          CONTINUE;
        END IF;

        overlaps_busy := false;
        FOR busy IN
          SELECT a.starts_at, a.ends_at
          FROM public.appointments a
          WHERE a.barber_id = barber_rec.id
            AND a.is_overbooking = false
            AND a.status NOT IN ('cancelled')
            AND a.starts_at < slot_end_ts
            AND a.ends_at > slot_start_ts
        LOOP
          overlaps_busy := true;
          EXIT;
        END LOOP;

        IF NOT overlaps_busy THEN
          barber_id := barber_rec.id;
          barber_name := barber_rec.name;
          slot_start := slot_start_ts;
          slot_end := slot_end_ts;
          total_duration_minutes := v_duration;
          RETURN NEXT;
        END IF;

        slot_min := slot_min + v_interval;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_schedule_gaps(
  p_org_id UUID,
  p_date DATE,
  p_barber_id UUID DEFAULT NULL
)
RETURNS TABLE (
  barber_id UUID,
  barber_name TEXT,
  gap_start TIMESTAMPTZ,
  gap_end TIMESTAMPTZ,
  duration_minutes INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
  barber_rec RECORD;
  v_windows INTEGER[];
  i INTEGER;
  w_start INTEGER;
  w_end INTEGER;
  day_bounds RECORD;
  cursor_min INTEGER;
  busy RECORD;
  busy_start INTEGER;
  busy_end INTEGER;
  v_gap_start TIMESTAMPTZ;
  v_gap_end TIMESTAMPTZ;
BEGIN
  SELECT timezone INTO v_timezone
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  SELECT * INTO day_bounds FROM private.local_day_bounds(p_date, v_timezone);

  FOR barber_rec IN
    SELECT b.id, b.name
    FROM public.barbers b
    WHERE b.organization_id = p_org_id
      AND b.deleted_at IS NULL
      AND b.is_active = true
      AND (p_barber_id IS NULL OR b.id = p_barber_id)
    ORDER BY b.display_order, b.name
  LOOP
    v_windows := '{}';
    FOR w_start, w_end IN
      SELECT bw.start_minute, bw.end_minute
      FROM private.get_barber_base_windows(barber_rec.id, p_date) bw
    LOOP
      v_windows := v_windows || ARRAY[w_start, w_end];
    END LOOP;

    v_windows := private.apply_schedule_exceptions_to_windows(
      barber_rec.id,
      p_org_id,
      p_date,
      v_windows
    );

    IF v_windows IS NULL OR array_length(v_windows, 1) IS NULL THEN
      CONTINUE;
    END IF;

    FOR i IN 1..array_length(v_windows, 1) BY 2 LOOP
      w_start := v_windows[i];
      w_end := v_windows[i + 1];
      cursor_min := w_start;

      FOR busy IN
        SELECT
          GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM (a.starts_at - day_bounds.day_start)) / 60)::INTEGER
          ) AS start_min,
          LEAST(
            w_end,
            CEIL(EXTRACT(EPOCH FROM (a.ends_at - day_bounds.day_start)) / 60)::INTEGER
          ) AS end_min
        FROM public.appointments a
        WHERE a.barber_id = barber_rec.id
          AND a.is_overbooking = false
          AND a.status NOT IN ('cancelled')
          AND a.starts_at < day_bounds.day_start + (w_end || ' minutes')::INTERVAL
          AND a.ends_at > day_bounds.day_start + (w_start || ' minutes')::INTERVAL
        ORDER BY 1
      LOOP
        busy_start := busy.start_min;
        busy_end := busy.end_min;

        IF busy_start > cursor_min THEN
          v_gap_start := day_bounds.day_start + (cursor_min || ' minutes')::INTERVAL;
          v_gap_end := day_bounds.day_start + (busy_start || ' minutes')::INTERVAL;
          IF v_gap_end > now() THEN
            IF v_gap_start < now() THEN
              v_gap_start := now();
            END IF;
            IF v_gap_end > v_gap_start THEN
              barber_id := barber_rec.id;
              barber_name := barber_rec.name;
              gap_start := v_gap_start;
              gap_end := v_gap_end;
              duration_minutes := GREATEST(
                1,
                ROUND(EXTRACT(EPOCH FROM (v_gap_end - v_gap_start)) / 60.0)::INTEGER
              );
              RETURN NEXT;
            END IF;
          END IF;
        END IF;

        cursor_min := GREATEST(cursor_min, busy_end);
      END LOOP;

      IF cursor_min < w_end THEN
        v_gap_start := day_bounds.day_start + (cursor_min || ' minutes')::INTERVAL;
        v_gap_end := day_bounds.day_start + (w_end || ' minutes')::INTERVAL;
        IF v_gap_end > now() THEN
          IF v_gap_start < now() THEN
            v_gap_start := now();
          END IF;
          IF v_gap_end > v_gap_start THEN
            barber_id := barber_rec.id;
            barber_name := barber_rec.name;
            gap_start := v_gap_start;
            gap_end := v_gap_end;
            duration_minutes := GREATEST(
              1,
              ROUND(EXTRACT(EPOCH FROM (v_gap_end - v_gap_start)) / 60.0)::INTEGER
            );
            RETURN NEXT;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

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

  IF p_starts_at < now() THEN
    RAISE EXCEPTION 'No se pueden crear turnos en el pasado';
  END IF;

  IF NOT private.barber_range_is_open(p_barber_id, p_starts_at, v_ends_at) THEN
    RAISE EXCEPTION 'El horario está fuera del horario de atención o el día está cerrado';
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
  v_new_ends TIMESTAMPTZ;
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

  IF p_new_starts_at < now() THEN
    RAISE EXCEPTION 'No se pueden reprogramar turnos al pasado';
  END IF;

  v_new_ends := p_new_starts_at + (v_appt.total_duration_minutes || ' minutes')::interval;

  IF NOT private.barber_range_is_open(v_appt.barber_id, p_new_starts_at, v_new_ends) THEN
    RAISE EXCEPTION 'El horario está fuera del horario de atención o el día está cerrado';
  END IF;

  IF v_appt.is_overbooking THEN
    UPDATE public.appointments
    SET
      starts_at = p_new_starts_at,
      ends_at = v_new_ends,
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
        AND a.starts_at < v_new_ends
        AND a.ends_at > p_new_starts_at
    ) THEN
      RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_appt.barber_id::text || v_date::text));

  UPDATE public.appointments
  SET
    starts_at = p_new_starts_at,
    ends_at = v_new_ends,
    attendance_status = 'rescheduled',
    updated_at = now()
  WHERE id = p_appointment_id;
END;
$$;

