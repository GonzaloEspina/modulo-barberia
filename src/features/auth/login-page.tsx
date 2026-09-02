import { zodResolver } from '@hookform/resolvers/zod'
import { Scissors } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl shadow-sm">
          <Scissors className="size-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xl font-semibold tracking-tight">Barbería</p>
          <p className="text-muted-foreground text-sm">Gestión de turnos</p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Iniciar sesión</CardTitle>
          <CardDescription>
            Accedé con tu cuenta de administrador o barbero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConfigured && (
            <p className="text-muted-foreground mb-4 rounded-xl border border-dashed bg-card p-4 text-sm">
              Supabase no está configurado. Creá <code className="bg-muted rounded px-1 py-0.5 text-xs">.env.local</code> y ejecutá{' '}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">npx supabase start</code> (requiere Docker).
            </p>
          )}
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="rounded-lg"
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
                className="rounded-lg"
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

            <Button type="submit" variant="accent" className="w-full rounded-lg" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
