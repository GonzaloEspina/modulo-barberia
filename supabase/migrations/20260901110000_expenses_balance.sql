-- Etapas 15–16: gastos, balance y configuración inasistencias

CREATE TYPE public.expense_type AS ENUM ('general', 'from_fixed');
CREATE TYPE public.absence_rule_type AS ENUM ('consecutive', 'within_period');
CREATE TYPE public.absence_period_unit AS ENUM ('days', 'weeks', 'months');

CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  imputation_day INTEGER NOT NULL CHECK (imputation_day BETWEEN 1 AND 28),
  start_date DATE NOT NULL,
  end_date DATE,
  auto_generate BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  expense_type public.expense_type NOT NULL DEFAULT 'general',
  fixed_expense_id UUID REFERENCES public.fixed_expenses(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  receipt_url TEXT,
  notes TEXT,
  idempotency_key TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.absence_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE RESTRICT,
  threshold_count INTEGER NOT NULL DEFAULT 3,
  rule_type public.absence_rule_type NOT NULL DEFAULT 'within_period',
  period_value INTEGER NOT NULL DEFAULT 3,
  period_unit public.absence_period_unit NOT NULL DEFAULT 'months',
  counting_statuses public.attendance_status[] NOT NULL DEFAULT '{no_show}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER fixed_expenses_set_updated_at
  BEFORE UPDATE ON public.fixed_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER absence_config_set_updated_at
  BEFORE UPDATE ON public.absence_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_categories_admin"
  ON public.expense_categories FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "fixed_expenses_admin"
  ON public.fixed_expenses FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "expenses_admin"
  ON public.expenses FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "absence_config_admin"
  ON public.absence_config FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE OR REPLACE FUNCTION public.generate_fixed_expenses(p_period DATE DEFAULT date_trunc('month', CURRENT_DATE)::date)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER := 0;
  fe RECORD;
  v_key TEXT;
  v_expense_date DATE;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  FOR fe IN
    SELECT * FROM public.fixed_expenses
    WHERE organization_id = v_org_id AND is_active = true AND auto_generate = true
  LOOP
    v_expense_date := make_date(
      EXTRACT(YEAR FROM p_period)::INTEGER,
      EXTRACT(MONTH FROM p_period)::INTEGER,
      fe.imputation_day
    );

    IF v_expense_date < fe.start_date OR (fe.end_date IS NOT NULL AND v_expense_date > fe.end_date) THEN
      CONTINUE;
    END IF;

    v_key := fe.id::text || '-' || to_char(p_period, 'YYYY-MM');

    INSERT INTO public.expenses (
      organization_id, category_id, description, amount, expense_date,
      expense_type, fixed_expense_id, idempotency_key
    ) VALUES (
      v_org_id, fe.category_id, fe.name, fe.amount, v_expense_date,
      'from_fixed', fe.id, v_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_balance_summary(
  p_from DATE,
  p_to DATE,
  p_barber_id UUID DEFAULT NULL
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
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Sin organización'; END IF;

  IF NOT private.is_admin() THEN
    p_barber_id := private.user_barber_id();
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(a.total_amount)
      FROM public.appointments a
      WHERE a.organization_id = v_org_id
        AND a.status <> 'cancelled'
        AND a.starts_at >= p_from::timestamptz
        AND a.starts_at < (p_to + 1)::timestamptz
        AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
    ), 0),
    COALESCE((
      SELECT SUM(p.amount)
      FROM public.payments p
      WHERE p.organization_id = v_org_id
        AND p.deleted_at IS NULL
        AND p.status <> 'refunded'
        AND p.paid_at >= p_from::timestamptz
        AND p.paid_at < (p_to + 1)::timestamptz
        AND (p_barber_id IS NULL OR p.barber_id = p_barber_id)
    ), 0),
    COALESCE((
      SELECT SUM(e.amount)
      FROM public.expenses e
      WHERE e.organization_id = v_org_id
        AND e.deleted_at IS NULL
        AND e.expense_date BETWEEN p_from AND p_to
        AND (p_barber_id IS NULL OR e.barber_id = p_barber_id OR e.barber_id IS NULL)
    ), 0),
    COALESCE((
      SELECT SUM(p.amount)
      FROM public.payments p
      WHERE p.organization_id = v_org_id
        AND p.deleted_at IS NULL
        AND p.status <> 'refunded'
        AND p.paid_at >= p_from::timestamptz
        AND p.paid_at < (p_to + 1)::timestamptz
        AND (p_barber_id IS NULL OR p.barber_id = p_barber_id)
    ), 0) - COALESCE((
      SELECT SUM(e.amount)
      FROM public.expenses e
      WHERE e.organization_id = v_org_id
        AND e.deleted_at IS NULL
        AND e.expense_date BETWEEN p_from AND p_to
        AND (p_barber_id IS NULL OR e.barber_id = p_barber_id OR e.barber_id IS NULL)
    ), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_fixed_expenses(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance_summary(DATE, DATE, UUID) TO authenticated;
