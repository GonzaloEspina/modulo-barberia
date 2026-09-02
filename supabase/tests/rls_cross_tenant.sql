-- Verificación manual RLS cross-tenant
-- Ejecutar con: psql después de seed (como postgres o service_role)
--
-- 1. SET ROLE authenticated; SET request.jwt.claim.sub = '<admin_barbatero_uuid>';
-- 2. SELECT count(*) FROM clients; -- solo org Barbatero
-- 3. Intentar SELECT desde otra org por id directo debe devolver 0 filas

-- Tablas con organization_id que deben filtrar por private.user_organization_id():
-- clients, barbers, services, appointments, payments, expenses, rewards, etc.

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'appointments', 'payments', 'expenses', 'barbers', 'services')
ORDER BY tablename, policyname;
