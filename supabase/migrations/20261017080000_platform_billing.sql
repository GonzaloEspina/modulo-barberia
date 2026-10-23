-- Trial / billing de plataforma para barberías (paridad esencial con Lavaderos).

CREATE OR REPLACE FUNCTION public.billing_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (timezone('America/Argentina/Buenos_Aires', now()))::date;
$$;

CREATE TABLE IF NOT EXISTS public.platform_billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_trial_days integer NOT NULL DEFAULT 14 CHECK (default_trial_days >= 0),
  default_monthly_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (default_monthly_price >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_billing_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_billing_settings_select ON public.platform_billing_settings;
CREATE POLICY platform_billing_settings_select ON public.platform_billing_settings
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS platform_billing_settings_update ON public.platform_billing_settings;
CREATE POLICY platform_billing_settings_update ON public.platform_billing_settings
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_ends_on date,
  ADD COLUMN IF NOT EXISTS paid_until date,
  ADD COLUMN IF NOT EXISTS monthly_price numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspend_when_unpaid boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organizations.trial_ends_on IS
  'Último día inclusive de prueba (America/Argentina/Buenos_Aires).';
COMMENT ON COLUMN public.organizations.paid_until IS
  'Último día inclusive de acceso pago. Null si nunca pagó.';

UPDATE public.organizations o
SET
  trial_ends_on = COALESCE(o.trial_ends_on, (timezone('America/Argentina/Buenos_Aires', o.created_at))::date + 14),
  monthly_price = COALESCE(NULLIF(o.monthly_price, 0), (SELECT default_monthly_price FROM public.platform_billing_settings WHERE id))
WHERE o.trial_ends_on IS NULL OR o.monthly_price = 0;

CREATE OR REPLACE FUNCTION public.organization_billing_phase(p_org public.organizations)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_today date := public.billing_today();
BEGIN
  IF p_org.suspended_at IS NOT NULL OR p_org.is_active IS FALSE THEN
    RETURN 'suspended';
  END IF;
  IF p_org.paid_until IS NOT NULL AND v_today <= p_org.paid_until THEN
    RETURN 'active';
  END IF;
  IF p_org.paid_until IS NULL AND p_org.trial_ends_on IS NOT NULL AND v_today <= p_org.trial_ends_on THEN
    RETURN 'trial';
  END IF;
  RETURN 'expired';
END;
$$;

DROP FUNCTION IF EXISTS public.platform_list_organizations();

CREATE OR REPLACE FUNCTION public.platform_list_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  address TEXT,
  timezone TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  clients_count BIGINT,
  barbers_count BIGINT,
  appointments_count BIGINT,
  trial_ends_on date,
  paid_until date,
  monthly_price numeric,
  suspended_at timestamptz,
  billing_phase text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.phone,
    o.address,
    o.timezone,
    o.is_active,
    o.created_at,
    (SELECT COUNT(*) FROM public.clients c WHERE c.organization_id = o.id AND c.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.barbers b WHERE b.organization_id = o.id AND b.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.appointments a WHERE a.organization_id = o.id),
    o.trial_ends_on,
    o.paid_until,
    o.monthly_price,
    o.suspended_at,
    public.organization_billing_phase(o)
  FROM public.organizations o
  ORDER BY o.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_get_organization(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  address TEXT,
  timezone TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  trial_ends_on date,
  paid_until date,
  monthly_price numeric,
  suspended_at timestamptz,
  suspend_when_unpaid boolean,
  billing_phase text,
  clients_count BIGINT,
  barbers_count BIGINT,
  appointments_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.phone,
    o.address,
    o.timezone,
    o.is_active,
    o.created_at,
    o.trial_ends_on,
    o.paid_until,
    o.monthly_price,
    o.suspended_at,
    o.suspend_when_unpaid,
    public.organization_billing_phase(o),
    (SELECT COUNT(*) FROM public.clients c WHERE c.organization_id = o.id AND c.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.barbers b WHERE b.organization_id = o.id AND b.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.appointments a WHERE a.organization_id = o.id)
  FROM public.organizations o
  WHERE o.id = p_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_org_billing_defaults(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_price numeric(12, 2);
BEGIN
  SELECT default_trial_days, default_monthly_price
  INTO v_days, v_price
  FROM public.platform_billing_settings
  WHERE id;

  UPDATE public.organizations
  SET
    trial_ends_on = COALESCE(trial_ends_on, public.billing_today() + COALESCE(v_days, 14)),
    monthly_price = CASE WHEN monthly_price = 0 THEN COALESCE(v_price, 0) ELSE monthly_price END,
    updated_at = now()
  WHERE id = p_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_organization(
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  INSERT INTO public.organizations (name, phone, address)
  VALUES (trim(p_name), NULLIF(trim(p_phone), ''), NULLIF(trim(p_address), ''))
  RETURNING id INTO v_org_id;

  INSERT INTO public.points_config (organization_id) VALUES (v_org_id);
  INSERT INTO public.absence_config (organization_id) VALUES (v_org_id);

  INSERT INTO public.payment_methods (organization_id, name, display_order) VALUES
    (v_org_id, 'Efectivo', 1),
    (v_org_id, 'Transferencia', 2),
    (v_org_id, 'Tarjeta', 3);

  PERFORM private.apply_org_billing_defaults(v_org_id);

  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_organization_with_admin(
  p_org_name TEXT,
  p_admin_email TEXT,
  p_admin_password TEXT,
  p_admin_full_name TEXT DEFAULT NULL
)
RETURNS TABLE (organization_id UUID, user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_email TEXT := lower(trim(p_admin_email));
  v_name TEXT := COALESCE(NULLIF(trim(p_admin_full_name), ''), 'Administrador');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF v_email = '' OR length(p_admin_password) < 8 THEN
    RAISE EXCEPTION 'Email y contraseña (mín. 8 caracteres) requeridos';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Ya existe un usuario con ese email';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO public.organizations (name)
  VALUES (trim(p_org_name))
  RETURNING id INTO v_org_id;

  INSERT INTO public.points_config (organization_id) VALUES (v_org_id);
  INSERT INTO public.absence_config (organization_id) VALUES (v_org_id);
  INSERT INTO public.payment_methods (organization_id, name, display_order) VALUES
    (v_org_id, 'Efectivo', 1),
    (v_org_id, 'Transferencia', 2),
    (v_org_id, 'Tarjeta', 3);

  PERFORM private.apply_org_billing_defaults(v_org_id);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    crypt(p_admin_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', v_name),
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email', v_user_id::text, now(), now(), now()
  );

  INSERT INTO public.profiles (id, organization_id, role, full_name, permissions)
  VALUES (
    v_user_id, v_org_id, 'admin', v_name,
    '{"can_register_payments": true, "can_edit_own_schedule": true}'::jsonb
  );

  organization_id := v_org_id;
  user_id := v_user_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_extend_trial(p_org_id UUID, p_days integer DEFAULT 14)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org public.organizations;
  v_new date;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;
  IF p_days IS NULL OR p_days < 1 THEN
    RAISE EXCEPTION 'Días inválidos';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  v_new := GREATEST(COALESCE(v_org.trial_ends_on, public.billing_today()), public.billing_today()) + p_days;

  UPDATE public.organizations
  SET
    trial_ends_on = v_new,
    is_active = true,
    suspended_at = NULL,
    updated_at = now()
  WHERE id = p_org_id;

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_paid_until(p_org_id UUID, p_paid_until date)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org public.organizations;
  v_still_active boolean;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;
  IF p_paid_until IS NULL THEN
    RAISE EXCEPTION 'Fecha requerida';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  v_still_active := public.billing_today() <= p_paid_until;

  UPDATE public.organizations
  SET
    paid_until = p_paid_until,
    is_active = CASE
      WHEN v_still_active THEN true
      WHEN COALESCE(suspend_when_unpaid, true) THEN false
      ELSE is_active
    END,
    suspended_at = CASE
      WHEN v_still_active THEN NULL
      WHEN COALESCE(suspend_when_unpaid, true) THEN COALESCE(suspended_at, now())
      ELSE suspended_at
    END,
    updated_at = now()
  WHERE id = p_org_id;

  RETURN p_paid_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_monthly_price(p_org_id UUID, p_price numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;
  IF p_price IS NULL OR p_price < 0 THEN
    RAISE EXCEPTION 'Precio inválido';
  END IF;

  UPDATE public.organizations
  SET monthly_price = p_price, updated_at = now()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  RETURN p_price;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_org_suspended(p_org_id UUID, p_suspended boolean)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  UPDATE public.organizations
  SET
    is_active = NOT p_suspended,
    suspended_at = CASE WHEN p_suspended THEN COALESCE(suspended_at, now()) ELSE NULL END,
    updated_at = now()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_update_billing_settings(
  p_default_trial_days integer,
  p_default_monthly_price numeric
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  UPDATE public.platform_billing_settings
  SET
    default_trial_days = GREATEST(COALESCE(p_default_trial_days, default_trial_days), 0),
    default_monthly_price = GREATEST(COALESCE(p_default_monthly_price, default_monthly_price), 0),
    updated_at = now()
  WHERE id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_get_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_extend_trial(UUID, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_paid_until(UUID, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_monthly_price(UUID, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_org_suspended(UUID, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_billing_settings(integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_organization(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_organization_with_admin(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_list_organizations() TO authenticated;
