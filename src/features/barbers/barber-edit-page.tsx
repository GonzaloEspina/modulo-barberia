import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { BarberForm, type BarberFormValues } from '@/features/barbers/barber-form'
import { BarberServicesPanel } from '@/features/barbers/barber-services-panel'
import { BarberSchedulesPanel } from '@/features/barbers/barber-schedules-panel'
import { useBarber, useBarberMutations } from '@/features/barbers/api'
import { useProfile } from '@/hooks/use-profile'
import { notifyError } from '@/lib/notify'

function toInput(values: BarberFormValues) {
  return {
    ...values,
    linked_profile_id: values.linked_profile_id || null,
  }
}

export function BarberEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: barber, isLoading, isError } = useBarber(id)
  const { updateBarber } = useBarberMutations(profile?.organization_id)

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Cargando barbero…</p>
  }

  if (isError || !barber || barber.deleted_at) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Barbero no encontrado</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title={barber.name} description="Editar barbero" />

      <Card className="gap-0 rounded-xl py-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-medium">Configuración</p>
        </div>
        <div className="p-3">
          <BarberForm
            barber={barber}
            isSubmitting={updateBarber.isPending}
            onCancel={() => navigate('/barberos')}
            onSubmit={async (values) => {
              try {
                await updateBarber.mutateAsync({ id: barber.id, input: toInput(values) })
                navigate('/barberos')
              } catch (err) {
                notifyError((err as Error).message)
              }
            }}
          />
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {profile?.organization_id && (
          <BarberServicesPanel barber={barber} organizationId={profile.organization_id} />
        )}
        <BarberSchedulesPanel barber={barber} />
      </div>
    </div>
  )
}
