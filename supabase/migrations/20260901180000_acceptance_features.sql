-- Aceptación §16: storage, balance, portal allowlist, plataforma, RLS receipts

-- ---------------------------------------------------------------------------
-- Storage: comprobantes (gastos y pagos) aislados por organization_id
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.receipt_org_from_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(split_part(p_name, '/', 1), '')::uuid;
$$;

CREATE POLICY "receipts_select_own_org"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND private.receipt_org_from_path(name) = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "receipts_insert_own_org"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND private.receipt_org_from_path(name) = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "receipts_update_own_org"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND private.receipt_org_from_path(name) = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "receipts_delete_own_org"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND private.receipt_org_from_path(name) = private.user_organization_id()
    AND private.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Portal: allowlist + rate limit OTP
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.portal_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_normalized TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_login_attempts_lookup_idx
  ON public.portal_login_attempts (organization_id, phone_normalized, attempted_at DESC);

ALTER TABLE public.portal_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_login_attempts_service"
  ON public.portal_login_attempts FOR ALL TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE OR REPLACE FUNCTION public.can_client_book_portal(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.clients%ROWTYPE;
  v_mode public.portal_booking_mode;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT (settings->>'portal_booking_mode')::public.portal_booking_mode
  INTO v_mode
  FROM public.organizations WHERE id = v_client.organization_id;

  IF v_mode = 'disabled' THEN RETURN false; END IF;
  IF v_client.booking_override = 'denied' THEN RETURN false; END IF;
  IF v_client.booking_override = 'allowed' THEN RETURN true; END IF;

  IF v_mode = 'allowlist_only' THEN RETURN false; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.check_portal_otp_rate_limit(
  p_org_id UUID,
  p_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.portal_login_attempts
  WHERE attempted_at < now() - interval '1 hour';

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.portal_login_attempts
  WHERE organization_id = p_org_id
    AND phone_normalized = p_phone
    AND attempted_at > now() - interval '1 hour';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.';
  END IF;

  INSERT INTO public.portal_login_attempts (organization_id, phone_normalized)
  VALUES (p_org_id, p_phone);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_client_otp(
  p_phone TEXT,
  p_code TEXT,
  p_organization_id UUID
)
RETURNS TABLE (
  session_token TEXT,
  client_id UUID,
  client_name TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_client public.clients%ROWTYPE;
  v_otp public.client_portal_otp%ROWTYPE;
  v_token TEXT;
  v_token_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  PERFORM pg_sleep(0.5);

  v_phone := public.normalize_phone_ar(p_phone);
  IF v_phone = '' OR length(trim(p_code)) <> 6 THEN
    RAISE EXCEPTION 'Teléfono o código inválido';
  END IF;

  PERFORM private.check_portal_otp_rate_limit(p_organization_id, v_phone);

  SELECT * INTO v_client
  FROM public.clients c
  WHERE c.organization_id = p_organization_id
    AND c.phone_normalized = v_phone
    AND c.deleted_at IS NULL
    AND c.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código incorrecto o expirado';
  END IF;

  SELECT * INTO v_otp
  FROM public.client_portal_otp o
  WHERE o.organization_id = p_organization_id
    AND o.phone_normalized = v_phone
    AND o.expires_at > now()
  ORDER BY o.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código incorrecto o expirado';
  END IF;

  IF v_otp.attempts >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos. Pedí un código nuevo al local.';
  END IF;

  IF v_otp.code_hash <> crypt(p_code, v_otp.code_hash) THEN
    UPDATE public.client_portal_otp SET attempts = attempts + 1 WHERE id = v_otp.id;
    RAISE EXCEPTION 'Código incorrecto o expirado';
  END IF;

  DELETE FROM public.client_portal_otp WHERE id = v_otp.id;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := crypt(v_token, gen_salt('bf'));
  v_expires := now() + interval '2 hours';

  INSERT INTO public.client_portal_sessions (organization_id, client_id, token_hash, expires_at)
  VALUES (p_organization_id, v_client.id, v_token_hash, v_expires);

  session_token := v_token;
  client_id := v_client.id;
  client_name := v_client.first_name || ' ' || v_client.last_name;
  expires_at := v_expires;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Balance: filtros por servicio y método de pago
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_balance_summary(DATE, DATE, UUID);

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
        AND (
          p_service_id IS NULL OR EXISTS (
            SELECT 1 FROM public.appointment_services s
            WHERE s.appointment_id = a.id AND s.service_id = p_service_id
          )
        )
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
        AND (p_payment_method_id IS NULL OR p.payment_method_id = p_payment_method_id)
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
        AND (p_payment_method_id IS NULL OR p.payment_method_id = p_payment_method_id)
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

GRANT EXECUTE ON FUNCTION public.get_balance_summary(DATE, DATE, UUID, UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Comprobantes en pagos y gastos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_payment_receipt_url(
  p_payment_id UUID,
  p_receipt_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  UPDATE public.payments
  SET receipt_url = p_receipt_url, updated_at = now()
  WHERE id = p_payment_id
    AND organization_id = private.user_organization_id();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_expense_receipt_url(
  p_expense_id UUID,
  p_receipt_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  UPDATE public.expenses
  SET receipt_url = p_receipt_url, updated_at = now()
  WHERE id = p_expense_id
    AND organization_id = private.user_organization_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_payment_receipt_url(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_expense_receipt_url(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Plataforma: crear org + usuario admin
-- ---------------------------------------------------------------------------

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

GRANT EXECUTE ON FUNCTION public.platform_create_organization_with_admin(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: platform admin puede leer perfiles (gestión multi-org)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_org_admin" ON public.profiles;
CREATE POLICY "profiles_select_org_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    (organization_id = private.user_organization_id() AND private.is_admin())
    OR public.is_platform_admin()
  );
