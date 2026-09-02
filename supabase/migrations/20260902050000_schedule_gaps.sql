-- Huecos libres en la agenda (sin subdividir por duración de servicio).

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
          barber_id := barber_rec.id;
          barber_name := barber_rec.name;
          gap_start := day_bounds.day_start + (cursor_min || ' minutes')::INTERVAL;
          gap_end := day_bounds.day_start + (busy_start || ' minutes')::INTERVAL;
          duration_minutes := busy_start - cursor_min;
          RETURN NEXT;
        END IF;

        cursor_min := GREATEST(cursor_min, busy_end);
      END LOOP;

      IF cursor_min < w_end THEN
        barber_id := barber_rec.id;
        barber_name := barber_rec.name;
        gap_start := day_bounds.day_start + (cursor_min || ' minutes')::INTERVAL;
        gap_end := day_bounds.day_start + (w_end || ' minutes')::INTERVAL;
        duration_minutes := w_end - cursor_min;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_schedule_gaps(
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
  v_org_id UUID;
BEGIN
  v_org_id := private.user_organization_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  IF NOT private.is_admin() AND p_barber_id IS NOT NULL AND p_barber_id <> private.user_barber_id() THEN
    RAISE EXCEPTION 'Sin permiso para consultar disponibilidad de otro barbero';
  END IF;

  IF NOT private.is_admin() AND p_barber_id IS NULL THEN
    p_barber_id := private.user_barber_id();
  END IF;

  RETURN QUERY
  SELECT *
  FROM private.get_schedule_gaps(v_org_id, p_date, p_barber_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_schedule_gaps(DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_schedule_gaps(UUID, DATE, UUID) TO authenticated, service_role;
