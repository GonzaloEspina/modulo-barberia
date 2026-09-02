import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarberForm, type BarberFormValues } from '@/features/barbers/barber-form'
import { useBarberMutations } from '@/features/barbers/api'
import { useProfile } from '@/hooks/use-profile'
import { notifyError } from '@/lib/notify'

function toInput(values: BarberFormValues) {
  return {
    ...values,
    linked_profile_id: values.linked_profile_id || null,
  }
}

export function BarberCreatePage() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { createBarber } = useBarberMutations(profile?.organization_id)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo barbero</h1>
        <p className="text-muted-foreground text-sm">Configurá horarios, servicios y color en el calendario.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Datos del barbero</CardTitle>
          <CardDescription>Podés vincular un usuario con rol Barbero después de crearlo.</CardDescription>
        </CardHeader>
        <CardContent>
          <BarberForm
            isSubmitting={createBarber.isPending}
            onCancel={() => navigate('/barberos')}
            onSubmit={async (values) => {
              try {
                await createBarber.mutateAsync(toInput(values))
                navigate('/barberos')
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
