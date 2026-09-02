-- Etapas 14, 18: portal OTP, auditoría, can_client_book_portal

CREATE TYPE public.audit_action AS ENUM ('create', 'update', 'delete', 'status_change', 'soft_delete');

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action public.audit_action NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.client_portal_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  phone_normalized TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.client_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_org_created_idx ON public.audit_log (organization_id, created_at DESC);
CREATE INDEX client_portal_otp_phone_idx ON public.client_portal_otp (organization_id, phone_normalized);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin"
  ON public.audit_log FOR SELECT TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "client_portal_otp_admin"
  ON public.client_portal_otp FOR ALL TO authenticated
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
  IF v_client.booking_override = 'allowed' THEN RETURN v_mode <> 'disabled'; END IF;

  IF v_mode = 'allowlist_only' THEN RETURN false; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_client_otp(p_phone TEXT, p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_phone TEXT;
  v_id UUID;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  v_phone := public.normalize_phone_ar(p_phone);
  IF v_phone = '' THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;

  INSERT INTO public.client_portal_otp (organization_id, phone_normalized, code_hash, expires_at)
  VALUES (v_org_id, v_phone, crypt(p_code, gen_salt('bf')), now() + interval '10 minutes')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_action public.audit_action;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_TABLE_NAME NOT IN ('appointments', 'payments', 'client_memberships') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      v_action := 'soft_delete';
    ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.attendance_status IS DISTINCT FROM OLD.attendance_status THEN
      v_action := 'status_change';
    ELSE
      v_action := 'update';
    END IF;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_log (organization_id, entity_type, entity_id, action, old_values, new_values, performed_by)
  VALUES (
    v_org_id, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), v_action, v_old, v_new, auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_appointments_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_payments_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

GRANT EXECUTE ON FUNCTION public.can_client_book_portal(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.generate_client_otp(TEXT, TEXT) TO authenticated;
