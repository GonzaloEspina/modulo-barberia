-- Include sold memberships in production and cash (when paid).
-- Memberships are org-level sales: they are omitted when filtering by
-- barber, service or payment method.

CREATE OR REPLACE FUNCTION public.get_balance_summary(
  p_from DATE,
  p_to DATE,
  p_barber_id UUID DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_payment_method_id UUID DEFAULT NULL
)
RETURNS TABLE (
  production NUMERIC(12,2),
  cash NUMERIC(12,2),
  expenses NUMERIC(12,2),
  net_profit NUMERIC(12,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_membership_production NUMERIC(12,2) := 0;
  v_membership_cash NUMERIC(12,2) := 0;
  v_appointment_production NUMERIC(12,2) := 0;
  v_payments_cash NUMERIC(12,2) := 0;
  v_expenses NUMERIC(12,2) := 0;
  v_include_memberships BOOLEAN;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Sin organización'; END IF;

  IF NOT private.is_admin() THEN
    p_barber_id := private.user_barber_id();
  END IF;

  v_include_memberships := p_barber_id IS NULL AND p_service_id IS NULL AND p_payment_method_id IS NULL;

  SELECT COALESCE(SUM(a.total_amount), 0)
  INTO v_appointment_production
  FROM public.appointments a
  WHERE a.organization_id = v_org_id
    AND a.status <> 'cancelled'
    AND a.starts_at >= p_from::timestamptz
    AND a.starts_at < (p_to + 1)::timestamptz
    AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
    AND (
      p_service_id IS NULL OR EXISTS (
        SELECT 1 FROM public.appointment_services s
        WHERE s.appointment_id = a.id AND s.service_id = p_service_id
      )
    );

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_payments_cash
  FROM public.payments p
  WHERE p.organization_id = v_org_id
    AND p.deleted_at IS NULL
    AND p.status <> 'refunded'
    AND p.paid_at >= p_from::timestamptz
    AND p.paid_at < (p_to + 1)::timestamptz
    AND (p_barber_id IS NULL OR p.barber_id = p_barber_id)
    AND (p_payment_method_id IS NULL OR p.payment_method_id = p_payment_method_id);

  SELECT COALESCE(SUM(e.amount), 0)
  INTO v_expenses
  FROM public.expenses e
  WHERE e.organization_id = v_org_id
    AND e.deleted_at IS NULL
    AND e.expense_date BETWEEN p_from AND p_to
    AND (p_barber_id IS NULL OR e.barber_id = p_barber_id OR e.barber_id IS NULL);

  IF v_include_memberships THEN
    SELECT COALESCE(SUM(cm.price_paid), 0)
    INTO v_membership_production
    FROM public.client_memberships cm
    WHERE cm.organization_id = v_org_id
      AND cm.deleted_at IS NULL
      AND cm.status <> 'cancelled'
      AND cm.purchased_at >= p_from::timestamptz
      AND cm.purchased_at < (p_to + 1)::timestamptz;

    SELECT COALESCE(SUM(cm.price_paid), 0)
    INTO v_membership_cash
    FROM public.client_memberships cm
    WHERE cm.organization_id = v_org_id
      AND cm.deleted_at IS NULL
      AND cm.status <> 'cancelled'
      AND cm.payment_confirmed = true
      AND cm.purchased_at >= p_from::timestamptz
      AND cm.purchased_at < (p_to + 1)::timestamptz;
  END IF;

  RETURN QUERY
  SELECT
    v_appointment_production + v_membership_production,
    v_payments_cash + v_membership_cash,
    v_expenses,
    (v_payments_cash + v_membership_cash) - v_expenses;
END;
$$;
