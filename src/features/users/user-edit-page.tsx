import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrgUserMutations, useOrgUsers } from '@/features/users/api'
import { UserEditForm, type UserEditFormValues } from '@/features/users/user-form'
import { notifyError, notifySuccess } from '@/lib/notify'

const passwordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm: z.string().min(8, 'Mínimo 8 caracteres'),
}).refine((v) => v.password === v.confirm, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm'],
})

type PasswordForm = z.infer<typeof passwordSchema>

export function UserEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [includeInactive] = useState(true)
  const { data: users, isLoading, isError } = useOrgUsers(includeInactive)
  const { updateUser, setPassword } = useOrgUserMutations()

  const orgUser = useMemo(() => users?.find((u) => u.id === id), [users, id])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />
  }

  if (isError || !orgUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuario no encontrado</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  const handleSave = async (values: UserEditFormValues) => {
    try {
      await updateUser.mutateAsync({
        user_id: orgUser.id,
        full_name: values.full_name,
        role: values.role,
        barber_id: values.role === 'barber' ? values.barber_id || null : null,
        is_active: values.is_active,
      })
      notifySuccess('Usuario actualizado')
      navigate('/usuarios')
    } catch (err) {
      notifyError((err as Error).message)
    }
  }

  const handlePassword = handleSubmit(async (values) => {
    try {
      await setPassword.mutateAsync({ user_id: orgUser.id, password: values.password })
      notifySuccess('Contraseña actualizada')
      reset({ password: '', confirm: '' })
    } catch (err) {
      notifyError((err as Error).message)
    }
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title={orgUser.full_name || 'Usuario'}
        description={`Editar usuario · ${orgUser.email}`}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="min-w-0 gap-0 rounded-xl py-0">
          <div className="border-b px-3 py-2.5">
            <p className="text-sm font-medium">Perfil</p>
          </div>
          <div className="p-3">
            <UserEditForm
              user={orgUser}
              isSubmitting={updateUser.isPending}
              onCancel={() => navigate('/usuarios')}
              onSubmit={handleSave}
            />
          </div>
        </Card>

        <Card className="min-w-0 gap-0 rounded-xl py-0">
          <div className="border-b px-3 py-2.5">
            <p className="text-sm font-medium">Cambiar contraseña</p>
          </div>
          <div className="p-3">
            <form className="space-y-3" onSubmit={handlePassword} noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    {...register('password')}
                    aria-invalid={!!errors.password}
                  />
                  {errors.password && (
                    <p className="text-destructive text-sm" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    {...register('confirm')}
                    aria-invalid={!!errors.confirm}
                  />
                  {errors.confirm && (
                    <p className="text-destructive text-sm" role="alert">
                      {errors.confirm.message}
                    </p>
                  )}
                </div>
              </div>
              <Button type="submit" variant="accent" disabled={setPassword.isPending}>
                {setPassword.isPending ? 'Actualizando…' : 'Actualizar contraseña'}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}
