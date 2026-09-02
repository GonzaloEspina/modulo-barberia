-- Gestión de usuarios por organización (admin de barbería)

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
  ORDER BY p.is_active DESC, p.full_name ASC NULLS LAST, u.email ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role public.user_role,
  p_barber_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_org_id UUID := private.user_organization_id();
  v_user_id UUID;
  v_email TEXT := lower(trim(p_email));
  v_name TEXT := COALESCE(NULLIF(trim(p_full_name), ''), 'Usuario');
BEGIN
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF v_email = '' OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Email y contraseña (mín. 8 caracteres) requeridos';
  END IF;

  IF p_role NOT IN ('admin', 'barber') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  IF p_role = 'barber' THEN
    IF p_barber_id IS NULL THEN
      RAISE EXCEPTION 'Los usuarios barbero deben vincularse a una ficha de barbero';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.barbers
      WHERE id = p_barber_id
        AND organization_id = v_org_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Barbero no encontrado en esta organización';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Ya existe un usuario con ese email';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')),
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

  INSERT INTO public.profiles (id, organization_id, role, barber_id, full_name, permissions, is_active)
  VALUES (
    v_user_id,
    v_org_id,
    p_role,
    CASE WHEN p_role = 'barber' THEN p_barber_id ELSE NULL END,
    v_name,
    '{"can_register_payments": true, "can_edit_own_schedule": true}'::jsonb,
    TRUE
  );

  IF p_role = 'barber' THEN
    -- Liberar vínculo previo de la ficha
    UPDATE public.profiles
    SET barber_id = NULL, updated_at = now()
    WHERE barber_id = p_barber_id
      AND id <> v_user_id
      AND organization_id = v_org_id;

    UPDATE public.barbers
    SET user_id = v_user_id, updated_at = now()
    WHERE id = p_barber_id
      AND organization_id = v_org_id;
  END IF;

  RETURN v_user_id;
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

  -- Desvincular ficha anterior si cambió
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

GRANT EXECUTE ON FUNCTION public.org_list_users(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_create_user(TEXT, TEXT, TEXT, public.user_role, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_update_user(UUID, TEXT, public.user_role, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_set_user_password(UUID, TEXT) TO authenticated;
