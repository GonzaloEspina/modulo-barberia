import { Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/hooks/use-profile'

export function ProfileGate() {
  const { user, signOut } = useAuth()
  const { data: profile, isLoading, isError, error } = useProfile()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando perfil…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Error al cargar perfil</CardTitle>
            <CardDescription>
              {(error as Error).message ?? 'No se pudo obtener el perfil del usuario.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Sin acceso</CardTitle>
            <CardDescription>
              Tu usuario no tiene un perfil asignado en esta barbería.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {user?.email && (
              <p>
                <span className="text-muted-foreground">Sesión actual:</span>{' '}
                <code>{user.email}</code>
              </p>
            )}
            <p className="text-muted-foreground">
              Esto suele pasar si creaste un usuario en Supabase Studio sin perfil, o si tenés
              una sesión anterior guardada en el navegador.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="accent" onClick={() => void signOut()}>
                Cerrar sesión e ingresar con otro usuario
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile.is_active) {
    return <Navigate to="/login" replace />
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
