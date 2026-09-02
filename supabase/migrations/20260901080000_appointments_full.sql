-- Etapas 8–10: turnos completos, servicios congelados, historial y asistencia

CREATE TYPE public.attendance_status AS ENUM (
  'pending',
  'attended',
  'no_show',
  'cancelled_early',
  'cancelled_late',
  'rescheduled'
);

CREATE TYPE public.creation_channel AS ENUM ('admin', 'barber', 'client_portal', 'import');

ALTER TABLE public.appointments
  ADD COLUMN subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN attendance_status public.attendance_status NOT NULL DEFAULT 'pending',
  ADD COLUMN client_membership_id UUID REFERENCES public.client_memberships(id) ON DELETE SET NULL,
  ADD COLUMN membership_turns_consumed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN overbooking_reason TEXT,
  ADD COLUMN overbooking_created_by UUID REFERENCES auth.users(id),
  ADD COLUMN notes TEXT,
  ADD COLUMN creation_channel public.creation_channel NOT NULL DEFAULT 'admin',
  ADD COLUMN created_by UUID REFERENCES auth.users(id),
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancelled_by UUID REFERENCES auth.users(id),
  ADD COLUMN cancellation_reason TEXT,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (
    status <> 'cancelled'
    AND is_overbooking = false
    AND deleted_at IS NULL
  );

CREATE TABLE public.appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  price_applied NUMERIC(12,2) NOT NULL,
  duration_applied INTEGER NOT NULL CHECK (duration_applied > 0),
  points_applied INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX appointment_services_appointment_idx ON public.appointment_services (appointment_id);

CREATE TABLE public.appointment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  previous_status public.appointment_status,
  new_status public.appointment_status,
  previous_attendance public.attendance_status,
  new_attendance public.attendance_status,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_services_select"
  ON public.appointment_services FOR SELECT
  TO authenticated
  USING (organization_id = private.user_organization_id());

CREATE POLICY "appointment_status_history_select"
  ON public.appointment_status_history FOR SELECT
  TO authenticated
  USING (organization_id = private.user_organization_id());

CREATE POLICY "appointments_insert_admin"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "appointments_insert_barber"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND barber_id = private.user_barber_id()
  );

CREATE POLICY "appointments_update_admin"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "appointments_update_barber"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (barber_id = private.user_barber_id())
  WITH CHECK (barber_id = private.user_barber_id());

CREATE OR REPLACE FUNCTION private.log_appointment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.attendance_status IS DISTINCT FROM OLD.attendance_status
  ) THEN
    INSERT INTO public.appointment_status_history (
      organization_id, appointment_id,
      previous_status, new_status,
      previous_attendance, new_attendance,
      changed_by
    ) VALUES (
      NEW.organization_id, NEW.id,
      OLD.status, NEW.status,
      OLD.attendance_status, NEW.attendance_status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_status_history_trg
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION private.log_appointment_status_change();

CREATE OR REPLACE FUNCTION private.create_appointment(
  p_client_id UUID,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_client_membership_id UUID DEFAULT NULL,
  p_is_overbooking BOOLEAN DEFAULT false,
  p_overbooking_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_creation_channel public.creation_channel DEFAULT 'admin'
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
  v_duration INTEGER := 0;
  v_points INTEGER := 0;
  v_ends_at TIMESTAMPTZ;
  v_sort INTEGER := 0;
  v_membership public.client_memberships%ROWTYPE;
  v_total NUMERIC(12,2);
  v_date DATE;
  v_slot_available BOOLEAN;
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
    v_duration := v_duration + v_eff.duration_minutes;
    v_points := v_points + v_eff.points_awarded;
  END LOOP;

  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;
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

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_client_id UUID,
  p_barber_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_service_ids UUID[],
  p_client_membership_id UUID DEFAULT NULL,
  p_is_overbooking BOOLEAN DEFAULT false,
  p_overbooking_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN private.create_appointment(
    p_client_id, p_barber_id, p_starts_at, p_service_ids,
    p_client_membership_id, p_is_overbooking, p_overbooking_reason, p_notes, 'admin'
  );
END;
$$;

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
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = p_reason,
    updated_at = now()
  WHERE id = p_appointment_id;

  IF v_appt.client_membership_id IS NOT NULL AND v_appt.membership_turns_consumed > 0
     AND v_appt.status IN ('pending', 'confirmed') THEN
    UPDATE public.client_memberships
    SET
      appointments_remaining = appointments_remaining + v_appt.membership_turns_consumed,
      status = CASE
        WHEN status IN ('exhausted', 'expired') AND expires_at >= CURRENT_DATE THEN 'active'::public.client_membership_status
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

  UPDATE public.appointments
  SET
    status = COALESCE(p_status, status),
    attendance_status = COALESCE(p_attendance, attendance_status),
    updated_at = now()
  WHERE id = p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointment(UUID, UUID, TIMESTAMPTZ, UUID[], UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_appointment_status(UUID, public.appointment_status, public.attendance_status) TO authenticated;
