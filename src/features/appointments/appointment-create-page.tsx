import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { parse } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ClientCombobox } from '@/components/design-system/client-combobox'
import { ClientWarning } from '@/components/design-system/client-warning'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { BarberCard } from '@/components/design-system/people-cards'
import { ServiceCard, ServiceSelectionSummary } from '@/components/design-system/service-card'
import { TimeSlot, TimeSlotGrid } from '@/components/design-system/time-slot'
import { AppointmentSummary } from '@/components/design-system/appointment-components'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAvailableSlots, dedupeSlotsByStart, useScheduleGaps, areSelectedSlotsContiguous, resolveSelectedSlotBlock } from '@/features/availability/api'
import { useGeneralSchedules } from '@/features/schedules/api'
import { resolveServiceSelection } from '@/lib/service-selection'
import { formatServiceDuration } from '@/types/service'
import { useAppointmentMutations } from '@/features/appointments/api'
import { useBarbers } from '@/features/barbers/api'
import { useClient, useClients } from '@/features/clients/api'
import { useClientAbsenceWarning } from '@/features/clients/absence-api'
import { useClientMemberships } from '@/features/memberships/api'
import { useServices } from '@/features/services/api'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { appIsoDayOfWeek, appToday, clampAppDate, isAppPastDate, isAppPastInstant } from '@/lib/app-datetime'
import { APP_TIMEZONE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { getClientFullName } from '@/types/client'

type SlotMode = 'single' | 'multiple'

export function AppointmentCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: profile } = useProfile()
  const { data: clients } = useClients('')
  const { data: services } = useServices('', true)
  const { data: barbers } = useBarbers(false)
  const { data: generalSchedules } = useGeneralSchedules()
  const { createAppointment } = useAppointmentMutations()

  const [clientId, setClientId] = useState(searchParams.get('client') ?? '')
  const [barberId, setBarberId] = useState(
    searchParams.get('barber') ?? profile?.barber_id ?? '',
  )
  const [date, setDate] = useState(() =>
    clampAppDate(
      searchParams.get('date') ?? formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd'),
    ),
  )
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [slotMode, setSlotMode] = useState<SlotMode>('single')
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [membershipId, setMembershipId] = useState('')
  const [notes, setNotes] = useState('')
  const [overbooking, setOverbooking] = useState(false)
  const [overbookingReason, setOverbookingReason] = useState('')
  const [overbookingTime, setOverbookingTime] = useState('')

  const { data: selectedClient } = useClient(clientId || undefined)
  const { data: absenceWarning } = useClientAbsenceWarning(clientId || undefined)
  const { data: clientMemberships } = useClientMemberships(clientId || undefined)

  const isAdmin = profile && isAdminRole(profile)

  const activeMemberships = useMemo(
    () =>
      (clientMemberships ?? []).filter(
        (m) =>
          m.status === 'active' &&
          m.payment_confirmed &&
          (m.appointments_remaining as number) > 0 &&
          (m.expires_at as string) >= formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd'),
      ),
    [clientMemberships],
  )

  useEffect(() => {
    if (!isAdmin && profile?.barber_id) setBarberId(profile.barber_id)
  }, [isAdmin, profile?.barber_id])

  useEffect(() => {
    setMembershipId('')
  }, [clientId])

  const { data: slotsRaw } = useAvailableSlots(
    date,
    selectedServices,
    barberId || null,
    !overbooking && selectedServices.length > 0,
  )
  const { data: scheduleGaps } = useScheduleGaps(date, barberId || null, !overbooking)

  const slots = useMemo(() => {
    if (!slotsRaw) return slotsRaw
    const base = barberId ? slotsRaw : dedupeSlotsByStart(slotsRaw)
    return base.filter((s) => !isAppPastInstant(s.slot_start))
  }, [slotsRaw, barberId])

  const openWeekdays = useMemo(() => {
    const days = new Set<number>()
    for (const row of generalSchedules ?? []) {
      if (row.is_active) days.add(row.day_of_week)
    }
    return days
  }, [generalSchedules])

  const isDateDisabled = (day: Date) => {
    const ymd = formatInTimeZone(day, APP_TIMEZONE, 'yyyy-MM-dd')
    if (isAppPastDate(ymd)) return true
    if (openWeekdays.size === 0) return false
    return !openWeekdays.has(appIsoDayOfWeek(ymd))
  }

  useEffect(() => {
    if (isAppPastDate(date) || (openWeekdays.size > 0 && !openWeekdays.has(appIsoDayOfWeek(date)))) {
      setDate(appToday())
      setSelectedSlots([])
    }
  }, [date, openWeekdays])

  useEffect(() => {
    if (!overbooking) return
    if (!overbookingTime) {
      setSelectedSlots([])
      return
    }
    setSelectedSlots([fromZonedTime(`${date}T${overbookingTime}:00`, APP_TIMEZONE).toISOString()])
  }, [overbooking, overbookingTime, date])

  useEffect(() => {
    if (overbooking || selectedSlots.length === 0 || !slots) return
    const valid = new Set(slots.map((s) => s.slot_start))
    const next = selectedSlots.filter((s) => valid.has(s))
    if (next.length !== selectedSlots.length) setSelectedSlots(next)
  }, [slots, selectedSlots, overbooking])

  const urlTime = searchParams.get('time')

  useEffect(() => {
    if (overbooking || !urlTime || selectedServices.length === 0 || !slots?.length) return
    if (selectedSlots.length > 0) return
    const match = slots.find(
      (s) => formatInTimeZone(s.slot_start, APP_TIMEZONE, 'HH:mm') === urlTime,
    )
    if (match) {
      setSelectedSlots([match.slot_start])
      if (!barberId) setBarberId(match.barber_id)
    }
  }, [urlTime, slots, selectedServices.length, overbooking, barberId, selectedSlots.length])

  const filteredBarbers = useMemo(() => {
    if (isAdmin) return barbers
    return barbers?.filter((b) => b.id === profile?.barber_id)
  }, [barbers, isAdmin, profile?.barber_id])

  const selectedServiceRows = useMemo(
    () => (services ?? []).filter((s) => selectedServices.includes(s.id)),
    [services, selectedServices],
  )

  const totals = useMemo(() => {
    const duration = selectedServiceRows.reduce((sum, s) => sum + s.duration_minutes, 0)
    const subtotal = selectedServiceRows.reduce((sum, s) => sum + Number(s.price), 0)
    return { duration, subtotal, total: membershipId ? 0 : subtotal }
  }, [selectedServiceRows, membershipId])

  const selectedBarber = barbers?.find((b) => b.id === barberId)

  const slotBlock = useMemo(
    () => resolveSelectedSlotBlock(slots ?? [], selectedSlots),
    [slots, selectedSlots],
  )

  const blockDurationMinutes = slotBlock?.durationMinutes ?? totals.duration

  useEffect(() => {
    if (filteredBarbers?.length === 1) {
      setBarberId(filteredBarbers[0].id)
    }
  }, [filteredBarbers])

  const toggleService = (id: string) => {
    setSelectedServices((prev) => resolveServiceSelection(prev, id, services ?? []))
    setSelectedSlots([])
  }

  const selectSlot = (slotStart: string, slotBarberId: string) => {
    if (slotMode === 'single') {
      setSelectedSlots([slotStart])
      if (!barberId) setBarberId(slotBarberId)
      return
    }

    const prevSameBarber = selectedSlots.filter((start) => {
      const row = slots?.find((s) => s.slot_start === start)
      return row?.barber_id === slotBarberId
    })

    if (selectedSlots.includes(slotStart)) {
      setSelectedSlots(prevSameBarber.filter((s) => s !== slotStart))
      return
    }

    const next = [...prevSameBarber, slotStart]
    if (!areSelectedSlotsContiguous(slots ?? [], next)) {
      toast.error('En modo múltiple los horarios deben ser consecutivos, sin huecos')
      return
    }
    setSelectedSlots(next)
    if (!barberId) setBarberId(slotBarberId)
  }

  const timeRange = useMemo(() => {
    if (!slotBlock) return undefined
    return `${formatInTimeZone(slotBlock.starts_at, APP_TIMEZONE, 'HH:mm')} → ${formatInTimeZone(slotBlock.ends_at, APP_TIMEZONE, 'HH:mm')}`
  }, [slotBlock])

  const handleSubmit = async () => {
    if (!clientId || !barberId || selectedServices.length === 0) {
      toast.error('Completá cliente, barbero y servicios')
      return
    }
    if (isAppPastDate(date)) {
      toast.error('No se pueden crear turnos en días anteriores')
      return
    }
    if (overbooking) {
      if (!overbookingTime) {
        toast.error('Ingresá la hora del sobreturno')
        return
      }
      if (!overbookingReason.trim()) {
        toast.error('Ingresá el motivo del sobreturno')
        return
      }
      const overbookingStart = fromZonedTime(`${date}T${overbookingTime}:00`, APP_TIMEZONE)
      if (overbookingStart.getTime() < Date.now()) {
        toast.error('No se pueden crear turnos en el pasado')
        return
      }
    } else if (!slotBlock) {
      toast.error(
        slotMode === 'multiple'
          ? 'Seleccioná uno o más horarios consecutivos'
          : 'Completá cliente, barbero, servicios y horario',
      )
      return
    }
    try {
      const startsAt = overbooking
        ? selectedSlots[0]
        : slotBlock!.starts_at
      if (!startsAt) {
        toast.error('Completá el horario del turno')
        return
      }

      const isMultiBlock =
        !overbooking &&
        slotBlock != null &&
        slotBlock.durationMinutes > totals.duration

      await createAppointment.mutateAsync({
        client_id: clientId,
        barber_id: barberId,
        starts_at: startsAt,
        ends_at: isMultiBlock ? slotBlock!.ends_at : null,
        service_ids: selectedServices,
        client_membership_id: membershipId || null,
        is_overbooking: overbooking,
        overbooking_reason: overbooking ? overbookingReason : null,
        notes: notes || null,
      })
      toast.success('Turno creado correctamente')
      navigate('/turnos')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo turno"
        description="Seleccioná cliente, servicios, fecha y horario."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {(selectedClient?.manual_warning || absenceWarning?.warning) && (
            <ClientWarning
              message={
                absenceWarning?.message
                  ?? selectedClient?.manual_warning_reason
                  ?? 'Revisar historial antes de confirmar.'
              }
            />
          )}

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">1. Cliente</h2>
            <ClientCombobox
              clients={clients ?? []}
              value={clientId}
              onChange={setClientId}
            />
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">2. Servicios</h2>
            <div className="flex flex-wrap gap-2">
              {services?.map((s) => (
                <ServiceCard
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  durationMinutes={s.duration_minutes}
                  price={Number(s.price)}
                  selected={selectedServices.includes(s.id)}
                  onToggle={toggleService}
                />
              ))}
            </div>
            <div className="mt-3">
              <ServiceSelectionSummary
                count={selectedServices.length}
                durationMinutes={totals.duration}
                totalPrice={totals.subtotal}
              />
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">3. Fecha y horario</h2>
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
                        const next = formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd')
                        if (isDateDisabled(d)) {
                          toast.error('Ese día no está disponible')
                          return
                        }
                        setDate(next)
                        setSelectedSlots([])
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {clientId && activeMemberships.length > 0 && (
                <div className="space-y-2">
                  <Label>Membresía (opcional)</Label>
                  <select
                    className="border-input bg-background flex h-10 w-full rounded-lg border px-3 text-sm"
                    value={membershipId}
                    onChange={(e) => setMembershipId(e.target.value)}
                  >
                    <option value="">Sin membresía</option>
                    {activeMemberships.map((m) => (
                      <option key={m.id as string} value={m.id as string}>
                        {m.plan_name as string} — {m.appointments_remaining as number} restantes
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isAdmin && (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Sobreturno</p>
                    <p className="text-muted-foreground text-xs">Acción excepcional para admin</p>
                  </div>
                  <Switch
                    checked={overbooking}
                    onCheckedChange={(checked) => {
                      setOverbooking(checked)
                      if (!checked) {
                        setOverbookingTime('')
                        setOverbookingReason('')
                        setSelectedSlots([])
                      }
                    }}
                  />
                </div>
              )}

              {overbooking && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="overbooking-time">Hora de inicio</Label>
                    <Input
                      id="overbooking-time"
                      type="time"
                      className="rounded-lg sm:max-w-[160px]"
                      value={overbookingTime}
                      onChange={(e) => setOverbookingTime(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      Fecha: {formatInTimeZone(parse(date, 'yyyy-MM-dd', new Date()), APP_TIMEZONE, 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overbooking-reason">Motivo del sobreturno</Label>
                    <Input
                      id="overbooking-reason"
                      className="rounded-lg"
                      placeholder="Ej. cliente VIP, urgencia…"
                      value={overbookingReason}
                      onChange={(e) => setOverbookingReason(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {!overbooking && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tipo de turno</Label>
                    <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                      <Button
                        type="button"
                        variant={slotMode === 'single' ? 'default' : 'outline'}
                        className="rounded-lg"
                        onClick={() => {
                          setSlotMode('single')
                          setSelectedSlots((prev) => (prev.length > 1 ? [prev[0]] : prev))
                        }}
                      >
                        Individual
                      </Button>
                      <Button
                        type="button"
                        variant={slotMode === 'multiple' ? 'default' : 'outline'}
                        className="rounded-lg"
                        onClick={() => setSlotMode('multiple')}
                      >
                        Múltiple
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {slotMode === 'single'
                        ? 'Un solo horario: al elegir otro, reemplaza el anterior.'
                        : 'Varios cupos seguidos para un mismo turno (ej. ocupar dos horarios).'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Horarios disponibles</Label>
                    {selectedServices.length === 0 ? (
                      <>
                        <p className="text-muted-foreground text-xs">
                          Huecos libres en la agenda. Elegí servicios para ver horarios exactos según duración.
                        </p>
                        {scheduleGaps?.length === 0 ? (
                          <p className="text-muted-foreground text-sm">Sin disponibilidad para esta fecha.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {scheduleGaps?.map((gap) => (
                              <span
                                key={`${gap.gap_start}-${gap.barber_id}`}
                                className="bg-muted/60 text-muted-foreground rounded-lg border px-3 py-2 text-xs"
                              >
                                {formatInTimeZone(gap.gap_start, APP_TIMEZONE, 'HH:mm')}
                                {' – '}
                                {formatInTimeZone(gap.gap_end, APP_TIMEZONE, 'HH:mm')}
                                <span className="text-foreground/70 ml-1.5 font-medium">
                                  ({formatServiceDuration(gap.duration_minutes)})
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground text-xs">
                          Duración de servicios: {formatServiceDuration(totals.duration)}
                          {slotBlock && slotBlock.durationMinutes > totals.duration
                            ? ` · Bloque reservado: ${formatServiceDuration(slotBlock.durationMinutes)}`
                            : null}
                          {'. '}
                          {slotMode === 'multiple'
                            ? 'Tocá varios horarios consecutivos.'
                            : 'Solo se muestran horarios donde entra el servicio completo.'}
                        </p>
                        {slots?.length === 0 ? (
                          <p className="text-muted-foreground text-sm">Sin horarios para esta combinación.</p>
                        ) : (
                          <TimeSlotGrid>
                            {slots?.map((slot) => (
                              <TimeSlot
                                key={slot.slot_start}
                                label={formatInTimeZone(slot.slot_start, APP_TIMEZONE, 'HH:mm')}
                                state={selectedSlots.includes(slot.slot_start) ? 'selected' : 'available'}
                                onClick={() => selectSlot(slot.slot_start, slot.barber_id)}
                              />
                            ))}
                          </TimeSlotGrid>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </section>

          {filteredBarbers && filteredBarbers.length > 1 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 font-semibold">4. Barbero</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredBarbers?.map((b) => (
                  <BarberCard
                    key={b.id}
                    id={b.id}
                    name={b.name}
                    color={b.calendar_color}
                    selected={barberId === b.id}
                    subtitle="Disponible"
                    onSelect={(id) => {
                      setBarberId(id)
                      setSelectedSlots([])
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <AppointmentSummary
            clientName={selectedClient ? getClientFullName(selectedClient) : undefined}
            services={selectedServiceRows.map((s) => s.name)}
            durationMinutes={blockDurationMinutes}
            dateLabel={formatInTimeZone(`${date}T12:00:00`, APP_TIMEZONE, 'dd/MM/yyyy')}
            timeRange={timeRange}
            barberName={selectedBarber?.name}
            subtotal={totals.subtotal}
            total={totals.total}
            membershipNote={
              membershipId ? 'Se descontará 1 turno de la membresía al confirmar.' : undefined
            }
            actions={
              <>
                <Button
                  variant="accent"
                  className="w-full"
                  disabled={createAppointment.isPending}
                  onClick={() => void handleSubmit()}
                >
                  Confirmar turno
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate('/turnos')}>
                  Cancelar
                </Button>
              </>
            }
          />
        </div>
      </div>
    </div>
  )
}
