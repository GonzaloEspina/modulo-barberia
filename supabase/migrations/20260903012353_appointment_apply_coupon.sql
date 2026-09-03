-- Apply claimed reward codes (coupons) to appointments.
-- Staff can pick a client's available coupon instead of typing the code.

CREATE UNIQUE INDEX IF NOT EXISTS redemptions_appointment_unique
  ON public.redemptions (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.staff_can_access_client(p_client_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = p_client_id
        AND c.organization_id = p_org_id
        AND c.deleted_at IS NULL
    )
    AND (
      private.is_admin()
      OR private.user_barber_id() IS NOT NULL
    );
$$;

CREATE OR REPLACE FUNCTION private.apply_redemption_to_appointment(
  p_appointment_id UUID,
  p_redemption_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_appt public.appointments%ROWTYPE;
  v_red public.redemptions%ROWTYPE;
  v_reward public.rewards%ROWTYPE;
  v_discount NUMERIC(12,2) := 0;
  v_paid NUMERIC(12,2);
  v_new_total NUMERIC(12,2);
  v_new_status public.redemption_status;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede aplicar un cupón a un turno cancelado';
  END IF;

  IF NOT private.is_admin() AND v_appt.barber_id <> private.user_barber_id() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.redemptions r
    WHERE r.appointment_id = v_appt.id
  ) THEN
    RAISE EXCEPTION 'Este turno ya tiene un cupón aplicado';
  END IF;

  SELECT * INTO v_red
  FROM public.redemptions
  WHERE id = p_redemption_id
    AND organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupón no encontrado';
  END IF;

  IF v_red.client_id <> v_appt.client_id THEN
    RAISE EXCEPTION 'El cupón no pertenece a este cliente';
  END IF;

  IF v_red.status NOT IN ('requested', 'approved') OR v_red.appointment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este cupón ya no está disponible';
  END IF;

  SELECT * INTO v_reward FROM public.rewards WHERE id = v_red.reward_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premio no encontrado';
  END IF;

  IF v_reward.reward_type = 'percentage_discount' THEN
    v_discount := ROUND(v_appt.subtotal * COALESCE(v_reward.value, 0) / 100.0, 2);
  ELSIF v_reward.reward_type = 'fixed_discount' THEN
    v_discount := COALESCE(v_reward.value, 0);
  ELSIF v_reward.reward_type = 'free_service' THEN
    SELECT aps.price_applied INTO v_discount
    FROM public.appointment_services aps
    WHERE aps.appointment_id = v_appt.id
      AND aps.service_id = v_reward.service_id
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Este cupón es para un servicio que no está en el turno';
    END IF;
  ELSE
    v_discount := 0;
  END IF;

  v_discount := LEAST(GREATEST(v_discount, 0), v_appt.subtotal);

  v_new_status := CASE
    WHEN v_reward.reward_type IN ('percentage_discount', 'fixed_discount', 'free_service')
      THEN 'used'::public.redemption_status
    ELSE 'delivered'::public.redemption_status
  END;

  IF v_appt.client_membership_id IS NULL AND v_discount > 0 THEN
    v_new_total := GREATEST(v_appt.subtotal - v_discount, 0);
    v_paid := private.appointment_paid_total(v_appt.id);
    IF v_paid > v_new_total THEN
      RAISE EXCEPTION 'El turno ya tiene pagos mayores al total con descuento';
    END IF;

    UPDATE public.appointments
    SET
      discount_amount = v_discount,
      total_amount = v_new_total,
      updated_at = now()
    WHERE id = v_appt.id;
  END IF;

  UPDATE public.redemptions
  SET
    appointment_id = v_appt.id,
    status = v_new_status,
    delivered_at = CASE WHEN v_new_status = 'delivered' THEN now() ELSE delivered_at END,
    delivered_by = CASE WHEN v_new_status = 'delivered' THEN auth.uid() ELSE delivered_by END,
    approved_by = COALESCE(approved_by, auth.uid()),
    notes = COALESCE(notes, 'Aplicado al turno'),
    updated_at = now()
  WHERE id = v_red.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_client_available_coupons(p_client_id UUID)
RETURNS TABLE (
  id UUID,
  unique_code TEXT,
  status public.redemption_status,
  reward_name TEXT,
  reward_type public.reward_type,
  value NUMERIC,
  service_id UUID,
  points_used INTEGER
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

  IF NOT private.staff_can_access_client(p_client_id, v_org_id) THEN
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
    rw.service_id,
    r.points_used
  FROM public.redemptions r
  JOIN public.rewards rw ON rw.id = r.reward_id
  WHERE r.client_id = p_client_id
    AND r.organization_id = v_org_id
    AND r.status IN ('requested', 'approved')
    AND r.appointment_id IS NULL
  ORDER BY r.created_at DESC;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.apply_appointment_coupon(
  p_appointment_id UUID,
  p_redemption_id UUID DEFAULT NULL,
  p_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_appt public.appointments%ROWTYPE;
  v_redemption_id UUID;
  v_code TEXT;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  v_redemption_id := p_redemption_id;

  IF v_redemption_id IS NULL THEN
    v_code := upper(trim(COALESCE(p_code, '')));
    IF v_code = '' THEN
      RAISE EXCEPTION 'Seleccioná un cupón o ingresá el código';
    END IF;

    SELECT r.id INTO v_redemption_id
    FROM public.redemptions r
    WHERE r.organization_id = v_org_id
      AND r.client_id = v_appt.client_id
      AND r.unique_code = v_code
    LIMIT 1;

    IF v_redemption_id IS NULL THEN
      RAISE EXCEPTION 'Código inválido para este cliente';
    END IF;
  END IF;

  PERFORM private.apply_redemption_to_appointment(p_appointment_id, v_redemption_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_client_available_coupons(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_coupon(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_appointment_coupon(UUID, UUID, TEXT) TO authenticated;
