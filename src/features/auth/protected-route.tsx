import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'

export function ProtectedRoute() {
  const { session, isLoading, isConfigured } = useAuth()
  const location = useLocation()

  if (!isConfigured) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Configuración pendiente</CardTitle>
            <CardDescription>
              Copiá <code>.env.example</code> a <code>.env.local</code>, ejecutá{' '}
              <code>npx supabase start</code> y completá las variables de Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Requiere Docker Desktop para Supabase local.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading && !session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando sesión…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { session, isLoading, isConfigured } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  if (!isConfigured) {
    return <Outlet />
  }

  if (isLoading && !session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando sesión…</p>
      </div>
    )
  }

  if (session) {
    return <Navigate to={from} replace />
  }

  return <Outlet />
}
