-- Portal: turnos consultables siempre; reserva solo si can_client_book_portal.

CREATE OR REPLACE FUNCTION private.assert_portal_can_book(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_client_book_portal(p_client_id) THEN
    RAISE EXCEPTION 'No tenés permiso para reservar online';
  END IF;
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
  v_client public.clients%ROWTYPE;
  v_mode public.portal_booking_mode;
  v_result JSONB;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  SELECT * INTO v_client FROM public.clients WHERE id = v_client_id;

  SELECT (settings->>'portal_booking_mode')::public.portal_booking_mode
  INTO v_mode
  FROM public.organizations WHERE id = v_org_id;

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
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

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
  v_client_id UUID;
  v_org_id UUID;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  PERFORM private.assert_portal_can_book(v_client_id);

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
  v_client_id UUID;
  v_org_id UUID;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  PERFORM private.assert_portal_can_book(v_client_id);

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
  v_client_id UUID;
  v_org_id UUID;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  PERFORM private.assert_portal_can_book(v_client_id);

  RETURN QUERY
  SELECT s.barber_id, s.barber_name, s.slot_start, s.slot_end, s.total_duration_minutes
  FROM private.get_available_slots(v_org_id, p_date, p_service_ids, p_barber_id, NULL) s;
END;
$$;
