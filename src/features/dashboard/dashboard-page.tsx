import { formatInTimeZone } from 'date-fns-tz'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck,
  CircleDollarSign,
  Clock,
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
import { formatServicePrice } from '@/types/service'

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
}

export function DashboardPage() {
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
        <SectionHeader title="Hoy" />
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Turnos de hoy" value={String(todayAppointments.length)} icon={CalendarCheck} />
            <MetricCard label="Estimado" value={formatServicePrice(estimated)} icon={CircleDollarSign} />
            <MetricCard
              label="Cobrado"
              value={formatServicePrice(Number(balance?.cash ?? 0))}
              icon={Wallet}
            />
            <MetricCard
              label="Facturación del mes"
              value={formatServicePrice(Number(balance?.production ?? 0))}
              icon={Clock}
            />
            {absences > 0 && (
              <MetricCard label="Ausencias" value={String(absences)} icon={UserX} hint="Registradas hoy" />
            )}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Próximos turnos"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/turnos">Ver calendario</Link>
            </Button>
          }
        />
        {loadingAppointments ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
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
          <div className="space-y-3">
            {upcoming.slice(0, 6).map((appt) => (
              <AppointmentCard key={appt.id} appointment={appt} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
