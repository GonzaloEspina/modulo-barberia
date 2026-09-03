import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Card } from '@/components/ui/card'
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
    <div className="space-y-4">
      <PageHeader
        title="Nuevo barbero"
        description="Configurá horarios, servicios y color en el calendario."
      />
      <Card className="gap-0 rounded-xl py-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-medium">Datos del barbero</p>
          <p className="text-muted-foreground text-xs">
            Podés vincular un usuario con rol Barbero después de crearlo.
          </p>
        </div>
        <div className="p-3">
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
        </div>
      </Card>
    </div>
  )
}
