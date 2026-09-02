-- Configuración avanzada y super admin de plataforma (estilo módulo lavadero)

CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;

CREATE POLICY "platform_admins_select"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

-- Super admin puede listar todas las organizaciones
DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;
CREATE POLICY "organizations_select_own"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = private.user_organization_id() OR public.is_platform_admin());

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
    (SELECT COUNT(*) FROM public.clients c WHERE c.organization_id = o.id AND c.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.barbers b WHERE b.organization_id = o.id AND b.deleted_at IS NULL),
    (SELECT COUNT(*) FROM public.appointments a WHERE a.organization_id = o.id)
  FROM public.organizations o
  ORDER BY o.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_organizations() TO authenticated;
