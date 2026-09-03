import { formatInTimeZone } from 'date-fns-tz'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  usePortalBookingMutations,
  usePortalBarbers,
  usePortalServices,
  usePortalSlots,
  type PortalService,
} from '@/features/portal/api'
import { APP_TIMEZONE } from '@/lib/constants'
import { appToday, isAppPastDate } from '@/lib/app-datetime'
import { cn } from '@/lib/utils'
import { formatServicePrice } from '@/types/service'

interface PortalBookingProps {
  sessionToken: string
  onBooked: () => void
}

function ServiceOption({
  service,
  checked,
  onToggle,
}: {
  service: PortalService
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors',
        checked ? 'border-accent bg-accent/10' : 'hover:border-foreground/20',
      )}
    >
      <Checkbox checked={checked} onCheckedChange={() => onToggle()} />
      <span className="min-w-0 flex-1 font-medium">{service.name}</span>
      <span className="text-muted-foreground shrink-0 text-xs sm:text-sm">
        {service.duration_minutes} min · {formatServicePrice(Number(service.price))}
      </span>
    </label>
  )
}

export function PortalBooking({ sessionToken, onBooked }: PortalBookingProps) {
  const [date, setDate] = useState(() => appToday())
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [barberId, setBarberId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: services } = usePortalServices(sessionToken)
  const serviceIds = useMemo(() => selectedServices, [selectedServices])
  const { data: barbers } = usePortalBarbers(sessionToken, serviceIds)
  const { data: slots } = usePortalSlots(sessionToken, date, serviceIds, barberId || null)
  const { bookAppointment } = usePortalBookingMutations()

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
    setSelectedSlot(null)
    setBarberId('')
    setSuccess(false)
    setMessage('')
  }

  const handleBook = async () => {
    setMessage('')
    setSuccess(false)
    if (!barberId || !selectedSlot || selectedServices.length === 0) {
      setMessage('Completá servicio, barbero y horario')
      return
    }
    if (isAppPastDate(date)) {
      setMessage('No se pueden reservar turnos en días anteriores')
      return
    }
    try {
      await bookAppointment.mutateAsync({
        token: sessionToken,
        barberId,
        startsAt: selectedSlot,
        serviceIds: selectedServices,
        notes: notes.trim() || undefined,
      })
      setSuccess(true)
      setMessage('¡Turno reservado! Te esperamos en el local.')
      setSelectedSlot(null)
      setNotes('')
      onBooked()
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <Card className="gap-4 py-5 shadow-sm">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Reservar turno</CardTitle>
        <CardDescription>Elegí el servicio, el día y el horario.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        <div className="space-y-2">
          <Label>Servicios</Label>
          <div className="space-y-2">
            {services?.map((s) => (
              <ServiceOption
                key={s.id}
                service={s}
                checked={selectedServices.includes(s.id)}
                onToggle={() => toggleService(s.id)}
              />
            ))}
          </div>
        </div>

        {selectedServices.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="portal-date">Fecha</Label>
                <Input
                  id="portal-date"
                  type="date"
                  min={appToday()}
                  value={date}
                  onChange={(e) => {
                    const next = e.target.value
                    if (isAppPastDate(next)) {
                      setMessage('No se pueden reservar turnos en días anteriores')
                      setDate(appToday())
                      setSelectedSlot(null)
                      return
                    }
                    setDate(next)
                    setSelectedSlot(null)
                    setMessage('')
                    setSuccess(false)
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portal-barber">Barbero</Label>
                <select
                  id="portal-barber"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  value={barberId}
                  onChange={(e) => {
                    setBarberId(e.target.value)
                    setSelectedSlot(null)
                    setSuccess(false)
                  }}
                >
                  <option value="">Elegir barbero</option>
                  {barbers?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {barberId && (
              <div className="space-y-2">
                <Label>Horario disponible</Label>
                {slots?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No hay horarios para esta fecha.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots?.map((slot) => (
                      <Button
                        key={slot.slot_start}
                        type="button"
                        size="sm"
                        variant={selectedSlot === slot.slot_start ? 'accent' : 'outline'}
                        onClick={() => setSelectedSlot(slot.slot_start)}
                      >
                        {formatInTimeZone(slot.slot_start, APP_TIMEZONE, 'HH:mm')}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="portal-notes">Notas (opcional)</Label>
              <Input
                id="portal-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: corte bajo a los costados"
              />
            </div>

            <Button
              variant="accent"
              className="w-full"
              disabled={bookAppointment.isPending || !selectedSlot}
              onClick={() => void handleBook()}
            >
              {bookAppointment.isPending ? 'Reservando…' : 'Confirmar reserva'}
            </Button>
          </>
        )}

        {message && (
          <p className={cn('text-sm', success ? 'text-success' : 'text-destructive')}>{message}</p>
        )}
      </CardContent>
    </Card>
  )
}
