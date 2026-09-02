-- Etapa 11b: planes e instancias de membresía

CREATE TYPE public.client_membership_status AS ENUM (
  'pending_payment',
  'active',
  'exhausted',
  'expired',
  'cancelled'
);

CREATE TABLE public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  appointments_included INTEGER NOT NULL CHECK (appointments_included > 0),
  validity_months INTEGER NOT NULL CHECK (validity_months > 0),
  allowed_service_ids UUID[],
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.client_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  membership_plan_id UUID REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  price_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  appointments_total INTEGER NOT NULL CHECK (appointments_total > 0),
  appointments_remaining INTEGER NOT NULL CHECK (appointments_remaining >= 0),
  payment_confirmed BOOLEAN NOT NULL DEFAULT false,
  starts_at DATE NOT NULL,
  expires_at DATE NOT NULL,
  status public.client_membership_status NOT NULL DEFAULT 'pending_payment',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purchased_by UUID REFERENCES auth.users(id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_memberships_client_status_idx
  ON public.client_memberships (client_id, status)
  WHERE status = 'active';

CREATE TRIGGER membership_plans_set_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER client_memberships_set_updated_at
  BEFORE UPDATE ON public.client_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION private.membership_expires_at(p_starts_at DATE, p_validity_months INTEGER)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    date_trunc('month', p_starts_at + (p_validity_months || ' months')::interval)::date
    + interval '1 month - 1 day'
  )::date;
$$;

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_plans_admin"
  ON public.membership_plans FOR ALL
  TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "client_memberships_admin"
  ON public.client_memberships FOR ALL
  TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE OR REPLACE FUNCTION public.purchase_client_membership(
  p_client_id UUID,
  p_plan_id UUID,
  p_payment_confirmed BOOLEAN DEFAULT false,
  p_starts_at DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_plan public.membership_plans%ROWTYPE;
  v_id UUID;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT * INTO v_plan
  FROM public.membership_plans
  WHERE id = p_plan_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan no encontrado';
  END IF;

  INSERT INTO public.client_memberships (
    organization_id, client_id, membership_plan_id, plan_name, price_paid,
    appointments_total, appointments_remaining, payment_confirmed,
    starts_at, expires_at, status, purchased_by
  ) VALUES (
    v_org_id,
    p_client_id,
    v_plan.id,
    v_plan.name,
    v_plan.price,
    v_plan.appointments_included,
    v_plan.appointments_included,
    p_payment_confirmed,
    p_starts_at,
    private.membership_expires_at(p_starts_at, v_plan.validity_months),
    CASE WHEN p_payment_confirmed THEN 'active'::public.client_membership_status ELSE 'pending_payment'::public.client_membership_status END,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_client_membership(UUID, UUID, BOOLEAN, DATE) TO authenticated;
