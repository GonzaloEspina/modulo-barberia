-- Allow clients to redeem rewards from the portal using their session token.
-- Core redeem logic is shared with the staff redeem_reward function.

CREATE OR REPLACE FUNCTION private.redeem_reward_for_client(
  p_org_id UUID,
  p_client_id UUID,
  p_reward_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.rewards%ROWTYPE;
  v_code TEXT;
  v_redemption_id UUID;
  v_existing INTEGER;
  v_enabled BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_client_id::text || ':redeem'));

  SELECT COALESCE(
    (SELECT pc.enabled FROM public.points_config pc WHERE pc.organization_id = p_org_id),
    true
  )
  INTO v_enabled;

  IF NOT v_enabled THEN
    RAISE EXCEPTION 'Los puntos no están habilitados';
  END IF;

  SELECT * INTO v_reward
  FROM public.rewards
  WHERE id = p_reward_id
    AND organization_id = p_org_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premio no encontrado';
  END IF;

  IF v_reward.starts_at IS NOT NULL AND v_reward.starts_at > now() THEN
    RAISE EXCEPTION 'Premio aún no vigente';
  END IF;

  IF v_reward.ends_at IS NOT NULL AND v_reward.ends_at < now() THEN
    RAISE EXCEPTION 'Premio vencido';
  END IF;

  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN
    RAISE EXCEPTION 'Sin stock';
  END IF;

  IF v_reward.max_per_client IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing
    FROM public.redemptions
    WHERE client_id = p_client_id
      AND reward_id = p_reward_id
      AND status NOT IN ('cancelled', 'expired');
    IF v_existing >= v_reward.max_per_client THEN
      RAISE EXCEPTION 'Límite de canjes por cliente alcanzado';
    END IF;
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.redemptions (
    organization_id, client_id, reward_id, points_used, unique_code, status
  ) VALUES (
    p_org_id, p_client_id, p_reward_id, v_reward.points_required, v_code, 'requested'
  )
  RETURNING id INTO v_redemption_id;

  PERFORM private.consume_client_points_fefo(
    p_org_id, p_client_id, v_reward.points_required, v_redemption_id
  );

  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards SET stock = stock - 1 WHERE id = p_reward_id;
  END IF;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_client_id UUID,
  p_reward_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := private.user_organization_id();
  IF v_org_id IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  RETURN private.redeem_reward_for_client(v_org_id, p_client_id, p_reward_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_redeem_reward(
  p_session_token TEXT,
  p_reward_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_org_id UUID;
BEGIN
  SELECT p.client_id, p.organization_id
  INTO v_client_id, v_org_id
  FROM private.portal_client_from_token(p_session_token) p;

  RETURN private.redeem_reward_for_client(v_org_id, v_client_id, p_reward_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_redeem_reward(TEXT, UUID) TO anon, authenticated;
