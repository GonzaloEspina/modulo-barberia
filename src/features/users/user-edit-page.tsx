import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    return <Skeleton className="mx-auto h-64 max-w-2xl rounded-xl" />
  }

  if (isError || !orgUser) {
    return (
      <Card className="mx-auto max-w-2xl">
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{orgUser.full_name || 'Usuario'}</h1>
        <p className="text-muted-foreground text-sm">Editar usuario · {orgUser.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <UserEditForm
            user={orgUser}
            isSubmitting={updateUser.isPending}
            onCancel={() => navigate('/usuarios')}
            onSubmit={handleSave}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handlePassword} noValidate>
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <Button type="submit" variant="accent" disabled={setPassword.isPending}>
              {setPassword.isPending ? 'Actualizando…' : 'Actualizar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
