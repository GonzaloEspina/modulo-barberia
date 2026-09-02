-- Etapa 3: clientes

CREATE TYPE public.client_booking_override AS ENUM ('inherit', 'allowed', 'denied');

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  phone_display TEXT,
  email TEXT,
  birth_date DATE,
  notes TEXT,
  manual_warning BOOLEAN NOT NULL DEFAULT false,
  manual_warning_reason TEXT,
  booking_override public.client_booking_override NOT NULL DEFAULT 'inherit',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX clients_org_phone_unique
  ON public.clients (organization_id, phone_normalized)
  WHERE deleted_at IS NULL;

CREATE INDEX clients_organization_id_idx ON public.clients (organization_id);
CREATE INDEX clients_phone_normalized_idx ON public.clients (phone_normalized);
CREATE INDEX clients_name_idx ON public.clients (last_name, first_name);

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Normalización en servidor (Argentina)
CREATE OR REPLACE FUNCTION public.normalize_phone_ar(raw_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
  normalized TEXT;
BEGIN
  digits := regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g');
  IF digits = '' THEN
    RETURN '';
  END IF;

  IF digits LIKE '54%' AND length(digits) >= 12 THEN
    RETURN digits;
  END IF;

  normalized := CASE WHEN digits LIKE '0%' THEN substring(digits FROM 2) ELSE digits END;

  IF length(normalized) = 11 AND normalized LIKE '15%' THEN
    normalized := '9' || normalized;
  END IF;

  IF length(normalized) = 10 THEN
    RETURN '54' || normalized;
  END IF;

  IF length(normalized) = 11 AND normalized LIKE '9%' THEN
    RETURN '54' || normalized;
  END IF;

  IF length(normalized) BETWEEN 8 AND 11 AND normalized NOT LIKE '54%' THEN
    RETURN '54' || normalized;
  END IF;

  RETURN normalized;
END;
$$;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Solo administradores gestionan clientes (barberos: etapa 8 con turnos)
CREATE POLICY "clients_select_admin"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
    AND deleted_at IS NULL
  );

CREATE POLICY "clients_insert_admin"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "clients_update_admin"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  )
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );
