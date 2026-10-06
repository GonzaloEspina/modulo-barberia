import { formatInTimeZone } from 'date-fns-tz'
import { parse } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { BarberCard } from '@/components/design-system/people-cards'
import { ServiceCard } from '@/components/design-system/service-card'
import { TimeSlot, TimeSlotGrid } from '@/components/design-system/time-slot'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useAvailableSlots, dedupeSlotsByStart } from '@/features/availability/api'
import { useAppointment, useAppointmentMutations } from '@/features/appointments/api'
import { useBarbers } from '@/features/barbers/api'
import { useGeneralSchedules } from '@/features/schedules/api'
import { useServices } from '@/features/services/api'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { appIsoDayOfWeek, clampAppDate, isAppPastDate, isAppPastInstant } from '@/lib/app-datetime'
import { APP_TIMEZONE } from '@/lib/constants'
import { notifyError, notifySuccess } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { getClientFullName } from '@/types/client'
import { formatServicePrice } from '@/types/service'

export function AppointmentEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: appt, isLoading } = useAppointment(id)
  const { data: services } = useServices('', true)
  const { data: barbers } = useBarbers(false)
  const { data: generalSchedules } = useGeneralSchedules()
  const { updateAppointment } = useAppointmentMutations()

  const isAdmin = profile && isAdminRole(profile)
  const [hydrated, setHydrated] = useState(false)
  const [barberId, setBarberId] = useState('')
  const [date, setDate] = useState(() => formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd'))
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [originalEndsAt, setOriginalEndsAt] = useState<string | null>(null)
  const [originalStartsAt, setOriginalStartsAt] = useState<string | null>(null)
  const [originalServiceIds, setOriginalServiceIds] = useState<string[]>([])
  const [originalDuration, setOriginalDuration] = useState(0)

  useEffect(() => {
    if (!appt || hydrated) return
    setBarberId(appt.barber_id)
    setDate(formatInTimeZone(new Date(appt.starts_at), APP_TIMEZONE, 'yyyy-MM-dd'))
    setSelectedSlot(appt.starts_at)
    setNotes(appt.notes ?? '')
    setOriginalEndsAt(appt.ends_at)
    setOriginalStartsAt(appt.starts_at)
    setOriginalDuration(appt.total_duration_minutes)
    const serviceIds = (appt.appointment_services ?? [])
      .map((s) => s.service_id)
      .filter((value): value is string => !!value)
    setSelectedServices(serviceIds)
    setOriginalServiceIds(serviceIds)
    setHydrated(true)
  }, [appt, hydrated])

  useEffect(() => {
    if (!isAdmin && profile?.barber_id) setBarberId(profile.barber_id)
  }, [isAdmin, profile?.barber_id])

  const { data: slotsRaw } = useAvailableSlots(
    date,
    selectedServices,
    barberId || null,
    hydrated && selectedServices.length > 0 && !!barberId,
  )

  const slots = useMemo(() => {
    if (!slotsRaw) return []
    const base = barberId ? slotsRaw : dedupeSlotsByStart(slotsRaw)
    const filtered = base.filter(
      (s) => !isAppPastInstant(s.slot_start) || s.slot_start === originalStartsAt,
    )

    if (
      originalStartsAt &&
      barberId &&
      formatInTimeZone(new Date(originalStartsAt), APP_TIMEZONE, 'yyyy-MM-dd') === date &&
      !filtered.some(
        (s) => new Date(s.slot_start).getTime() === new Date(originalStartsAt).getTime(),
      )
    ) {
      filtered.unshift({
        barber_id: barberId,
        barber_name: appt?.barber?.name ?? '',
        slot_start: originalStartsAt,
        slot_end:
          originalEndsAt ??
          new Date(
            new Date(originalStartsAt).getTime() + Math.max(originalDuration, 5) * 60_000,
          ).toISOString(),
        total_duration_minutes: originalDuration || 30,
      })
    }

    return filtered.sort((a, b) => a.slot_start.localeCompare(b.slot_start))
  }, [
    slotsRaw,
    barberId,
    originalStartsAt,
    originalEndsAt,
    originalDuration,
    date,
    appt?.barber?.name,
  ])

  useEffect(() => {
    if (!selectedSlot || slots.length === 0) return
    if (slots.some((s) => s.slot_start === selectedSlot)) return
    const match = slots.find(
      (s) => new Date(s.slot_start).getTime() === new Date(selectedSlot).getTime(),
    )
    if (match) setSelectedSlot(match.slot_start)
  }, [slots, selectedSlot])

  const openWeekdays = useMemo(() => {
    const days = new Set<number>()
    for (const row of generalSchedules ?? []) {
      if (row.is_closed) continue
      days.add(row.day_of_week)
    }
    return days
  }, [generalSchedules])

  const isDateDisabled = (d: Date) => {
    const iso = formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd')
    const originalDate = originalStartsAt
      ? formatInTimeZone(new Date(originalStartsAt), APP_TIMEZONE, 'yyyy-MM-dd')
      : null
    if (isAppPastDate(iso) && iso !== originalDate) return true
    if (openWeekdays.size === 0) return false
    return !openWeekdays.has(appIsoDayOfWeek(iso))
  }

  const showBarberPicker = !!isAdmin
  const clientName = appt?.client ? getClientFullName(appt.client) : 'Cliente'

  const selectedServiceRows = useMemo(
    () => (services ?? []).filter((s) => selectedServices.includes(s.id)),
    [services, selectedServices],
  )

  const totals = useMemo(() => {
    const duration = selectedServiceRows.reduce((sum, s) => sum + s.duration_minutes, 0)
    const subtotal = selectedServiceRows.reduce((sum, s) => sum + s.price, 0)
    return { duration, subtotal }
  }, [selectedServiceRows])

  const toggleService = (serviceId: string) => {
    setSelectedServices((current) =>
      current.includes(serviceId)
        ? current.filter((value) => value !== serviceId)
        : [...current, serviceId],
    )
    setSelectedSlot('')
  }

  const resolveEndsAt = (startsAt: string) => {
    const servicesChanged =
      selectedServices.slice().sort().join() !== originalServiceIds.slice().sort().join()
    if (!servicesChanged && originalStartsAt && originalEndsAt && startsAt === originalStartsAt) {
      return originalEndsAt
    }
    if (!servicesChanged && originalDuration > 0) {
      return new Date(new Date(startsAt).getTime() + originalDuration * 60_000).toISOString()
    }
    return new Date(new Date(startsAt).getTime() + Math.max(totals.duration, 1) * 60_000).toISOString()
  }

  const handleSave = async () => {
    if (!appt) return
    if (!barberId) {
      notifyError('Seleccioná un barbero')
      return
    }
    if (selectedServices.length === 0) {
      notifyError('Seleccioná al menos un servicio')
      return
    }
    if (!selectedSlot) {
      notifyError('Seleccioná un horario')
      return
    }
    if (isAppPastInstant(selectedSlot) && selectedSlot !== originalStartsAt) {
      notifyError('No se pueden editar turnos al pasado')
      return
    }

    try {
      await updateAppointment.mutateAsync({
        id: appt.id,
        barber_id: barberId,
        starts_at: selectedSlot,
        service_ids: selectedServices,
        notes,
        ends_at: resolveEndsAt(selectedSlot),
      })
      notifySuccess('Turno actualizado')
      navigate(`/turnos/${appt.id}`)
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  if (isLoading || !appt || !hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (appt.status === 'cancelled') {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Editar turno"
          description="Este turno está cancelado"
          actions={
            <Button variant="outline" asChild>
              <Link to={`/turnos/${appt.id}`}>
                <ArrowLeft className="size-4" />
                Volver
              </Link>
            </Button>
          }
        />
        <p className="text-muted-foreground text-sm">No se puede editar un turno cancelado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        title="Editar turno"
        description={clientName}
        actions={
          <Button variant="outline" asChild>
            <Link to={`/turnos/${appt.id}`}>
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </Button>
        }
      />

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">1. Servicios</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(services ?? []).map((service) => (
            <ServiceCard
              key={service.id}
              id={service.id}
              name={service.name}
              durationMinutes={service.duration_minutes}
              price={service.price}
              selected={selectedServices.includes(service.id)}
              onToggle={toggleService}
            />
          ))}
        </div>
      </section>

      {showBarberPicker && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">2. Barbero</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(barbers ?? []).map((b) => (
              <BarberCard
                key={b.id}
                id={b.id}
                name={b.name}
                color={b.calendar_color}
                selected={barberId === b.id}
                subtitle="Disponible"
                onSelect={(nextId) => {
                  setBarberId(nextId)
                  setSelectedSlot('')
                }}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">{showBarberPicker ? '3. Fecha y horario' : '2. Fecha y horario'}</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start rounded-lg font-normal', !date && 'text-muted-foreground')}
                >
                  {date
                    ? formatInTimeZone(parse(date, 'yyyy-MM-dd', new Date()), APP_TIMEZONE, 'dd/MM/yyyy')
                    : 'Elegir fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parse(date, 'yyyy-MM-dd', new Date())}
                  disabled={isDateDisabled}
                  onSelect={(d) => {
                    if (!d) return
                    const next = clampAppDate(formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd'))
                    if (isDateDisabled(d)) {
                      toast.error('Ese día no está disponible')
                      return
                    }
                    setDate(next)
                    setSelectedSlot('')
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Horario</Label>
            {selectedServices.length === 0 || !barberId ? (
              <p className="text-muted-foreground text-sm">
                Elegí servicios{showBarberPicker ? ' y barbero' : ''} para ver horarios.
              </p>
            ) : slots.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay horarios disponibles ese día.</p>
            ) : (
              <TimeSlotGrid>
                {slots.map((slot) => {
                  const isSelected =
                    selectedSlot === slot.slot_start ||
                    (!!selectedSlot &&
                      new Date(selectedSlot).getTime() === new Date(slot.slot_start).getTime())
                  return (
                    <TimeSlot
                      key={slot.slot_start}
                      label={formatInTimeZone(slot.slot_start, APP_TIMEZONE, 'HH:mm')}
                      state={isSelected ? 'selected' : 'available'}
                      onClick={() => setSelectedSlot(slot.slot_start)}
                    />
                  )
                })}
              </TimeSlotGrid>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">{showBarberPicker ? '4. Notas' : '3. Notas'}</h2>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas internas (opcional)"
          className="rounded-lg"
        />
      </section>

      <div className="bg-background/95 sticky bottom-0 z-10 border-t py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              {selectedSlot
                ? `${formatInTimeZone(selectedSlot, APP_TIMEZONE, 'dd/MM/yyyy HH:mm')} - ${formatInTimeZone(resolveEndsAt(selectedSlot), APP_TIMEZONE, 'HH:mm')}`
                : 'Sin horario'}
            </p>
            <p className="text-muted-foreground">
              {selectedServiceRows.length
                ? `${selectedServiceRows.map((s) => s.name).join(', ')} · ${formatServicePrice(totals.subtotal)}`
                : 'Sin servicios'}
            </p>
          </div>
          <Button
            variant="accent"
            disabled={updateAppointment.isPending || !selectedSlot || selectedServices.length === 0}
            onClick={() => void handleSave()}
          >
            {updateAppointment.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}
