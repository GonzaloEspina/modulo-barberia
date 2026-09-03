import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Card } from '@/components/ui/card'
import { ClientForm } from '@/features/clients/client-form'
import { clientFormValuesToInput } from '@/features/clients/client-form-mapper'
import { useClientMutations } from '@/features/clients/api'
import { useProfile } from '@/hooks/use-profile'
import { notifyError } from '@/lib/notify'

export function ClientCreatePage() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { createClient } = useClientMutations(profile?.organization_id)

  return (
    <div className="space-y-4">
      <PageHeader title="Nuevo cliente" description="Completá los datos del cliente." />
      <Card className="gap-0 rounded-xl py-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-medium">Datos del cliente</p>
          <p className="text-muted-foreground text-xs">
            El teléfono se normaliza automáticamente para evitar duplicados.
          </p>
        </div>
        <div className="p-3">
          <ClientForm
            isSubmitting={createClient.isPending}
            onCancel={() => navigate('/clientes')}
            onSubmit={async (values) => {
              try {
                await createClient.mutateAsync(clientFormValuesToInput(values))
                navigate('/clientes')
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
