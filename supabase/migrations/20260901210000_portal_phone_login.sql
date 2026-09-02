-- Portal: ingreso solo con teléfono (sin OTP).

CREATE OR REPLACE FUNCTION public.portal_login_with_phone(
  p_phone TEXT,
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
SET search_path = public, extensions
AS $$
DECLARE
  v_phone TEXT;
  v_client public.clients%ROWTYPE;
  v_token TEXT;
  v_token_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  PERFORM pg_sleep(0.5);

  v_phone := public.normalize_phone_ar(p_phone);
  IF v_phone = '' THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;

  PERFORM private.check_portal_otp_rate_limit(p_organization_id, v_phone);

  SELECT * INTO v_client
  FROM public.clients c
  WHERE c.organization_id = p_organization_id
    AND c.phone_normalized = v_phone
    AND c.deleted_at IS NULL
    AND c.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos un cliente activo con ese teléfono';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.portal_login_with_phone(TEXT, UUID) TO anon, authenticated;
