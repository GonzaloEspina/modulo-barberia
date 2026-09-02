import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceForm } from '@/features/services/service-form'
import { serviceFormValuesToInput } from '@/features/services/service-form-mapper'
import { useServiceMutations } from '@/features/services/api'
import { useProfile } from '@/hooks/use-profile'
import { notifyError } from '@/lib/notify'

export function ServiceCreatePage() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { createService } = useServiceMutations(profile?.organization_id)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo servicio</h1>
        <p className="text-muted-foreground text-sm">Definí el catálogo general de la barbería.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Datos del servicio</CardTitle>
          <CardDescription>
            Los barberos pueden heredar estos valores o configurar overrides individuales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceForm
            isSubmitting={createService.isPending}
            onCancel={() => navigate('/servicios')}
            onSubmit={async (values) => {
              try {
                await createService.mutateAsync(serviceFormValuesToInput(values))
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
