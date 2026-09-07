import { formatInTimeZone } from 'date-fns-tz'
import type { ReactNode } from 'react'
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
  const starts = formatInTimeZone(appointment.starts_at, APP_TIMEZONE, 'HH:mm')
  const ends = formatInTimeZone(appointment.ends_at, APP_TIMEZONE, 'HH:mm')
  const live = appointment.status === 'in_progress'

  if (variant === 'compact') {
    return (
      <article
        className={cn(
          'hover-surface',
          live && 'bg-primary text-primary-foreground hover:bg-primary',
          className,
        )}
      >
        <div className="flex items-stretch">
          <Link
            to={`/turnos/${appointment.id}`}
            className="grid min-w-0 flex-1 grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <p className="font-listing text-lg font-semibold tabular-nums sm:text-xl">{starts}</p>
            <p className="truncate text-sm font-semibold">{clientName}</p>
            <p className={cn('hidden truncate text-sm md:block', live ? 'opacity-80' : 'text-muted-foreground')}>
              {services}
            </p>
            <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
              <p className={cn('truncate text-xs md:hidden', live ? 'opacity-80' : 'text-muted-foreground')}>
                {services}
              </p>
              <div className="flex items-center gap-2">
                <p className={cn('hidden max-w-32 truncate text-sm sm:block', live ? 'opacity-80' : 'text-muted-foreground')}>
                  {appointment.barber?.name}
                </p>
                <AppointmentStatusBadge status={appointment.status} />
                {appointment.is_overbooking && <OverbookingIndicator />}
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center pr-1">
            <AppointmentCardMenu appointmentId={appointment.id} />
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        'listing-sheet hover-surface rounded-sm',
        live && 'bg-primary text-primary-foreground hover:bg-primary',
        className,
      )}
    >
      <div className="flex items-stretch">
        <Link
          to={`/turnos/${appointment.id}`}
          className="flex min-w-0 flex-1 items-start gap-4 p-4"
        >
          <div className="shrink-0">
            <p className="font-listing text-2xl font-semibold tabular-nums">{starts}</p>
            <p className={cn('font-listing text-xs tabular-nums', live ? 'opacity-70' : 'text-muted-foreground')}>
              {ends}
            </p>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{clientName}</p>
              <AppointmentStatusBadge status={appointment.status} />
              {appointment.is_overbooking && <OverbookingIndicator />}
            </div>
            <p className={cn('text-sm', live ? 'opacity-80' : 'text-muted-foreground')}>{services}</p>
            <div
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm',
                live ? 'opacity-80' : 'text-muted-foreground',
              )}
            >
              <span>{appointment.barber?.name}</span>
              <span className="font-listing font-semibold tabular-nums text-current">
                {formatServicePrice(Number(appointment.total_amount))}
              </span>
              {paymentStatus && <span className="capitalize">{paymentStatus}</span>}
            </div>
          </div>
        </Link>
        <div className="flex shrink-0 items-start pt-3 pr-3">
          <AppointmentCardMenu appointmentId={appointment.id} />
        </div>
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
  actions?: ReactNode
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
    <div className={cn('listing-sheet rounded-sm p-5', className)}>
      <h3 className="font-display mb-4 text-lg font-semibold tracking-wide uppercase">Resumen del turno</h3>
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
          <dd className="font-listing tabular-nums">{durationMinutes > 0 ? `${durationMinutes} min` : '—'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Fecha</dt>
          <dd>{dateLabel}</dd>
        </div>
        {timeRange && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Horario</dt>
            <dd className="font-listing font-semibold tabular-nums">{timeRange}</dd>
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
            <dd className="font-listing tabular-nums">{formatServicePrice(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="mt-2 flex justify-between gap-4 text-success">
              <dt>Descuento</dt>
              <dd className="font-listing tabular-nums">-{formatServicePrice(discount)}</dd>
            </div>
          )}
          <div className="mt-2 flex justify-between gap-4 text-base font-semibold">
            <dt>Total</dt>
            <dd className="font-listing tabular-nums">{formatServicePrice(total)}</dd>
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
