import { formatInTimeZone } from 'date-fns-tz'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import {
  AppointmentStatusBadge,
  OverbookingIndicator,
} from '@/components/design-system/status-badges'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_TIMEZONE } from '@/lib/constants'
import type { Appointment } from '@/types/appointment'
import { getClientFullName } from '@/types/client'
import { formatServicePrice } from '@/types/service'
import { cn } from '@/lib/utils'

interface AppointmentCardProps {
  appointment: Appointment
  serviceLabel?: string
  paymentStatus?: string
  variant?: 'default' | 'compact'
  className?: string
}

export function AppointmentCard({
  appointment,
  serviceLabel,
  paymentStatus,
  variant = 'default',
  className,
}: AppointmentCardProps) {
  const clientName = appointment.client ? getClientFullName(appointment.client) : 'Cliente'
  const services =
    serviceLabel ??
    appointment.appointment_services?.map((s) => s.service_name).join(' · ') ??
    'Servicio'

  if (variant === 'compact') {
    return (
      <article
        className={cn(
          'rounded-lg border bg-card px-3 py-2 hover-surface',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{clientName}</p>
            <p className="text-muted-foreground truncate text-xs tabular-nums">
              {formatInTimeZone(appointment.starts_at, APP_TIMEZONE, 'HH:mm')}
              {' – '}
              {formatInTimeZone(appointment.ends_at, APP_TIMEZONE, 'HH:mm')}
            </p>
            <p className="text-muted-foreground truncate text-xs">{services}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="text-muted-foreground truncate text-xs">
                {appointment.barber?.name}
              </p>
              <p className="text-xs font-medium">
                {formatServicePrice(Number(appointment.total_amount))}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <AppointmentStatusBadge
                status={appointment.status}
                className="px-1.5 py-0 text-[10px]"
              />
              {appointment.is_overbooking && <OverbookingIndicator />}
            </div>
            <AppointmentCardMenu appointmentId={appointment.id} />
          </div>
        </div>
      </article>
    )
  }

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
            <p className="font-medium">{clientName}</p>
            <AppointmentStatusBadge status={appointment.status} />
            {appointment.is_overbooking && <OverbookingIndicator />}
          </div>
          <p className="text-muted-foreground text-sm">{services}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>
              {formatInTimeZone(appointment.starts_at, APP_TIMEZONE, 'HH:mm')}
              {' – '}
              {formatInTimeZone(appointment.ends_at, APP_TIMEZONE, 'HH:mm')}
            </span>
            <span>{appointment.barber?.name}</span>
            <span>{formatServicePrice(Number(appointment.total_amount))}</span>
            {paymentStatus && <span className="capitalize">{paymentStatus}</span>}
          </div>
        </div>
        <AppointmentCardMenu appointmentId={appointment.id} />
      </div>
    </article>
  )
}

function AppointmentCardMenu({ appointmentId }: { appointmentId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Acciones del turno">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={`/turnos/${appointmentId}`}>Ver detalle</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
