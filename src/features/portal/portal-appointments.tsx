import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { AppointmentStatusBadge } from '@/components/design-system/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_TIMEZONE } from '@/lib/constants'
import type { PortalAppointment } from '@/features/portal/api'
import { formatServicePrice } from '@/types/service'
import type { AppointmentStatus } from '@/types/appointment'

function formatAppointmentWhen(startsAt: string) {
  return format(toZonedTime(startsAt, APP_TIMEZONE), "EEEE dd/MM/yyyy", { locale: es })
}

function formatAppointmentTime(startsAt: string) {
  return format(toZonedTime(startsAt, APP_TIMEZONE), 'HH:mm')
}

function PortalAppointmentRow({ appointment }: { appointment: PortalAppointment }) {
  return (
    <article className="flex items-start gap-3 py-3">
      <p className="font-listing w-12 shrink-0 text-lg font-semibold tabular-nums">
        {formatAppointmentTime(appointment.starts_at)}
      </p>
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
        className="shrink-0"
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
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="font-display text-lg tracking-wide uppercase">Mis turnos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-5">
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <CalendarCheck className="text-muted-foreground mb-3 size-6" aria-hidden />
            <p className="font-display text-lg font-semibold tracking-wide uppercase">No tenés turnos próximos</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              {canBook
                ? 'Elegí un servicio más abajo para reservar tu próximo corte.'
                : 'Cuando tengas un turno, va a aparecer acá.'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y">
              {upcoming.map((appointment) => (
                <PortalAppointmentRow key={appointment.id} appointment={appointment} />
              ))}
            </div>
            {hasUpcoming && (
              <p className="text-muted-foreground pt-2 text-sm">
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
              <div className="mt-1 divide-y">
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
