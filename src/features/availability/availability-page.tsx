import { formatInTimeZone } from 'date-fns-tz'
import { CalendarSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAvailableSlots } from '@/features/availability/api'
import { useBarbers } from '@/features/barbers/api'
import { useServices } from '@/features/services/api'
import { APP_TIMEZONE } from '@/lib/constants'
import { formatServiceDuration } from '@/types/service'

function todayIsoDate(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
}

export function AvailabilityPage() {
  const [date, setDate] = useState(todayIsoDate)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [barberId, setBarberId] = useState<string>('')

  const { data: services } = useServices('', true)
  const { data: barbers } = useBarbers(false)
  const { data: slots, isLoading, isError, error } = useAvailableSlots(
    date,
    selectedServices,
    barberId || null,
  )

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; slots: typeof slots }>()
    slots?.forEach((slot) => {
      const current = map.get(slot.barber_id) ?? { name: slot.barber_name, slots: [] }
      current.slots = [...(current.slots ?? []), slot]
      map.set(slot.barber_id, current)
    })
    return map
  }, [slots])

  const totalDuration = useMemo(() => {
    if (!services || selectedServices.length === 0) return 0
    return selectedServices.reduce((sum, id) => {
      const svc = services.find((s) => s.id === id)
      return sum + (svc?.duration_minutes ?? 0)
    }, 0)
  }, [selectedServices, services])

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disponibilidad"
        description="Probador del motor de turnos: fecha, servicios y barbero opcional."
      />

      <Card>
        <CardHeader>
          <CardTitle>Consulta</CardTitle>
          <CardDescription>
            Intervalo de {15} min según configuración de la organización.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="availability-date">Fecha</Label>
              <Input
                id="availability-date"
                type="date"
                className="rounded-lg"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availability-barber">Barbero (opcional)</Label>
              <select
                id="availability-barber"
                className="border-input bg-background flex h-9 w-full rounded-lg border px-3 text-sm"
                value={barberId}
                onChange={(e) => setBarberId(e.target.value)}
              >
                <option value="">Todos los barberos elegibles</option>
                {barbers?.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Servicios</Label>
            <div className="flex flex-wrap gap-2">
              {services?.map((service) => {
                const selected = selectedServices.includes(service.id)
                return (
                  <button
                    key={service.id}
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                    data-selected={selected}
                    style={{
                      borderColor: selected ? 'var(--primary)' : undefined,
                      backgroundColor: selected ? 'color-mix(in oklab, var(--primary) 12%, transparent)' : undefined,
                    }}
                    onClick={() => toggleService(service.id)}
                  >
                    {service.name}
                  </button>
                )
              })}
            </div>
            {selectedServices.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Duración estimada (general): {formatServiceDuration(totalDuration)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isError && (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      )}

      {isLoading && selectedServices.length > 0 && (
        <p className="text-muted-foreground text-sm">Calculando slots…</p>
      )}

      {selectedServices.length === 0 && (
        <EmptyState
          icon={CalendarSearch}
          title="Seleccioná al menos un servicio"
          description="Elegí uno o más servicios para consultar la disponibilidad."
        />
      )}

      {selectedServices.length > 0 && !isLoading && grouped.size === 0 && !isError && (
        <EmptyState
          icon={CalendarSearch}
          title="Sin turnos disponibles"
          description="No hay horarios para esa combinación de fecha, servicios y barbero."
        />
      )}

      {[...grouped.entries()].map(([id, group]) => (
        <Card key={id}>
          <CardHeader>
            <CardTitle className="text-base">{group.name}</CardTitle>
            <CardDescription>{group.slots?.length ?? 0} horarios disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {group.slots?.map((slot) => (
                <Badge key={`${slot.slot_start}-${slot.slot_end}`} variant="outline">
                  {formatInTimeZone(slot.slot_start, APP_TIMEZONE, 'HH:mm')} –{' '}
                  {formatInTimeZone(slot.slot_end, APP_TIMEZONE, 'HH:mm')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
