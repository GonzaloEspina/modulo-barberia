import { endOfMonth, startOfMonth } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck,
  CircleDollarSign,
  Receipt,
  UserX,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppointmentCard } from '@/components/design-system/appointment-components'
import { MetricCard } from '@/components/design-system/metric-card'
import { EmptyState, PageHeader, SectionHeader } from '@/components/design-system/layout-primitives'
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
  const estimated = todayAppointments.reduce((sum, a) => sum + Number(a.total_amount), 0)
  const production = Number(balance?.production ?? 0)
  const cash = Number(balance?.cash ?? 0)
  const pendingBalance = production - cash

  const isLoading = loadingAppointments || loadingBalance

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resumen"
        description={`Hoy · ${formatInTimeZone(new Date(), APP_TIMEZONE, 'dd/MM/yyyy')}`}
        actions={
          <Button variant="accent" asChild>
            <Link to="/turnos/nuevo">Nuevo turno</Link>
          </Button>
        }
      />

      <section>
        <SectionHeader
          title="Hoy"
          action={
            <Button variant="link" size="sm" className="h-auto max-w-[55%] shrink-0 px-0 text-right text-xs sm:max-w-none sm:text-sm" asChild>
              <Link to={monthBalanceHref()}>
                <span className="sm:hidden">Ver balance</span>
                <span className="hidden sm:inline">Facturación del mes en Balance</span>
              </Link>
            </Button>
          }
        />
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <MetricCard label="Turnos" value={String(todayAppointments.length)} icon={CalendarCheck} />
            <MetricCard label="Estimado" value={formatServicePrice(estimated)} icon={CircleDollarSign} />
            <MetricCard label="Cobrado" value={formatServicePrice(cash)} icon={Wallet} />
            <MetricCard label="Saldo pendiente" value={formatServicePrice(pendingBalance)} icon={Receipt} />
          </div>
        )}
        {!isLoading && absences > 0 && (
          <div className="mt-4 max-w-xs">
            <MetricCard label="Ausencias" value={String(absences)} icon={UserX} hint="Registradas hoy" />
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Próximos turnos"
          action={
            upcoming.length > 0 ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/turnos">Ver todos</Link>
              </Button>
            ) : undefined
          }
        />
        {loadingAppointments ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
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
          <div className="space-y-2">
            {upcoming.slice(0, isMobile ? 5 : 6).map((appt) => (
              <AppointmentCard key={appt.id} appointment={appt} variant="compact" />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
