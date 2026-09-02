import { Pencil, Plus, UserRound, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { RoleBadge } from '@/components/role-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useOrgUserMutations, useOrgUsers } from '@/features/users/api'
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify'
import { cn } from '@/lib/utils'

export function UsersPage() {
  const [showInactive, setShowInactive] = useState(false)
  const { user } = useAuth()
  const { data: users, isLoading, isError, error } = useOrgUsers(showInactive)
  const { updateUser } = useOrgUserMutations()

  const activeCount = useMemo(() => users?.filter((u) => u.is_active).length ?? 0, [users])

  const handleDeactivate = async (id: string, name: string) => {
    if (id === user?.id) {
      notifyError('No podés desactivar tu propio usuario')
      return
    }
    if (!(await confirmAction(`¿Desactivar a ${name}? No podrá iniciar sesión.`))) return
    try {
      await updateUser.mutateAsync({ user_id: id, is_active: false })
      notifySuccess('Usuario desactivado')
    } catch (err) {
      notifyError((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description={isLoading ? 'Cargando…' : `${activeCount} activo${activeCount === 1 ? '' : 's'}`}
        actions={
          <Button variant="accent" asChild>
            <Link to="/usuarios/nuevo">
              <Plus className="size-4" aria-hidden="true" />
              Nuevo usuario
            </Link>
          </Button>
        }
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Mostrar inactivos
      </label>

      {isError && <p className="text-destructive text-sm">{(error as Error).message}</p>}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}

      {!isError && !isLoading && users?.length === 0 && (
        <EmptyState
          icon={UserRound}
          title="Aún no hay usuarios"
          description="Creá administradores o barberos para que puedan iniciar sesión."
          action={
            <Button variant="accent" asChild>
              <Link to="/usuarios/nuevo">Nuevo usuario</Link>
            </Button>
          }
        />
      )}

      <div className="grid gap-3">
        {users?.map((orgUser) => (
          <Card key={orgUser.id} className={cn(!orgUser.is_active && 'opacity-60', 'hover-surface')}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{orgUser.full_name || 'Sin nombre'}</p>
                  <RoleBadge role={orgUser.role} />
                  {!orgUser.is_active && <Badge variant="secondary">Inactivo</Badge>}
                  {orgUser.id === user?.id && <Badge variant="outline">Vos</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">{orgUser.email}</p>
                {orgUser.role === 'barber' && (
                  <p className="text-muted-foreground text-xs">
                    Ficha: {orgUser.barber_name ?? 'Sin vincular'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/usuarios/${orgUser.id}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Editar
                  </Link>
                </Button>
                {orgUser.is_active && orgUser.id !== user?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDeactivate(orgUser.id, orgUser.full_name || orgUser.email)}
                    disabled={updateUser.isPending}
                  >
                    <UserX className="size-4" aria-hidden="true" />
                    Desactivar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
