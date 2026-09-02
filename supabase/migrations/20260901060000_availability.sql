-- Etapa 7: motor de disponibilidad (tabla mínima de turnos + funciones SQL)

CREATE TYPE public.appointment_status AS ENUM (
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  total_duration_minutes INTEGER NOT NULL CHECK (total_duration_minutes > 0),
  status public.appointment_status NOT NULL DEFAULT 'pending',
  is_overbooking BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_order CHECK (starts_at < ends_at)
);

CREATE INDEX appointments_barber_starts_idx ON public.appointments (barber_id, starts_at);
CREATE INDEX appointments_org_starts_idx ON public.appointments (organization_id, starts_at);

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_admin"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "appointments_select_own_barber"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (barber_id = private.user_barber_id());

-- ---------------------------------------------------------------------------
-- Helpers de horario (minutos desde medianoche, ISO 1=Lunes)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.iso_day_of_week(p_date DATE)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(ISODOW FROM p_date)::INTEGER;
$$;

CREATE OR REPLACE FUNCTION private.time_to_minutes(p_time TIME)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (EXTRACT(HOUR FROM p_time)::INTEGER * 60) + EXTRACT(MINUTE FROM p_time)::INTEGER;
$$;

CREATE OR REPLACE FUNCTION private.minutes_to_time(p_minutes INTEGER)
RETURNS TIME
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT make_time(p_minutes / 60, p_minutes % 60, 0);
$$;

CREATE OR REPLACE FUNCTION private.local_day_bounds(
  p_date DATE,
  p_timezone TEXT
)
RETURNS TABLE (day_start TIMESTAMPTZ, day_end TIMESTAMPTZ)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (p_date::TIMESTAMP AT TIME ZONE p_timezone),
    ((p_date + 1)::TIMESTAMP AT TIME ZONE p_timezone);
$$;

