import { Pencil, Plus, Scissors, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBarbers, useBarberMutations } from '@/features/barbers/api'
import { useProfile } from '@/hooks/use-profile'
import { confirmAction } from '@/lib/notify'
import { cn } from '@/lib/utils'

export function BarbersPage() {
  const [showInactive, setShowInactive] = useState(false)
  const { data: profile } = useProfile()
  const { data: barbers, isLoading, isError, error } = useBarbers(showInactive)
  const { softDeleteBarber } = useBarberMutations(profile?.organization_id)

  const activeCount = useMemo(
    () => barbers?.filter((b) => b.is_active && !b.deleted_at).length ?? 0,
    [barbers],
  )

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirmAction(`¿Eliminar a ${name}? Se realizará una baja lógica.`))) return
    await softDeleteBarber.mutateAsync(id)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barberos"
        description={isLoading ? 'Cargando…' : `${activeCount} activo${activeCount === 1 ? '' : 's'}`}
        actions={
          <Button variant="accent" asChild>
            <Link to="/barberos/nuevo">
              <Plus className="size-4" aria-hidden="true" />
              Nuevo barbero
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
        Mostrar inactivos y eliminados
      </label>

      {isError && (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      )}

      {!isError && !isLoading && barbers?.length === 0 && (
        <EmptyState
          icon={Scissors}
          title="Aún no hay barberos registrados"
          description="Agregá tu primer barbero para empezar a gestionar turnos."
          action={
            <Button variant="accent" asChild>
              <Link to="/barberos/nuevo">Nuevo barbero</Link>
            </Button>
          }
        />
      )}

      <div className="grid gap-3">
        {barbers?.map((barber) => (
          <Card key={barber.id} className={cn(barber.deleted_at ? 'opacity-60' : undefined, 'hover-surface')}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-1 size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: barber.calendar_color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{barber.name}</p>
                    {!barber.is_active && <Badge variant="secondary">Inactivo</Badge>}
                    {barber.deleted_at && <Badge variant="destructive">Eliminado</Badge>}
                    {barber.user_id && <Badge variant="outline">Usuario vinculado</Badge>}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Orden {barber.display_order}
                    {barber.email ? ` · ${barber.email}` : ''}
                    {barber.phone ? ` · ${barber.phone}` : ''}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {[
                      barber.use_general_schedules && 'Horarios generales',
                      barber.use_general_services && 'Servicios generales',
                      barber.use_general_prices && 'Precios generales',
                      barber.use_general_durations && 'Duraciones generales',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sin herencia general'}
                  </p>
                </div>
              </div>
              {!barber.deleted_at && (
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/barberos/${barber.id}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Editar
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDelete(barber.id, barber.name)}
                    disabled={softDeleteBarber.isPending}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Eliminar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
