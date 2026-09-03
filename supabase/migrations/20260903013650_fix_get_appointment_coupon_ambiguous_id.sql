-- RETURNS TABLE(id ...) makes bare `id` an output variable, so
-- `WHERE id = p_appointment_id` was ambiguous against appointments.id.

CREATE OR REPLACE FUNCTION public.get_appointment_coupon(p_appointment_id UUID)
RETURNS TABLE (
  id UUID,
  unique_code TEXT,
  status public.redemption_status,
  reward_name TEXT,
  reward_type public.reward_type,
  value NUMERIC,
  points_used INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_appt public.appointments%ROWTYPE;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.organization_id = v_org_id
    AND a.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  IF NOT private.is_admin() AND v_appt.barber_id <> private.user_barber_id() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.unique_code,
    r.status,
    rw.name,
    rw.reward_type,
    rw.value,
    r.points_used
  FROM public.redemptions r
  JOIN public.rewards rw ON rw.id = r.reward_id
  WHERE r.appointment_id = p_appointment_id
  LIMIT 1;
END;
$$;
