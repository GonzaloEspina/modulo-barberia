import { Outlet } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isAdminRole, useProfile } from '@/hooks/use-profile'

export function AdminRoute() {
  const { data: profile, isLoading } = useProfile()

  if (isLoading && !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </div>
    )
  }

  if (!profile || !isAdminRole(profile)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin permiso</CardTitle>
          <CardDescription>Esta sección solo está disponible para administradores.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <Outlet />
}
