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
import { useAvailableSlots, dedupeSlotsByStart, useScheduleGaps } from '@/features/availability/api'
import { resolveServiceSelection } from '@/lib/service-selection'
import { formatServiceDuration } from '@/types/service'
import { useAppointmentMutations } from '@/features/appointments/api'
import { useBarbers } from '@/features/barbers/api'
import { useClient, useClients } from '@/features/clients/api'
import { useClientAbsenceWarning } from '@/features/clients/absence-api'
import { useClientMemberships } from '@/features/memberships/api'
import { useServices } from '@/features/services/api'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { APP_TIMEZONE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { getClientFullName } from '@/types/client'

export function AppointmentCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: profile } = useProfile()
  const { data: clients } = useClients('')
  const { data: services } = useServices('', true)
  const { data: barbers } = useBarbers(false)
  const { createAppointment } = useAppointmentMutations()

  const [clientId, setClientId] = useState(searchParams.get('client') ?? '')
  const [barberId, setBarberId] = useState(
    searchParams.get('barber') ?? profile?.barber_id ?? '',
  )
  const [date, setDate] = useState(
    searchParams.get('date') ?? formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd'),
  )
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
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
    if (barberId) return slotsRaw
    return dedupeSlotsByStart(slotsRaw)
  }, [slotsRaw, barberId])

  useEffect(() => {
    if (!overbooking) return
    if (!overbookingTime) {
      setSelectedSlot(null)
      return
    }
    setSelectedSlot(fromZonedTime(`${date}T${overbookingTime}:00`, APP_TIMEZONE).toISOString())
  }, [overbooking, overbookingTime, date])

  useEffect(() => {
    if (overbooking || !selectedSlot || !slots) return
    const stillValid = slots.some((s) => s.slot_start === selectedSlot)
    if (!stillValid) setSelectedSlot(null)
  }, [slots, selectedSlot, overbooking])

  const urlTime = searchParams.get('time')

  useEffect(() => {
    if (overbooking || !urlTime || selectedServices.length === 0 || !slots?.length) return
    const match = slots.find(
      (s) => formatInTimeZone(s.slot_start, APP_TIMEZONE, 'HH:mm') === urlTime,
    )
    if (match) {
      setSelectedSlot(match.slot_start)
      if (!barberId) setBarberId(match.barber_id)
    }
  }, [urlTime, slots, selectedServices.length, overbooking, barberId])

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

  useEffect(() => {
    if (filteredBarbers?.length === 1) {
      setBarberId(filteredBarbers[0].id)
    }
  }, [filteredBarbers])

  const toggleService = (id: string) => {
    setSelectedServices((prev) => resolveServiceSelection(prev, id, services ?? []))
    setSelectedSlot(null)
  }

  const timeRange = useMemo(() => {
    if (!selectedSlot || totals.duration === 0) return undefined
    const end = new Date(new Date(selectedSlot).getTime() + totals.duration * 60_000)
    return `${formatInTimeZone(selectedSlot, APP_TIMEZONE, 'HH:mm')} → ${formatInTimeZone(end.toISOString(), APP_TIMEZONE, 'HH:mm')}`
  }, [selectedSlot, totals.duration])

  const handleSubmit = async () => {
    if (!clientId || !barberId || selectedServices.length === 0) {
      toast.error('Completá cliente, barbero y servicios')
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
    } else if (!selectedSlot) {
      toast.error('Completá cliente, barbero, servicios y horario')
      return
    }
    try {
      await createAppointment.mutateAsync({
        client_id: clientId,
        barber_id: barberId,
        starts_at: selectedSlot!,
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
                      onSelect={(d) => {
                        if (d) {
                          setDate(formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd'))
                          setSelectedSlot(null)
                        }
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
                        setSelectedSlot(null)
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
                        Duración total: {formatServiceDuration(totals.duration)}. Solo se muestran horarios donde entra completo.
                      </p>
                      {slots?.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Sin horarios para esta combinación.</p>
                      ) : (
                        <TimeSlotGrid>
                          {slots?.map((slot) => (
                            <TimeSlot
                              key={slot.slot_start}
                              label={formatInTimeZone(slot.slot_start, APP_TIMEZONE, 'HH:mm')}
                              state={selectedSlot === slot.slot_start ? 'selected' : 'available'}
                              onClick={() => {
                                setSelectedSlot(slot.slot_start)
                                if (!barberId) setBarberId(slot.barber_id)
                              }}
                            />
                          ))}
                        </TimeSlotGrid>
                      )}
                    </>
                  )}
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
                      setSelectedSlot(null)
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
            durationMinutes={totals.duration}
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
