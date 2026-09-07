import { zodResolver } from '@hookform/resolvers/zod'
import { Scissors } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'

const loginSchema = z.object({
  email: z.email('Ingresá un correo válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { signIn, isConfigured } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await signIn(values.email, values.password)
    if (error) {
      setFormError('Credenciales incorrectas. Verificá tu correo y contraseña.')
    }
  })

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="bg-sidebar text-sidebar-foreground px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="bg-sidebar-accent text-sidebar-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-sm">
            <Scissors className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-3xl font-semibold tracking-wide uppercase">Barbería</p>
            <p className="font-listing text-[11px] tracking-[0.16em] text-sidebar-foreground/70 uppercase">
              Gestión de turnos
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="listing-sheet w-full max-w-md rounded-sm p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-wide">Iniciar sesión</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Accedé con tu cuenta de administrador o barbero.
          </p>

          {!isConfigured && (
            <p className="text-muted-foreground mt-5 rounded-sm border border-dashed p-4 text-sm">
              Supabase no está configurado. Creá{' '}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">.env.local</code> y ejecutá{' '}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">npx supabase start</code>{' '}
              (requiere Docker).
            </p>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-destructive text-sm" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-sm" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {formError && (
              <p className="text-destructive text-sm" role="alert">
                {formError}
              </p>
            )}

            <Button type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
