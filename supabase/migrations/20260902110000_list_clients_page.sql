-- Paginated clients list with appointment-based sort and filters

CREATE OR REPLACE FUNCTION public.list_clients_page(
  p_search TEXT DEFAULT '',
  p_offset INT DEFAULT 0,
  p_limit INT DEFAULT 25,
  p_sort TEXT DEFAULT 'name',
  p_warning_only BOOLEAN DEFAULT FALSE,
  p_has_upcoming BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID := private.user_organization_id();
  v_total BIGINT;
  v_rows JSON;
  v_search TEXT := trim(COALESCE(p_search, ''));
  v_digits TEXT := regexp_replace(v_search, '[^0-9]', '', 'g');
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Sin organización';
  END IF;

  IF NOT (private.is_admin() OR private.user_role() = 'barber') THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF p_sort NOT IN ('name', 'next_appointment', 'last_activity') THEN
    RAISE EXCEPTION 'Orden inválido';
  END IF;

  WITH base AS (
    SELECT
      c.id,
      c.organization_id,
      c.first_name,
      c.last_name,
      c.phone_normalized,
      c.phone_display,
      c.nickname,
      c.email,
      c.birth_date,
      c.notes,
      c.manual_warning,
      c.manual_warning_reason,
      c.booking_override,
      c.registered_at,
      c.is_active,
      c.deleted_at,
      c.created_at,
      c.updated_at,
      next_appt.starts_at AS next_appointment_at,
      last_appt.starts_at AS last_activity_at
    FROM public.clients c
    LEFT JOIN LATERAL (
      SELECT a.starts_at
      FROM public.appointments a
      WHERE a.client_id = c.id
        AND a.deleted_at IS NULL
        AND a.status NOT IN ('cancelled', 'no_show')
        AND a.starts_at > now()
      ORDER BY a.starts_at ASC
      LIMIT 1
    ) next_appt ON TRUE
    LEFT JOIN LATERAL (
      SELECT a.starts_at
      FROM public.appointments a
      WHERE a.client_id = c.id
        AND a.deleted_at IS NULL
        AND a.status <> 'cancelled'
      ORDER BY a.starts_at DESC
      LIMIT 1
    ) last_appt ON TRUE
    WHERE c.organization_id = v_org_id
      AND c.deleted_at IS NULL
      AND (NOT p_warning_only OR c.manual_warning = TRUE)
      AND (NOT p_has_upcoming OR next_appt.starts_at IS NOT NULL)
      AND (
        v_search = ''
        OR c.first_name ILIKE '%' || v_search || '%'
        OR c.last_name ILIKE '%' || v_search || '%'
        OR c.nickname ILIKE '%' || v_search || '%'
        OR (
          length(v_digits) >= 3
          AND c.phone_normalized ILIKE '%' || v_digits || '%'
        )
      )
  ),
  counted AS (
    SELECT COUNT(*)::BIGINT AS cnt FROM base
  )
  SELECT cnt INTO v_total FROM counted;

  SELECT COALESCE(json_agg(row_to_json(paged)), '[]'::json)
  INTO v_rows
  FROM (
    SELECT
      id,
      organization_id,
      first_name,
      last_name,
      phone_normalized,
      phone_display,
      nickname,
      email,
      birth_date,
      notes,
      manual_warning,
      manual_warning_reason,
      booking_override,
      registered_at,
      is_active,
      deleted_at,
      created_at,
      updated_at
    FROM base
    ORDER BY
      CASE WHEN p_sort = 'next_appointment' THEN next_appointment_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'last_activity' THEN last_activity_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'name' THEN last_name END ASC,
      CASE WHEN p_sort = 'name' THEN first_name END ASC,
      last_name ASC,
      first_name ASC
    OFFSET GREATEST(p_offset, 0)
    LIMIT GREATEST(p_limit, 1)
  ) paged;

  RETURN json_build_object(
    'total', COALESCE(v_total, 0),
    'clients', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_clients_page TO authenticated;
