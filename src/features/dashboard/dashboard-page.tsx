import { endOfMonth, startOfMonth } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, UserX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppointmentCard } from '@/components/design-system/appointment-components'
import { BoxOfficeBar, EmptyState, SectionHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointments } from '@/features/appointments/api'
import { APP_TIMEZONE } from '@/lib/constants'
import { getSupabaseClient } from '@/lib/supabase'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatServicePrice } from '@/types/service'

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
}

function monthBalanceHref() {
  const zoned = toZonedTime(new Date(), APP_TIMEZONE)
  const from = formatInTimeZone(startOfMonth(zoned), APP_TIMEZONE, 'yyyy-MM-dd')
  const to = formatInTimeZone(endOfMonth(zoned), APP_TIMEZONE, 'yyyy-MM-dd')
  return `/balance?from=${from}&to=${to}`
}

export function DashboardPage() {
  const isMobile = useIsMobile()
  const { data: profile } = useProfile()
  const today = todayIso()
  const { data: appointments, isLoading: loadingAppointments } = useAppointments(today, today)

  const isAdmin = profile && isAdminRole(profile)

  const { data: balance, isLoading: loadingBalance } = useQuery({
    queryKey: ['dashboard-balance', today, profile?.barber_id, isAdmin],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_balance_summary', {
        p_from: today,
        p_to: today,
        p_barber_id: isAdmin ? null : profile?.barber_id ?? null,
        p_service_id: null,
        p_payment_method_id: null,
      })
      if (error) throw error
      return (data as Array<{ production: number; cash: number; expenses: number; net_profit: number }>)[0]
    },
    enabled: !!profile,
  })

  if (!profile) return null

  const todayAppointments = (appointments ?? []).filter((a) => a.status !== 'cancelled')
  const upcoming = todayAppointments
    .filter((a) => new Date(a.starts_at) >= new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const absences = todayAppointments.filter((a) => a.status === 'no_show').length
  const production = Number(balance?.production ?? 0)
  const cash = Number(balance?.cash ?? 0)
  const pendingBalance = production - cash
  const orgName = profile.organization?.name ?? 'Barbatero'
  const dateLabel = formatInTimeZone(new Date(), APP_TIMEZONE, 'dd/MM/yyyy')

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="font-display text-3xl font-semibold tracking-wide uppercase sm:text-4xl">{orgName}</p>
          <p className="text-muted-foreground font-listing text-sm tabular-nums">Hoy · {dateLabel}</p>
        </div>
        <Button variant="accent" asChild>
          <Link to="/turnos/nuevo">Nuevo turno</Link>
        </Button>
      </div>

      <section>
        <SectionHeader
          title="Cartelera de hoy"
          action={
            upcoming.length > 0 ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/turnos">Ver todos</Link>
              </Button>
            ) : undefined
          }
        />
        {loadingAppointments ? (
          <div className="space-y-1">
            <Skeleton className="h-14 rounded-sm" />
            <Skeleton className="h-14 rounded-sm" />
          </div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No hay turnos próximos para hoy"
            description="Creá un turno para comenzar a llenar la agenda."
            action={
              <Button variant="accent" asChild>
                <Link to="/turnos/nuevo">Crear turno</Link>
              </Button>
            }
          />
        ) : (
          <div className="listing-sheet divide-y overflow-hidden rounded-sm">
            <div className="text-muted-foreground hidden grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 px-3 py-2 font-listing text-[11px] font-semibold tracking-[0.12em] uppercase md:grid">
              <span>Hora</span>
              <span>Cliente</span>
              <span>Servicio</span>
              <span>Sala</span>
            </div>
            {upcoming.slice(0, isMobile ? 5 : 8).map((appt) => (
              <AppointmentCard key={appt.id} appointment={appt} variant="compact" />
            ))}
          </div>
        )}
        {absences > 0 && (
          <p className="bg-accent text-accent-foreground font-listing mt-3 inline-flex items-center gap-2 rounded-sm px-2.5 py-1 text-xs font-semibold tracking-wide uppercase">
            <UserX className="size-3.5" aria-hidden />
            {absences} {absences === 1 ? 'ausencia' : 'ausencias'} registradas hoy
          </p>
        )}
      </section>

      <section className="space-y-2">
        {loadingBalance ? (
          <Skeleton className="h-28 rounded-sm" />
        ) : (
          <BoxOfficeBar
            left={{ label: 'Producción', value: formatServicePrice(production) }}
            right={{ label: 'Caja', value: formatServicePrice(cash) }}
            note={`Pendiente ${formatServicePrice(pendingBalance)} · ${todayAppointments.length} ${todayAppointments.length === 1 ? 'turno' : 'turnos'} hoy`}
          />
        )}
        <Button variant="link" size="sm" className="h-auto px-0 text-xs sm:text-sm" asChild>
          <Link to={monthBalanceHref()}>
            <span className="sm:hidden">Ver balance</span>
            <span className="hidden sm:inline">Facturación del mes en Balance</span>
          </Link>
        </Button>
      </section>
    </div>
  )
}
