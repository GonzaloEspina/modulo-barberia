import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { CalendarCheck, Clock } from 'lucide-react'
import { useState } from 'react'
import { AppointmentStatusBadge } from '@/components/design-system/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_TIMEZONE } from '@/lib/constants'
import type { PortalAppointment } from '@/features/portal/api'
import { formatServicePrice } from '@/types/service'
import type { AppointmentStatus } from '@/types/appointment'

function formatAppointmentWhen(startsAt: string) {
  return format(toZonedTime(startsAt, APP_TIMEZONE), "EEEE dd/MM/yyyy · HH:mm", { locale: es })
}

function PortalAppointmentRow({ appointment }: { appointment: PortalAppointment }) {
  return (
    <article className="flex items-start gap-3 border-b border-border px-3 py-3 last:border-0">
      <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-sm">
        <Clock className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium capitalize">{formatAppointmentWhen(appointment.starts_at)}</p>
        {appointment.service_names && (
          <p className="text-sm">{appointment.service_names}</p>
        )}
        <p className="text-muted-foreground text-sm">
          {appointment.barber_name}
          {appointment.total_amount > 0 ? ` · ${formatServicePrice(Number(appointment.total_amount))}` : ''}
        </p>
      </div>
      <AppointmentStatusBadge
        status={appointment.status as AppointmentStatus}
        className="shrink-0 px-1.5 py-0 text-[10px]"
      />
    </article>
  )
}

interface PortalAppointmentsProps {
  upcoming: PortalAppointment[]
  past: PortalAppointment[]
  canBook?: boolean
  hasUpcoming?: boolean
}

export function PortalAppointments({
  upcoming,
  past,
  canBook = false,
  hasUpcoming = false,
}: PortalAppointmentsProps) {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <Card className="gap-4 rounded-sm py-5 shadow-none">
      <CardHeader className="px-5">
        <CardTitle className="font-display text-base font-semibold tracking-wide uppercase">
          Mis turnos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="bg-muted text-muted-foreground mb-3 flex size-12 items-center justify-center rounded-sm">
              <CalendarCheck className="size-5" aria-hidden />
            </div>
            <p className="font-medium">No tenés turnos próximos</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              {canBook
                ? 'Elegí un servicio más abajo para reservar tu próximo corte.'
                : 'Cuando tengas un turno, va a aparecer acá.'}
            </p>
          </div>
        ) : (
          <>
            {upcoming.map((appointment) => (
              <PortalAppointmentRow key={appointment.id} appointment={appointment} />
            ))}
            {hasUpcoming && (
              <p className="text-muted-foreground text-sm">
                Ya tenés un turno a futuro. Si necesitás otro, pedilo en el local.
              </p>
            )}
          </>
        )}

        {past.length > 0 && (
          <div className="pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowHistory((value) => !value)}
            >
              {showHistory ? 'Ocultar historial' : `Ver historial (${past.length})`}
            </Button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {past.map((appointment) => (
                  <PortalAppointmentRow key={appointment.id} appointment={appointment} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
