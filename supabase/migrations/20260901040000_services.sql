-- Etapa 5: servicios generales, overrides por barbero y resolución efectiva

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  category_color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX services_org_name_unique
  ON public.services (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX services_organization_id_idx ON public.services (organization_id);
CREATE INDEX services_display_order_idx ON public.services (organization_id, display_order);

CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.barber_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_exclusive BOOLEAN NOT NULL DEFAULT false,
  exclusive_name TEXT,
  price_override NUMERIC(12,2) CHECK (price_override IS NULL OR price_override >= 0),
  duration_override INTEGER CHECK (duration_override IS NULL OR duration_override > 0),
  points_override INTEGER CHECK (points_override IS NULL OR points_override >= 0),
  exclusive_price NUMERIC(12,2) CHECK (exclusive_price IS NULL OR exclusive_price >= 0),
  exclusive_duration INTEGER CHECK (exclusive_duration IS NULL OR exclusive_duration > 0),
  exclusive_points INTEGER CHECK (exclusive_points IS NULL OR exclusive_points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT barber_services_org_barber_fk CHECK (
    organization_id IS NOT NULL
  ),
  CONSTRAINT barber_services_mode_check CHECK (
    (
      is_exclusive = false
      AND service_id IS NOT NULL
      AND exclusive_name IS NULL
      AND exclusive_price IS NULL
      AND exclusive_duration IS NULL
      AND exclusive_points IS NULL
    )
    OR (
      is_exclusive = true
      AND service_id IS NULL
      AND exclusive_name IS NOT NULL
      AND exclusive_price IS NOT NULL
      AND exclusive_duration IS NOT NULL
      AND exclusive_points IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX barber_services_barber_service_unique
  ON public.barber_services (barber_id, service_id)
  WHERE service_id IS NOT NULL;

CREATE UNIQUE INDEX barber_services_exclusive_name_unique
  ON public.barber_services (barber_id, lower(exclusive_name))
  WHERE is_exclusive = true AND exclusive_name IS NOT NULL;

CREATE INDEX barber_services_barber_id_idx ON public.barber_services (barber_id);
CREATE INDEX barber_services_service_id_idx ON public.barber_services (service_id);

CREATE TRIGGER barber_services_set_updated_at
  BEFORE UPDATE ON public.barber_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sincronizar organization_id desde barbero
CREATE OR REPLACE FUNCTION public.barber_services_sync_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM public.barbers
  WHERE id = NEW.barber_id;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Barbero no encontrado';
  END IF;

  IF NEW.service_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = NEW.service_id
        AND s.organization_id = NEW.organization_id
        AND s.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'El servicio no pertenece a la organización del barbero';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER barber_services_sync_organization_trg
  BEFORE INSERT OR UPDATE ON public.barber_services
  FOR EACH ROW EXECUTE FUNCTION public.barber_services_sync_organization();

-- Resolución efectiva (general + override parcial)
CREATE OR REPLACE FUNCTION private.get_effective_service(
  p_barber_id UUID,
  p_service_id UUID
)
RETURNS TABLE (
  barber_service_id UUID,
  service_id UUID,
  name TEXT,
  price NUMERIC(12,2),
  duration_minutes INTEGER,
  points_awarded INTEGER,
  is_available BOOLEAN,
  is_exclusive BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barber public.barbers%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_override public.barber_services%ROWTYPE;
BEGIN
  SELECT * INTO v_barber
  FROM public.barbers b
  WHERE b.id = p_barber_id
    AND b.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.organization_id = v_barber.organization_id
    AND s.deleted_at IS NULL
    AND s.is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_override
  FROM public.barber_services bs
  WHERE bs.barber_id = p_barber_id
    AND bs.service_id = p_service_id
    AND bs.is_exclusive = false;

  IF v_override.id IS NOT NULL AND v_override.is_enabled = false THEN
    RETURN QUERY SELECT
      v_override.id,
      v_service.id,
      v_service.name,
      NULL::NUMERIC(12,2),
      NULL::INTEGER,
      NULL::INTEGER,
      false,
      false;
    RETURN;
  END IF;

  IF v_override.id IS NULL AND v_barber.use_general_services = false THEN
    RETURN QUERY SELECT
      NULL::UUID,
      v_service.id,
      v_service.name,
      NULL::NUMERIC(12,2),
      NULL::INTEGER,
      NULL::INTEGER,
      false,
      false;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_override.id,
    v_service.id,
    v_service.name,
    CASE
      WHEN v_barber.use_general_prices THEN COALESCE(v_override.price_override, v_service.price)
      ELSE COALESCE(v_override.price_override, v_service.price)
    END,
    CASE
      WHEN v_barber.use_general_durations THEN COALESCE(v_override.duration_override, v_service.duration_minutes)
      ELSE COALESCE(v_override.duration_override, v_service.duration_minutes)
    END,
    COALESCE(v_override.points_override, v_service.points_awarded),
    true,
    false;
END;
$$;

REVOKE ALL ON FUNCTION private.get_effective_service(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_effective_service(UUID, UUID) TO authenticated, service_role;

-- RPC pública para consultas desde la app (validación de org)
CREATE OR REPLACE FUNCTION public.get_effective_service(
  p_barber_id UUID,
  p_service_id UUID
)
RETURNS TABLE (
  barber_service_id UUID,
  service_id UUID,
  name TEXT,
  price NUMERIC(12,2),
  duration_minutes INTEGER,
  points_awarded INTEGER,
  is_available BOOLEAN,
  is_exclusive BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barbers b
    WHERE b.id = p_barber_id
      AND b.organization_id = private.user_organization_id()
      AND b.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Barbero no encontrado o sin acceso';
  END IF;

  IF NOT private.is_admin() AND p_barber_id <> private.user_barber_id() THEN
    RAISE EXCEPTION 'Sin permiso para consultar servicios de este barbero';
  END IF;

  RETURN QUERY SELECT * FROM private.get_effective_service(p_barber_id, p_service_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_service(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_select_admin"
  ON public.services FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "services_insert_admin"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "services_update_admin"
  ON public.services FOR UPDATE
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  )
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "barber_services_select_admin"
  ON public.barber_services FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "barber_services_select_own"
  ON public.barber_services FOR SELECT
  TO authenticated
  USING (
    barber_id = private.user_barber_id()
  );

CREATE POLICY "barber_services_insert_admin"
  ON public.barber_services FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "barber_services_update_admin"
  ON public.barber_services FOR UPDATE
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  )
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "barber_services_delete_admin"
  ON public.barber_services FOR DELETE
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );
