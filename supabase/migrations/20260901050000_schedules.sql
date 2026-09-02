-- Etapa 6: horarios generales, por barbero y excepciones

CREATE TYPE public.schedule_exception_scope AS ENUM ('organization', 'barber');
CREATE TYPE public.schedule_exception_type AS ENUM ('block', 'allow');

CREATE TABLE public.general_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT general_schedules_time_order CHECK (start_time < end_time)
);

CREATE INDEX general_schedules_org_dow_idx
  ON public.general_schedules (organization_id, day_of_week);

CREATE TRIGGER general_schedules_set_updated_at
  BEFORE UPDATE ON public.general_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME,
  end_time TIME,
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT barber_schedules_mode_check CHECK (
    (
      is_working_day = false
      AND start_time IS NULL
      AND end_time IS NULL
    )
    OR (
      is_working_day = true
      AND start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND start_time < end_time
    )
  )
);

CREATE INDEX barber_schedules_barber_dow_idx
  ON public.barber_schedules (barber_id, day_of_week);

CREATE TRIGGER barber_schedules_set_updated_at
  BEFORE UPDATE ON public.barber_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.barber_schedules_sync_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM public.barbers
  WHERE id = NEW.barber_id;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Barbero no encontrado';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER barber_schedules_sync_organization_trg
  BEFORE INSERT OR UPDATE ON public.barber_schedules
  FOR EACH ROW EXECUTE FUNCTION public.barber_schedules_sync_organization();

CREATE TABLE public.schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  exception_type public.schedule_exception_type NOT NULL,
  scope public.schedule_exception_scope NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedule_exceptions_date_order CHECK (start_date <= end_date),
  CONSTRAINT schedule_exceptions_scope_barber CHECK (
    (scope = 'organization' AND barber_id IS NULL)
    OR (scope = 'barber' AND barber_id IS NOT NULL)
  ),
  CONSTRAINT schedule_exceptions_time_order CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

CREATE INDEX schedule_exceptions_org_dates_idx
  ON public.schedule_exceptions (organization_id, start_date, end_date);

CREATE INDEX schedule_exceptions_barber_dates_idx
  ON public.schedule_exceptions (barber_id, start_date, end_date)
  WHERE barber_id IS NOT NULL;

CREATE TRIGGER schedule_exceptions_set_updated_at
  BEFORE UPDATE ON public.schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.general_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "general_schedules_admin_all"
  ON public.general_schedules FOR ALL
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  )
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "barber_schedules_select_admin"
  ON public.barber_schedules FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "barber_schedules_select_own"
  ON public.barber_schedules FOR SELECT
  TO authenticated
  USING (barber_id = private.user_barber_id());

CREATE POLICY "barber_schedules_admin_write"
  ON public.barber_schedules FOR ALL
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  )
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "barber_schedules_own_write"
  ON public.barber_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    barber_id = private.user_barber_id()
    AND organization_id = private.user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.permissions->>'can_edit_own_schedule')::boolean IS TRUE
    )
  );

CREATE POLICY "barber_schedules_own_update"
  ON public.barber_schedules FOR UPDATE
  TO authenticated
  USING (
    barber_id = private.user_barber_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.permissions->>'can_edit_own_schedule')::boolean IS TRUE
    )
  )
  WITH CHECK (barber_id = private.user_barber_id());

CREATE POLICY "barber_schedules_own_delete"
  ON public.barber_schedules FOR DELETE
  TO authenticated
  USING (
    barber_id = private.user_barber_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.permissions->>'can_edit_own_schedule')::boolean IS TRUE
    )
  );

CREATE POLICY "schedule_exceptions_admin_all"
  ON public.schedule_exceptions FOR ALL
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  )
  WITH CHECK (
    organization_id = private.user_organization_id()
    AND private.is_admin()
  );

CREATE POLICY "schedule_exceptions_select_barber"
  ON public.schedule_exceptions FOR SELECT
  TO authenticated
  USING (
    organization_id = private.user_organization_id()
    AND (
      scope = 'organization'
      OR barber_id = private.user_barber_id()
    )
  );
