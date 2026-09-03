import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Card } from '@/components/ui/card'
import { useOrgUserMutations } from '@/features/users/api'
import { UserCreateForm, type UserCreateFormValues } from '@/features/users/user-form'
import { notifyError, notifySuccess } from '@/lib/notify'

export function UserCreatePage() {
  const navigate = useNavigate()
  const { createUser } = useOrgUserMutations()

  const handleSubmit = async (values: UserCreateFormValues) => {
    try {
      await createUser.mutateAsync({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        role: values.role,
        barber_id: values.barber_id || null,
      })
      notifySuccess('Usuario creado')
      navigate('/usuarios')
    } catch (err) {
      notifyError((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nuevo usuario"
        description="Creá una cuenta de administrador o barbero para esta barbería."
      />
      <Card className="gap-0 rounded-xl py-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-medium">Datos de acceso</p>
        </div>
        <div className="p-3">
          <UserCreateForm
            isSubmitting={createUser.isPending}
            onCancel={() => navigate('/usuarios')}
            onSubmit={handleSubmit}
          />
        </div>
      </Card>
    </div>
  )
}
