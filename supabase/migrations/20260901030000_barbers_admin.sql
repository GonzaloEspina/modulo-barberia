-- Etapa 4: restricciones y política de baja lógica para barberos

CREATE UNIQUE INDEX barbers_user_id_unique
  ON public.barbers (user_id)
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;

-- Admin puede ver barberos eliminados para auditoría (lista admin con filtro)
DROP POLICY IF EXISTS "barbers_select_admin" ON public.barbers;

CREATE POLICY "barbers_select_admin"
  ON public.barbers FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );
