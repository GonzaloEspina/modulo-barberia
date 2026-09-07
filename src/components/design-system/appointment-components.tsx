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
  /** Primera fila de la cartelera: invertida a tinta (AHORA). */
  nowPlaying?: boolean
  className?: string
}

export function AppointmentCard({
  appointment,
  serviceLabel,
  paymentStatus,
  variant = 'default',
  nowPlaying = false,
  className,
}: AppointmentCardProps) {
  const clientName = appointment.client ? getClientFullName(appointment.client) : 'Cliente'
  const services =
    serviceLabel ??
    appointment.appointment_services?.map((s) => s.service_name).join(' · ') ??
    'Servicio'
  const time = formatInTimeZone(appointment.starts_at, APP_TIMEZONE, 'HH:mm')
  const end = formatInTimeZone(appointment.ends_at, APP_TIMEZONE, 'HH:mm')

  if (variant === 'compact') {
    return (
      <article
        className={cn(
          'group/interactive-row',
          nowPlaying ? 'bg-primary text-primary-foreground' : 'bg-card hover-surface',
          className,
        )}
      >
        <div className="flex items-stretch">
          <Link
            to={`/turnos/${appointment.id}`}
            className="grid min-w-0 flex-1 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 px-3 py-3 md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <div className="min-w-0">
              <p
                className={cn(
                  'font-listing text-lg font-semibold tabular-nums leading-none tracking-wide',
                  nowPlaying && 'text-primary-foreground',
                )}
              >
                {time}
              </p>
              {nowPlaying && (
                <p className="font-listing mt-1 text-[10px] font-semibold tracking-[0.16em] text-[#ffb3be] uppercase">
                  Ahora
                </p>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{clientName}</p>
              <p
                className={cn(
                  'truncate text-xs md:hidden',
                  nowPlaying ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}
              >
                {services}
                {appointment.barber?.name ? ` · ${appointment.barber.name}` : ''}
              </p>
            </div>
            <p
              className={cn(
                'hidden truncate text-sm md:block',
                nowPlaying ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
            >
              {services}
            </p>
            <div className="hidden min-w-0 items-center justify-end gap-2 md:flex">
              <span className="truncate text-sm font-medium">{appointment.barber?.name}</span>
              <AppointmentStatusBadge
                status={appointment.status}
                className="px-1.5 py-0 text-[10px]"
              />
              {appointment.is_overbooking && <OverbookingIndicator />}
            </div>
          </Link>
          <div className="flex shrink-0 items-center pr-1">
            <AppointmentCardMenu appointmentId={appointment.id} invert={nowPlaying} />
          </div>
        </div>
        <span className="sr-only">
          {time}–{end}
        </span>
      </article>
    )
  }

  return (
    <article className={cn('listing-sheet rounded-sm hover-surface', className)}>
      <div className="flex items-stretch">
        <Link
          to={`/turnos/${appointment.id}`}
          className="flex min-w-0 flex-1 items-start justify-between gap-3 p-4"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{clientName}</p>
              <AppointmentStatusBadge status={appointment.status} />
              {appointment.is_overbooking && <OverbookingIndicator />}
            </div>
            <p className="text-muted-foreground text-sm">{services}</p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 font-listing text-sm tabular-nums">
              <span>
                {time} – {end}
              </span>
              <span>{appointment.barber?.name}</span>
              <span>{formatServicePrice(Number(appointment.total_amount))}</span>
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

function AppointmentCardMenu({
  appointmentId,
  invert = false,
}: {
  appointmentId: string
  invert?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Acciones del turno"
          className={invert ? 'text-primary-foreground hover:bg-white/10 hover:text-white' : undefined}
        >
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
    <div className={cn('listing-sheet rounded-sm p-5', className)}>
      <h3 className="font-display mb-4 text-base font-semibold tracking-wide uppercase">
        Resumen del turno
      </h3>
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
          <dd className="font-listing tabular-nums">
            {durationMinutes > 0 ? `${durationMinutes} min` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Fecha</dt>
          <dd className="font-listing tabular-nums">{dateLabel}</dd>
        </div>
        {timeRange && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Horario</dt>
            <dd className="font-listing font-medium tabular-nums">{timeRange}</dd>
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
            <dd className="font-display text-xl tabular-nums tracking-wide">
              {formatServicePrice(total)}
            </dd>
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
