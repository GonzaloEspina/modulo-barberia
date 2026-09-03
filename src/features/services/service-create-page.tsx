import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Card } from '@/components/ui/card'
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
    <div className="space-y-4">
      <PageHeader
        title="Nuevo servicio"
        description="Definí el catálogo general de la barbería."
      />
      <Card className="gap-0 rounded-xl py-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-medium">Datos del servicio</p>
          <p className="text-muted-foreground text-xs">
            Los barberos pueden heredar estos valores o configurar ajustes individuales.
          </p>
        </div>
        <div className="p-3">
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
        </div>
      </Card>
    </div>
  )
}
