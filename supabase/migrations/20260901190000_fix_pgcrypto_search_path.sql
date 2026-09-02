-- pgcrypto (crypt, gen_salt, gen_random_bytes) vive en schema extensions.
-- Las funciones con SET search_path = public no lo encontraban.

ALTER FUNCTION public.generate_client_otp(TEXT, TEXT)
  SET search_path = public, extensions;

ALTER FUNCTION public.verify_client_otp(TEXT, TEXT, UUID)
  SET search_path = public, extensions;

ALTER FUNCTION private.portal_client_from_token(TEXT)
  SET search_path = public, extensions;

ALTER FUNCTION public.portal_logout(TEXT)
  SET search_path = public, extensions;

ALTER FUNCTION public.platform_create_organization_with_admin(TEXT, TEXT, TEXT, TEXT)
  SET search_path = public, auth, extensions;
