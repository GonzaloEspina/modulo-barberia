-- Apodo interno: visible solo para staff (barberos/admin), nunca en RPCs del portal.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN public.clients.nickname IS
  'Apodo interno del staff. No incluir en portal_get_dashboard ni otras respuestas al cliente.';

CREATE INDEX IF NOT EXISTS clients_nickname_idx
  ON public.clients (organization_id, lower(nickname))
  WHERE nickname IS NOT NULL AND deleted_at IS NULL;
