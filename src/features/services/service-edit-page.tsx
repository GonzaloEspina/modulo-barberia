import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  if (isLoading) {
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{service.name}</h1>
        <p className="text-muted-foreground text-sm">Editar servicio</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}
