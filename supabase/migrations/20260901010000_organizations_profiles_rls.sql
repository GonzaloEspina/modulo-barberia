-- Etapa 2: organizaciones, barberos (mínimo), perfiles, RLS

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TYPE public.user_role AS ENUM ('admin', 'barber');
CREATE TYPE public.portal_booking_mode AS ENUM ('all_except_denied', 'allowlist_only', 'disabled');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  currency TEXT NOT NULL DEFAULT 'ARS',
  settings JSONB NOT NULL DEFAULT '{
    "appointment_slot_interval_minutes": 15,
    "overbooking_requires_reason": true,
    "portal_booking_mode": "disabled",
    "default_appointment_status": "pending",
    "privacy_hide_client_names_in_conflicts": true,
    "redemption_reversal_expiry_days": 30,
    "membership_credit_points": true
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT,
  email TEXT,
  calendar_color TEXT NOT NULL DEFAULT '#3B82F6',
  use_general_schedules BOOLEAN NOT NULL DEFAULT true,
  use_general_services BOOLEAN NOT NULL DEFAULT true,
  use_general_prices BOOLEAN NOT NULL DEFAULT true,
  use_general_durations BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  role public.user_role NOT NULL,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  full_name TEXT,
  permissions JSONB NOT NULL DEFAULT '{
    "can_register_payments": false,
    "can_edit_own_schedule": false
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_barber_role_requires_barber_id CHECK (
    role <> 'barber' OR barber_id IS NOT NULL
  )
);

CREATE INDEX idx_barbers_organization_id ON public.barbers(organization_id);
CREATE INDEX idx_barbers_user_id ON public.barbers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER barbers_set_updated_at
  BEFORE UPDATE ON public.barbers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers RLS (schema private, SECURITY DEFINER)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION private.user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION private.user_barber_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT barber_id FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.user_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_barber_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.user_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_barber_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- organizations: ver solo la propia
CREATE POLICY "organizations_select_own"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (id = private.user_organization_id());

CREATE POLICY "organizations_update_admin"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (id = private.user_organization_id() AND private.is_admin());

-- profiles: ver el propio; admin ve todos de la org
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_select_org_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

-- barbers: admin CRUD en su org; barbero ve solo el suyo
CREATE POLICY "barbers_select_admin"
  ON public.barbers FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
    AND deleted_at IS NULL
  );

CREATE POLICY "barbers_select_own"
  ON public.barbers FOR SELECT
  TO authenticated
  USING (
    id = private.user_barber_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "barbers_insert_admin"
  ON public.barbers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "barbers_update_admin"
  ON public.barbers FOR UPDATE
  TO authenticated
  USING (organization_id = private.user_organization_id() AND private.is_admin())
  WITH CHECK (organization_id = private.user_organization_id() AND private.is_admin());

CREATE POLICY "barbers_update_own_schedule_flag"
  ON public.barbers FOR UPDATE
  TO authenticated
  USING (
    id = private.user_barber_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.permissions->>'can_edit_own_schedule')::boolean IS TRUE
    )
  )
  WITH CHECK (id = private.user_barber_id());
