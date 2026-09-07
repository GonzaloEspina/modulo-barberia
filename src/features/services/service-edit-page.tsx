import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceForm } from '@/features/services/service-form'
import { serviceFormValuesToInput } from '@/features/services/service-form-mapper'
import { useService, useServiceMutations } from '@/features/services/api'
import { useProfile } from '@/hooks/use-profile'
import { notifyError } from '@/lib/notify'

export function ServiceEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: service, isLoading, isError } = useService(id)
  const { updateService } = useServiceMutations(profile?.organization_id)

  if (isLoading && !service) {
    return <p className="text-muted-foreground text-sm">Cargando servicio…</p>
  }

  if (isError || !service || service.deleted_at) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Servicio no encontrado</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title={service.name} description="Editar servicio" />
      <Card className="gap-0 rounded-xl py-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-medium">Configuración</p>
        </div>
        <div className="p-3">
          <ServiceForm
            service={service}
            isSubmitting={updateService.isPending}
            onCancel={() => navigate('/servicios')}
            onSubmit={async (values) => {
              try {
                await updateService.mutateAsync({ id: service.id, input: serviceFormValuesToInput(values) })
                navigate('/servicios')
              } catch (err) {
                notifyError((err as Error).message)
              }
            }}
          />
        </div>
      </Card>
    </div>
  )
}
