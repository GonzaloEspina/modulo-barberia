import { Navigate, Outlet } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsPlatformAdmin } from '@/features/platform/api'

export function PlatformRoute() {
  const { data: isPlatformAdmin, isLoading } = useIsPlatformAdmin()

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </div>
    )
  }

  if (!isPlatformAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin permiso</CardTitle>
          <CardDescription>Esta sección es solo para super administradores de la plataforma.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <Outlet />
}

export function PlatformIndexRedirect() {
  const { data: isPlatformAdmin, isLoading } = useIsPlatformAdmin()
  if (isLoading) return null
  if (!isPlatformAdmin) return <Navigate to="/" replace />
  return <Navigate to="/plataforma/organizaciones" replace />
}
