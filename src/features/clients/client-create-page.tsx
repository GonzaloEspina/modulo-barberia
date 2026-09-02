import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo cliente</h1>
        <p className="text-muted-foreground text-sm">Completá los datos del cliente.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
          <CardDescription>El teléfono se normaliza automáticamente para evitar duplicados.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}
