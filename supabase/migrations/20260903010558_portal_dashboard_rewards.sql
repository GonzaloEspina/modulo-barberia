-- Portal dashboard: include available rewards so clients can see
-- which redemptions they can make with their current points.

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
