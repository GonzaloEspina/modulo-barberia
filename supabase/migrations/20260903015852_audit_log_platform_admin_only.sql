-- Auditoría: solo super administradores de plataforma (no admins de organización)

DROP POLICY IF EXISTS "audit_log_admin" ON public.audit_log;

CREATE POLICY "audit_log_platform_admin"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());
