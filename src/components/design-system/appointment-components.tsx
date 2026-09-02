import { formatInTimeZone } from 'date-fns-tz'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { AppointmentStatusBadge } from '@/components/design-system/status-badges'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_TIMEZONE } from '@/lib/constants'
import type { Appointment } from '@/types/appointment'
import { formatServicePrice } from '@/types/service'
import { cn } from '@/lib/utils'

interface AppointmentCardProps {
  appointment: Appointment
  serviceLabel?: string
  paymentStatus?: string
  className?: string
}

export function AppointmentCard({
  appointment,
  serviceLabel,
  paymentStatus,
  className,
}: AppointmentCardProps) {
  const clientName = appointment.client
    ? `${appointment.client.first_name} ${appointment.client.last_name}`
    : 'Cliente'
  const services =
    serviceLabel ??
    appointment.appointment_services?.map((s) => s.service_name).join(' · ') ??
    'Servicio'

  return (
    <article
      className={cn(
        'rounded-xl border bg-card p-4 hover-surface',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: appointment.barber?.calendar_color ?? '#71717A' }}
              aria-hidden
            />
            <p className="font-medium">
              {formatInTimeZone(appointment.starts_at, APP_TIMEZONE, 'HH:mm')}
              {' – '}
              {formatInTimeZone(appointment.ends_at, APP_TIMEZONE, 'HH:mm')}
            </p>
            <AppointmentStatusBadge status={appointment.status} />
            {appointment.is_overbooking && (
              <span className="bg-warning/10 text-warning rounded-full px-2 py-0.5 text-xs font-medium">
                Sobreturno
              </span>
            )}
          </div>
          <div>
            <p className="font-medium">{clientName}</p>
            <p className="text-muted-foreground text-sm">{services}</p>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>{appointment.barber?.name}</span>
            <span>{formatServicePrice(Number(appointment.total_amount))}</span>
            {paymentStatus && <span className="capitalize">{paymentStatus}</span>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Acciones del turno">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/turnos/${appointment.id}`}>Ver detalle</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

interface AppointmentSummaryProps {
  clientName?: string
  services: string[]
  durationMinutes: number
  dateLabel: string
  timeRange?: string
  barberName?: string
  subtotal: number
  discount?: number
  total: number
  membershipNote?: string
  actions?: React.ReactNode
  className?: string
}

export function AppointmentSummary({
  clientName,
  services,
  durationMinutes,
  dateLabel,
  timeRange,
  barberName,
  subtotal,
  discount = 0,
  total,
  membershipNote,
  actions,
  className,
}: AppointmentSummaryProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5', className)}>
      <h3 className="mb-4 font-semibold">Resumen del turno</h3>
      <dl className="space-y-3 text-sm">
        {clientName && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Cliente</dt>
            <dd className="text-right font-medium">{clientName}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Servicios</dt>
          <dd className="text-right">{services.length ? services.join(', ') : '—'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Duración</dt>
          <dd>{durationMinutes > 0 ? `${durationMinutes} min` : '—'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Fecha</dt>
          <dd>{dateLabel}</dd>
        </div>
        {timeRange && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Horario</dt>
            <dd className="font-medium">{timeRange}</dd>
          </div>
        )}
        {barberName && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Barbero</dt>
            <dd>{barberName}</dd>
          </div>
        )}
        <div className="border-t pt-3">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatServicePrice(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="mt-2 flex justify-between gap-4 text-success">
              <dt>Descuento</dt>
              <dd>-{formatServicePrice(discount)}</dd>
            </div>
          )}
          <div className="mt-2 flex justify-between gap-4 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatServicePrice(total)}</dd>
          </div>
        </div>
      </dl>
      {membershipNote && (
        <p className="text-muted-foreground mt-3 text-xs">{membershipNote}</p>
      )}
      {actions && <div className="mt-5 space-y-2">{actions}</div>}
    </div>
  )
}
