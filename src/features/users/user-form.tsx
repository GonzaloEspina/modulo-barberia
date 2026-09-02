import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, type UseFormRegister } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBarbers } from '@/features/barbers/api'
import type { OrgUser } from '@/features/users/api'
import type { UserRole } from '@/types/database'

const baseSchema = z.object({
  full_name: z.string().min(1, 'El nombre es obligatorio'),
  role: z.enum(['admin', 'barber']),
  barber_id: z.string().optional(),
  is_active: z.boolean(),
})

const createSchema = baseSchema
  .extend({
    email: z.email('Ingresá un correo válido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
  })
  .superRefine((values, ctx) => {
    if (values.role === 'barber' && !values.barber_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['barber_id'],
        message: 'Elegí la ficha de barbero a vincular',
      })
    }
  })

const editSchema = baseSchema.superRefine((values, ctx) => {
  if (values.role === 'barber' && !values.barber_id) {
    ctx.addIssue({
      code: 'custom',
      path: ['barber_id'],
      message: 'Elegí la ficha de barbero a vincular',
    })
  }
})

export type UserCreateFormValues = z.infer<typeof createSchema>
export type UserEditFormValues = z.infer<typeof editSchema>

type RoleFields = {
  role: UserRole
  barber_id?: string
}

interface UserCreateFormProps {
  isSubmitting?: boolean
  onSubmit: (values: UserCreateFormValues) => Promise<void>
  onCancel: () => void
}

interface UserEditFormProps {
  user: OrgUser
  isSubmitting?: boolean
  onSubmit: (values: UserEditFormValues) => Promise<void>
  onCancel: () => void
}

function RoleAndBarberFields({
  role,
  register,
  onRoleChange,
  error,
}: {
  role: UserRole
  register: UseFormRegister<RoleFields>
  onRoleChange: (role: UserRole) => void
  error?: string
}) {
  const { data: barbers } = useBarbers(false)

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="role">Rol</Label>
        <select
          id="role"
          className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
          {...register('role')}
          onChange={(e) => onRoleChange(e.target.value as UserRole)}
        >
          <option value="admin">Administrador</option>
          <option value="barber">Barbero</option>
        </select>
      </div>

      {role === 'barber' && (
        <div className="space-y-2">
          <Label htmlFor="barber_id">Ficha de barbero</Label>
          <select
            id="barber_id"
            className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
            {...register('barber_id')}
          >
            <option value="">Seleccioná un barbero…</option>
            {barbers?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.user_id ? ' (ya tiene usuario)' : ''}
              </option>
            ))}
          </select>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            El usuario podrá iniciar sesión y ver los turnos de esa ficha.
          </p>
        </div>
      )}
    </>
  )
}

export function UserCreateForm({ isSubmitting, onSubmit, onCancel }: UserCreateFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserCreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      role: 'admin',
      barber_id: '',
      is_active: true,
    },
  })

  const role = watch('role')

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre</Label>
        <Input id="full_name" {...register('full_name')} aria-invalid={!!errors.full_name} />
        {errors.full_name && (
          <p className="text-destructive text-sm" role="alert">
            {errors.full_name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" type="email" autoComplete="off" {...register('email')} aria-invalid={!!errors.email} />
        {errors.email && (
          <p className="text-destructive text-sm" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña temporal</Label>
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

      <RoleAndBarberFields
        role={role}
        register={register as unknown as UseFormRegister<RoleFields>}
        onRoleChange={(next) => {
          setValue('role', next)
          if (next === 'admin') setValue('barber_id', '')
        }}
        error={errors.barber_id?.message}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  )
}

export function UserEditForm({ user, isSubmitting, onSubmit, onCancel }: UserEditFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UserEditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: user.full_name ?? '',
      role: user.role,
      barber_id: user.barber_id ?? '',
      is_active: user.is_active,
    },
  })

  useEffect(() => {
    reset({
      full_name: user.full_name ?? '',
      role: user.role,
      barber_id: user.barber_id ?? '',
      is_active: user.is_active,
    })
  }, [user, reset])

  const role = watch('role')

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label>Correo electrónico</Label>
        <Input value={user.email} disabled className="bg-muted" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre</Label>
        <Input id="full_name" {...register('full_name')} aria-invalid={!!errors.full_name} />
        {errors.full_name && (
          <p className="text-destructive text-sm" role="alert">
            {errors.full_name.message}
          </p>
        )}
      </div>

      <RoleAndBarberFields
        role={role}
        register={register as unknown as UseFormRegister<RoleFields>}
        onRoleChange={(next) => {
          setValue('role', next)
          if (next === 'admin') setValue('barber_id', '')
        }}
        error={errors.barber_id?.message}
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" {...register('is_active')} />
        Usuario activo
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
