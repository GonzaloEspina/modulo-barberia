-- AppSheet imports were flagged as overbooking only to bypass the overlap
-- EXCLUDE constraint. They should not display as sobreturnos.
-- Keep imported rows out of the constraint so historical overlaps can coexist;
-- slot availability still treats is_overbooking = false as occupied.

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (
    status <> 'cancelled'
    AND is_overbooking = false
    AND deleted_at IS NULL
    AND creation_channel <> 'import'
  );

UPDATE public.appointments
SET
  is_overbooking = false,
  overbooking_reason = NULL,
  overbooking_created_by = NULL
WHERE creation_channel = 'import'
  AND is_overbooking = true;
