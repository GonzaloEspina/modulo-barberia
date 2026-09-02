-- Barberos pueden buscar clientes al crear turnos

CREATE POLICY "clients_select_barber"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.user_role() = 'barber'
    AND deleted_at IS NULL
  );
