import { formatInTimeZone } from 'date-fns-tz'
import { CalendarDays, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppointmentCard } from '@/components/design-system/appointment-components'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointments } from '@/features/appointments/api'
import { exportAppointmentsCsv, exportAppointmentsExcel } from '@/features/export/export-utils'
import { APP_TIMEZONE } from '@/lib/constants'

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
}

export function AppointmentsPage() {
  const today = todayIso()
  const { data: appointments, isLoading } = useAppointments(today)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Turnos desde hoy"
        actions={
          <>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => exportAppointmentsCsv(today, '2099-12-31', appointments)}>
              CSV
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => exportAppointmentsExcel(today, '2099-12-31', appointments)}>
              Excel
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/turnos">Agenda</Link>
            </Button>
            <Button variant="accent" asChild>
              <Link to="/turnos/nuevo">
                <Plus className="size-4" />
                Nuevo turno
              </Link>
            </Button>
          </>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      )}

      {!isLoading && appointments?.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No hay turnos programados"
          description="Todavía no hay turnos desde hoy en la agenda."
          action={
            <Button variant="accent" asChild>
              <Link to="/turnos/nuevo">Crear turno</Link>
            </Button>
          }
        />
      )}

      <div className="space-y-3">
        {appointments?.map((appt) => (
          <AppointmentCard key={appt.id} appointment={appt} />
        ))}
      </div>
    </div>
  )
}
