-- Etapas 12–13: puntos, premios y canjes

CREATE TYPE public.point_movement_type AS ENUM (
  'service_credit', 'redemption', 'expiration', 'manual_credit',
  'manual_debit', 'cancellation_reversal', 'redemption_reversal'
);

CREATE TYPE public.point_credit_moment AS ENUM ('on_create', 'on_confirm', 'on_complete', 'on_payment');
CREATE TYPE public.expiration_type AS ENUM ('none', 'days', 'months');
CREATE TYPE public.reward_type AS ENUM (
  'percentage_discount', 'fixed_discount', 'free_service', 'physical_prize', 'custom_benefit'
);
CREATE TYPE public.redemption_status AS ENUM (
  'requested', 'approved', 'used', 'delivered', 'cancelled', 'expired'
);

CREATE TABLE public.points_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  expiration_type public.expiration_type NOT NULL DEFAULT 'months',
  expiration_value INTEGER NOT NULL DEFAULT 12,
  credit_moment public.point_credit_moment NOT NULL DEFAULT 'on_complete',
  require_payment_for_credit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.point_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  redemption_id UUID,
  movement_type public.point_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  points_required INTEGER NOT NULL CHECK (points_required > 0),
  reward_type public.reward_type NOT NULL DEFAULT 'custom_benefit',
  value NUMERIC(12,2),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  stock INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_per_client INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  points_used INTEGER NOT NULL CHECK (points_used > 0),
  unique_code TEXT NOT NULL,
  status public.redemption_status NOT NULL DEFAULT 'requested',
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id),
  delivered_by UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.point_movements
  ADD CONSTRAINT point_movements_redemption_fk
  FOREIGN KEY (redemption_id) REFERENCES public.redemptions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX redemptions_org_code_unique ON public.redemptions (organization_id, unique_code);
CREATE INDEX point_movements_client_idx ON public.point_movements (client_id, created_at DESC);

CREATE TRIGGER points_config_set_updated_at
  BEFORE UPDATE ON public.points_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rewards_set_updated_at
  BEFORE UPDATE ON public.rewards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER redemptions_set_updated_at
  BEFORE UPDATE ON public.redemptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.points_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "points_config_admin"
  ON public.points_config FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "point_movements_admin"
  ON public.point_movements FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "rewards_admin"
  ON public.rewards FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "redemptions_admin"
  ON public.redemptions FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE OR REPLACE FUNCTION public.get_client_point_balance(p_client_id UUID)
RETURNS TABLE (balance INTEGER, next_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(pm.available_quantity), 0)::INTEGER,
    MIN(pm.expires_at) FILTER (WHERE pm.available_quantity > 0 AND pm.expires_at IS NOT NULL)
  FROM public.point_movements pm
  WHERE pm.client_id = p_client_id
    AND pm.organization_id = private.user_organization_id();
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_points(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_cfg public.points_config%ROWTYPE;
  v_points INTEGER := 0;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_cfg FROM public.points_config WHERE organization_id = v_appt.organization_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN; END IF;

  IF v_appt.client_membership_id IS NOT NULL THEN
    IF NOT COALESCE(
      (SELECT (settings->>'membership_credit_points')::boolean FROM public.organizations WHERE id = v_appt.organization_id),
      true
    ) THEN
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(SUM(points_applied), 0) INTO v_points
  FROM public.appointment_services WHERE appointment_id = p_appointment_id;

  IF v_points <= 0 THEN RETURN; END IF;

  v_expires := CASE v_cfg.expiration_type
    WHEN 'days' THEN now() + (v_cfg.expiration_value || ' days')::interval
    WHEN 'months' THEN date_trunc('month', now() + (v_cfg.expiration_value || ' months')::interval) + interval '1 month - 1 day'
    ELSE NULL
  END;

  INSERT INTO public.point_movements (
    organization_id, client_id, appointment_id, movement_type,
    quantity, available_quantity, expires_at, created_by, reason
  ) VALUES (
    v_appt.organization_id, v_appt.client_id, p_appointment_id, 'service_credit',
    v_points, v_points, v_expires, auth.uid(), 'Acreditación por servicio'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_point_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_points(UUID) TO authenticated;
