-- Etapa 11: métodos de pago y pagos

CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded');
CREATE TYPE public.discount_type AS ENUM ('none', 'percentage', 'fixed');

CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  discount_type public.discount_type NOT NULL DEFAULT 'none',
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  auto_apply_discount BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  discount_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  receipt_url TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_appointment_idx ON public.payments (appointment_id);

CREATE TRIGGER payment_methods_set_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_methods_admin"
  ON public.payment_methods FOR ALL
  TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "payments_select"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND (private.is_admin() OR barber_id = private.user_barber_id())
  );

CREATE OR REPLACE FUNCTION private.appointment_paid_total(p_appointment_id UUID)
RETURNS NUMERIC(12,2)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.payments
  WHERE appointment_id = p_appointment_id
    AND deleted_at IS NULL
    AND status <> 'refunded';
$$;

CREATE OR REPLACE FUNCTION private.calculate_method_discount(
  p_method_id UUID,
  p_subtotal NUMERIC(12,2)
)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_method public.payment_methods%ROWTYPE;
  v_discount NUMERIC(12,2) := 0;
BEGIN
  SELECT * INTO v_method FROM public.payment_methods WHERE id = p_method_id;
  IF NOT FOUND OR NOT v_method.auto_apply_discount THEN
    RETURN 0;
  END IF;

  v_discount := CASE v_method.discount_type
    WHEN 'percentage' THEN ROUND(p_subtotal * v_method.discount_value / 100, 2)
    WHEN 'fixed' THEN v_method.discount_value
    ELSE 0
  END;

  RETURN LEAST(GREATEST(v_discount, 0), p_subtotal);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_payment(
  p_appointment_id UUID,
  p_payment_method_id UUID,
  p_amount NUMERIC(12,2),
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_paid NUMERIC(12,2);
  v_pending NUMERIC(12,2);
  v_discount NUMERIC(12,2);
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND organization_id = private.user_organization_id()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  IF NOT private.is_admin() THEN
    IF v_appt.barber_id <> private.user_barber_id() THEN
      RAISE EXCEPTION 'Sin permiso';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (permissions->>'can_register_payments')::boolean IS TRUE
    ) THEN
      RAISE EXCEPTION 'Sin permiso para registrar pagos';
    END IF;
  END IF;

  v_paid := private.appointment_paid_total(p_appointment_id);
  v_pending := GREATEST(v_appt.total_amount - v_paid, 0);

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  IF p_amount > v_pending THEN
    RAISE EXCEPTION 'El monto excede el saldo pendiente (%).', v_pending;
  END IF;

  v_discount := private.calculate_method_discount(p_payment_method_id, v_appt.subtotal);

  INSERT INTO public.payments (
    organization_id, appointment_id, client_id, barber_id,
    amount, discount_applied, payment_method_id, status, paid_at, notes, recorded_by
  ) VALUES (
    v_appt.organization_id, v_appt.id, v_appt.client_id, v_appt.barber_id,
    p_amount, v_discount, p_payment_method_id,
    CASE WHEN p_amount >= v_pending THEN 'paid'::public.payment_status ELSE 'partial'::public.payment_status END,
    p_paid_at, p_notes, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_payment(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_appointment_payment_summary(p_appointment_id UUID)
RETURNS TABLE (
  total_amount NUMERIC(12,2),
  paid_amount NUMERIC(12,2),
  pending_amount NUMERIC(12,2),
  payment_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(12,2);
  v_paid NUMERIC(12,2);
BEGIN
  SELECT a.total_amount INTO v_total
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.organization_id = private.user_organization_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado';
  END IF;

  v_paid := private.appointment_paid_total(p_appointment_id);

  RETURN QUERY SELECT
    v_total,
    v_paid,
    GREATEST(v_total - v_paid, 0),
    CASE
      WHEN v_total <= 0 THEN 'paid'
      WHEN v_paid <= 0 THEN 'pending'
      WHEN v_paid < v_total THEN 'partial'
      ELSE 'paid'
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_payment_summary(UUID) TO authenticated;
