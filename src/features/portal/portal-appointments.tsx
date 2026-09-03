import { formatInTimeZone } from 'date-fns-tz'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_TIMEZONE } from '@/lib/constants'
import type { PortalAppointment } from '@/features/portal/api'
import { formatServicePrice } from '@/types/service'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Pendiente',
  in_progress: 'Pendiente',
  completed: 'Asistió',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
}

function AppointmentCard({ appointment }: { appointment: PortalAppointment }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium">
        {formatInTimeZone(appointment.starts_at, APP_TIMEZONE, 'EEE dd/MM/yyyy · HH:mm')}
      </p>
      {appointment.service_names && (
        <p className="mt-1">{appointment.service_names}</p>
      )}
      <p className="text-muted-foreground">
        {appointment.barber_name} · {formatServicePrice(Number(appointment.total_amount))}
      </p>
      <Badge variant="outline" className="mt-2">
        {STATUS_LABELS[appointment.status] ?? appointment.status}
      </Badge>
    </div>
  )
}

interface PortalAppointmentsProps {
  upcoming: PortalAppointment[]
  past: PortalAppointment[]
}

export function PortalAppointments({ upcoming, past }: PortalAppointmentsProps) {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis turnos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tenés turnos próximos.</p>
          ) : (
            upcoming.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))
          )}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Historial</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((value) => !value)}
            >
              {showHistory ? 'Ocultar' : 'Ver historial'}
            </Button>
          </CardHeader>
          {showHistory && (
            <CardContent className="space-y-2">
              {past.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
