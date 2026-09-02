import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo usuario</h1>
        <p className="text-muted-foreground text-sm">
          Creá una cuenta de administrador o barbero para esta barbería.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Datos de acceso</CardTitle>
        </CardHeader>
        <CardContent>
          <UserCreateForm
            isSubmitting={createUser.isPending}
            onCancel={() => navigate('/usuarios')}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  )
}
