-- Simplify appointment statuses to Pendiente / Asistió / No asistió / Cancelado.
-- Internal values: pending, completed (Asistió), no_show, cancelled.
-- Cancelled appointments must free the assigned slot (status = cancelled is
-- already excluded from overlap + availability); this also syncs attendance
-- and hides cancelled from occupying the calendar via the status itself.

UPDATE public.appointments
SET status = 'pending'::public.appointment_status
WHERE status IN ('confirmed', 'in_progress');

UPDATE public.appointments
SET status = 'no_show'::public.appointment_status
WHERE status = 'completed'
  AND attendance_status = 'no_show';

UPDATE public.appointments
SET status = 'pending'::public.appointment_status
WHERE status = 'completed'
  AND attendance_status = 'pending'
  AND starts_at >= now();

UPDATE public.appointments
SET attendance_status = 'attended'::public.attendance_status
WHERE status = 'completed'
  AND attendance_status = 'pending';

UPDATE public.organizations
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{default_appointment_status}',
  '"pending"'
)
WHERE COALESCE(settings->>'default_appointment_status', 'pending')
  NOT IN ('pending', 'completed', 'no_show', 'cancelled');

CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_appointment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND organization_id = private.user_organization_id()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  IF NOT private.is_admin() AND v_appt.barber_id <> private.user_barber_id() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF v_appt.status = 'cancelled' THEN
    RETURN;
  END IF;

  UPDATE public.appointments
  SET
    status = 'cancelled',
    attendance_status = CASE
      WHEN attendance_status IN ('cancelled_early', 'cancelled_late') THEN attendance_status
      ELSE 'cancelled_early'::public.attendance_status
    END,
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = p_reason,
    updated_at = now()
  WHERE id = p_appointment_id;

  IF v_appt.client_membership_id IS NOT NULL
     AND v_appt.membership_turns_consumed > 0
     AND v_appt.status IN ('pending', 'confirmed', 'in_progress') THEN
    UPDATE public.client_memberships
    SET
      appointments_remaining = appointments_remaining + v_appt.membership_turns_consumed,
      status = CASE
        WHEN status IN ('exhausted', 'expired') AND expires_at >= CURRENT_DATE
          THEN 'active'::public.client_membership_status
        ELSE status
      END,
      updated_at = now()
    WHERE id = v_appt.client_membership_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_appointment_status(
  p_appointment_id UUID,
  p_status public.appointment_status DEFAULT NULL,
  p_attendance public.attendance_status DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_status public.appointment_status;
  v_attendance public.attendance_status;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND organization_id = private.user_organization_id()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  IF NOT private.is_admin() AND v_appt.barber_id <> private.user_barber_id() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  v_status := COALESCE(p_status, v_appt.status);

  IF p_status IS NULL AND p_attendance IS NOT NULL THEN
    v_status := CASE p_attendance
      WHEN 'attended' THEN 'completed'::public.appointment_status
      WHEN 'no_show' THEN 'no_show'::public.appointment_status
      WHEN 'cancelled_early' THEN 'cancelled'::public.appointment_status
      WHEN 'cancelled_late' THEN 'cancelled'::public.appointment_status
      ELSE 'pending'::public.appointment_status
    END;
  END IF;

  IF v_status IN ('confirmed', 'in_progress') THEN
    v_status := 'pending';
  END IF;

  IF v_status = 'cancelled' AND v_appt.status <> 'cancelled' THEN
    PERFORM public.cancel_appointment(p_appointment_id, 'Cancelado desde el detalle del turno');
    RETURN;
  END IF;

  v_attendance := CASE v_status
    WHEN 'completed' THEN 'attended'::public.attendance_status
    WHEN 'no_show' THEN 'no_show'::public.attendance_status
    WHEN 'cancelled' THEN CASE
      WHEN v_appt.attendance_status IN ('cancelled_early', 'cancelled_late')
        THEN v_appt.attendance_status
      ELSE 'cancelled_early'::public.attendance_status
    END
    ELSE 'pending'::public.attendance_status
  END;

  UPDATE public.appointments
  SET
    status = v_status,
    attendance_status = v_attendance,
    cancelled_at = CASE WHEN v_status = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE NULL END,
    cancelled_by = CASE WHEN v_status = 'cancelled' THEN cancelled_by ELSE NULL END,
    cancellation_reason = CASE WHEN v_status = 'cancelled' THEN cancellation_reason ELSE NULL END,
    updated_at = now()
  WHERE id = p_appointment_id;
END;
$$;
