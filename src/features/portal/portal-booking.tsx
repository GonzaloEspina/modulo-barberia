import { formatInTimeZone } from 'date-fns-tz'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  usePortalBookingMutations,
  usePortalBarbers,
  usePortalServices,
  usePortalSlots,
} from '@/features/portal/api'
import { APP_TIMEZONE } from '@/lib/constants'
import { formatServicePrice } from '@/types/service'

interface PortalBookingProps {
  sessionToken: string
  onBooked: () => void
}

export function PortalBooking({ sessionToken, onBooked }: PortalBookingProps) {
  const [date, setDate] = useState(formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd'))
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [barberId, setBarberId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')

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
  }

  const handleBook = async () => {
    setMessage('')
    if (!barberId || !selectedSlot || selectedServices.length === 0) {
      setMessage('Completá servicio, barbero y horario')
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
      setMessage('¡Turno reservado! Te esperamos en el local.')
      setSelectedSlot(null)
      setNotes('')
      onBooked()
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reservar turno</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Servicios</Label>
          <div className="space-y-2">
            {services?.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={selectedServices.includes(s.id)}
                  onChange={() => toggleService(s.id)}
                />
                <span className="flex-1">{s.name}</span>
                <span className="text-muted-foreground">
                  {s.duration_minutes} min · {formatServicePrice(Number(s.price))}
                </span>
              </label>
            ))}
          </div>
        </div>

        {selectedServices.length > 0 && (
          <>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelectedSlot(null) }} />
            </div>

            <div className="space-y-2">
              <Label>Barbero</Label>
              <select
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                value={barberId}
                onChange={(e) => { setBarberId(e.target.value); setSelectedSlot(null) }}
              >
                <option value="">Elegir barbero</option>
                {barbers?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {barberId && (
              <div className="space-y-2">
                <Label>Horario disponible</Label>
                {slots?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No hay horarios para esta fecha.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
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
              <Label>Notas (opcional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: corte bajo a los costados" />
            </div>

            <Button
              variant="accent"
              className="w-full"
              disabled={bookAppointment.isPending || !selectedSlot}
              onClick={() => void handleBook()}
            >
              Confirmar reserva
            </Button>
          </>
        )}

        {message && <p className="text-sm">{message}</p>}
      </CardContent>
    </Card>
  )
}
