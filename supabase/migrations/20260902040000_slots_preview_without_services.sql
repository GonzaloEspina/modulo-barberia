-- Vista previa de horarios sin servicios seleccionados: usa el intervalo mínimo de la org
-- y no filtra barberos por servicios (muestra huecos libres en la agenda).

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