CREATE OR REPLACE FUNCTION private.get_barber_base_windows(
  p_barber_id UUID,
  p_date DATE
)
RETURNS TABLE (start_minute INTEGER, end_minute INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barber public.barbers%ROWTYPE;
  v_dow INTEGER;
  v_has_barber_rows BOOLEAN;
  v_has_closed_day BOOLEAN;
BEGIN
  SELECT * INTO v_barber
  FROM public.barbers
  WHERE id = p_barber_id
    AND deleted_at IS NULL
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_dow := private.iso_day_of_week(p_date);

  SELECT EXISTS (
    SELECT 1 FROM public.barber_schedules bs
    WHERE bs.barber_id = p_barber_id
      AND bs.day_of_week = v_dow
      AND bs.is_active = true
  ) INTO v_has_barber_rows;

  IF v_has_barber_rows THEN
    SELECT EXISTS (
      SELECT 1 FROM public.barber_schedules bs
      WHERE bs.barber_id = p_barber_id
        AND bs.day_of_week = v_dow
        AND bs.is_active = true
        AND bs.is_working_day = false
    ) INTO v_has_closed_day;

    IF v_has_closed_day THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      private.time_to_minutes(bs.start_time),
      private.time_to_minutes(bs.end_time)
    FROM public.barber_schedules bs
    WHERE bs.barber_id = p_barber_id
      AND bs.day_of_week = v_dow
      AND bs.is_active = true
      AND bs.is_working_day = true
    ORDER BY bs.start_time;

    RETURN;
  END IF;

  IF v_barber.use_general_schedules THEN
    RETURN QUERY
    SELECT
      private.time_to_minutes(gs.start_time),
      private.time_to_minutes(gs.end_time)
    FROM public.general_schedules gs
    WHERE gs.organization_id = v_barber.organization_id
      AND gs.day_of_week = v_dow
      AND gs.is_active = true
    ORDER BY gs.start_time;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.subtract_minute_range(
  p_windows INTEGER[],
  p_start INTEGER,
  p_end INTEGER
)
RETURNS INTEGER[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result INTEGER[] := '{}';
  i INTEGER;
  w_start INTEGER;
  w_end INTEGER;
BEGIN
  IF p_windows IS NULL OR array_length(p_windows, 1) IS NULL THEN
    RETURN result;
  END IF;

  FOR i IN 1..array_length(p_windows, 1) BY 2 LOOP
    w_start := p_windows[i];
    w_end := p_windows[i + 1];

    IF p_end <= w_start OR p_start >= w_end THEN
      result := result || ARRAY[w_start, w_end];
      CONTINUE;
    END IF;

    IF p_start > w_start THEN
      result := result || ARRAY[w_start, LEAST(p_start, w_end)];
    END IF;

    IF p_end < w_end THEN
      result := result || ARRAY[GREATEST(p_end, w_start), w_end];
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_schedule_exceptions_to_windows(
  p_barber_id UUID,
  p_org_id UUID,
  p_date DATE,
  p_windows INTEGER[]
)
RETURNS INTEGER[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_windows INTEGER[] := COALESCE(p_windows, '{}');
  ex RECORD;
  ex_start INTEGER;
  ex_end INTEGER;
BEGIN
  FOR ex IN
    SELECT *
    FROM public.schedule_exceptions se
    WHERE se.organization_id = p_org_id
      AND se.is_active = true
      AND p_date BETWEEN se.start_date AND se.end_date
      AND (
        se.scope = 'organization'
        OR se.barber_id = p_barber_id
      )
    ORDER BY se.exception_type DESC, se.start_time NULLS FIRST
  LOOP
    IF ex.start_time IS NULL THEN
      ex_start := 0;
      ex_end := 24 * 60;
    ELSE
      ex_start := private.time_to_minutes(ex.start_time);
      ex_end := private.time_to_minutes(ex.end_time);
    END IF;

    IF ex.exception_type = 'block' THEN
      v_windows := private.subtract_minute_range(v_windows, ex_start, ex_end);
    ELSIF ex.exception_type = 'allow' THEN
      v_windows := v_windows || ARRAY[ex_start, ex_end];
    END IF;
  END LOOP;

  RETURN v_windows;
END;
$$;

CREATE OR REPLACE FUNCTION private.barber_can_perform_services(
  p_barber_id UUID,
  p_service_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc_id UUID;
  eff RECORD;
BEGIN
  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL THEN
    RETURN false;
  END IF;

  FOREACH svc_id IN ARRAY p_service_ids LOOP
    SELECT * INTO eff FROM private.get_effective_service(p_barber_id, svc_id);
    IF NOT FOUND OR eff.is_available IS DISTINCT FROM true THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.sum_effective_service_duration(
  p_barber_id UUID,
  p_service_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc_id UUID;
  eff RECORD;
  total INTEGER := 0;
BEGIN
  FOREACH svc_id IN ARRAY p_service_ids LOOP
    SELECT * INTO eff FROM private.get_effective_service(p_barber_id, svc_id);
    IF NOT FOUND OR eff.is_available IS DISTINCT FROM true THEN
      RETURN NULL;
    END IF;
    total := total + eff.duration_minutes;
  END LOOP;

  RETURN total;
END;
$$;

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

  SELECT * INTO day_bounds FROM private.local_day_bounds(p_date, v_timezone);

  FOR barber_rec IN
    SELECT b.id, b.name
    FROM public.barbers b
    WHERE b.organization_id = p_org_id
      AND b.deleted_at IS NULL
      AND b.is_active = true
      AND (p_barber_id IS NULL OR b.id = p_barber_id)
      AND private.barber_can_perform_services(b.id, p_service_ids)
    ORDER BY b.display_order, b.name
  LOOP
    v_duration := private.sum_effective_service_duration(barber_rec.id, p_service_ids);
    IF v_duration IS NULL OR v_duration <= 0 THEN
      CONTINUE;
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

REVOKE ALL ON FUNCTION private.get_available_slots(UUID, DATE, UUID[], UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_available_slots(UUID, DATE, UUID[], UUID, INTEGER) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_available_slots(
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
  FROM private.get_available_slots(v_org_id, p_date, p_service_ids, p_barber_id, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(DATE, UUID[], UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION private.iso_day_of_week(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.time_to_minutes(TIME) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_barber_base_windows(UUID, DATE) TO authenticated, service_role;
