-- Ocultar y proteger usuarios platform admin del CRUD de la barbería

CREATE OR REPLACE FUNCTION public.org_list_users(p_include_inactive BOOLEAN DEFAULT FALSE)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role public.user_role,
  barber_id UUID,
  barber_name TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID := private.user_organization_id();
BEGIN
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.full_name,
    p.role,
    p.barber_id,
    b.name AS barber_name,
    p.is_active,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.barbers b ON b.id = p.barber_id
  WHERE p.organization_id = v_org_id
    AND (p_include_inactive OR p.is_active = TRUE)
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = p.id
    )
  ORDER BY p.is_active DESC, p.full_name ASC NULLS LAST, u.email ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_update_user(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_role public.user_role DEFAULT NULL,
  p_barber_id UUID DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID := private.user_organization_id();
  v_profile public.profiles%ROWTYPE;
  v_new_role public.user_role;
  v_new_barber UUID;
BEGIN
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'No se puede modificar un super administrador';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id AND organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF p_is_active IS FALSE AND p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No podés desactivar tu propio usuario';
  END IF;

  v_new_role := COALESCE(p_role, v_profile.role);

  IF v_new_role = 'barber' THEN
    v_new_barber := COALESCE(p_barber_id, v_profile.barber_id);
    IF v_new_barber IS NULL THEN
      RAISE EXCEPTION 'Los usuarios barbero deben vincularse a una ficha de barbero';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.barbers
      WHERE id = v_new_barber
        AND organization_id = v_org_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Barbero no encontrado en esta organización';
    END IF;
  ELSE
    v_new_barber := NULL;
  END IF;

  IF v_profile.barber_id IS NOT NULL
     AND (v_new_barber IS DISTINCT FROM v_profile.barber_id) THEN
    UPDATE public.barbers
    SET user_id = NULL, updated_at = now()
    WHERE id = v_profile.barber_id
      AND user_id = p_user_id
      AND organization_id = v_org_id;
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
    role = v_new_role,
    barber_id = v_new_barber,
    is_active = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = p_user_id
    AND organization_id = v_org_id;

  IF v_new_role = 'barber' AND v_new_barber IS NOT NULL THEN
    UPDATE public.profiles
    SET barber_id = NULL, updated_at = now()
    WHERE barber_id = v_new_barber
      AND id <> p_user_id
      AND organization_id = v_org_id;

    UPDATE public.barbers
    SET user_id = p_user_id, updated_at = now()
    WHERE id = v_new_barber
      AND organization_id = v_org_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_set_user_password(
  p_user_id UUID,
  p_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_org_id UUID := private.user_organization_id();
BEGIN
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'No se puede modificar un super administrador';
  END IF;

  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = crypt(p_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Org admins no pueden SELECT/UPDATE perfiles de platform admins (sí su propio perfil)
DROP POLICY IF EXISTS "profiles_select_org_admin" ON public.profiles;
CREATE POLICY "profiles_select_org_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      organization_id = private.user_organization_id()
      AND private.is_admin()
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = profiles.id
      )
    )
  );

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = profiles.id
    )
  )
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = profiles.id
    )
  );
