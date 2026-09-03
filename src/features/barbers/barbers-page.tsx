import { Pencil, Plus, Scissors, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBarbers, useBarberMutations } from '@/features/barbers/api'
import { useProfile } from '@/hooks/use-profile'
import { confirmAction } from '@/lib/notify'
import { cn } from '@/lib/utils'
import type { BarberRecord } from '@/types/barber'

const BARBER_ROW_COLS =
  'sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_3.25rem_minmax(0,1.8fr)_4.75rem]'

function inheritanceLabel(barber: BarberRecord) {
  return (
    [
      barber.use_general_schedules && 'Horarios',
      barber.use_general_services && 'Servicios',
      barber.use_general_prices && 'Precios',
      barber.use_general_durations && 'Duraciones',
    ]
      .filter(Boolean)
      .join(' · ') || 'Configuración propia'
  )
}

function contactLabel(barber: BarberRecord) {
  return [barber.email, barber.phone].filter(Boolean).join(' · ')
}

function BarberRow({
  barber,
  deleting,
  onDelete,
}: {
  barber: BarberRecord
  deleting: boolean
  onDelete: (id: string, name: string) => void
}) {
  const contact = contactLabel(barber)
  const inheritance = inheritanceLabel(barber)

  return (
    <div
      className={cn(
        'hover-surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:gap-4',
        barber.deleted_at && 'opacity-60',
        BARBER_ROW_COLS,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: barber.calendar_color }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium">{barber.name}</p>
            {!barber.is_active && <Badge variant="secondary">Inactivo</Badge>}
            {barber.deleted_at && <Badge variant="destructive">Eliminado</Badge>}
            {barber.user_id && <Badge variant="outline">Usuario vinculado</Badge>}
          </div>
          <p className="text-muted-foreground truncate text-xs sm:hidden">
            Orden {barber.display_order}
            {contact ? ` · ${contact}` : ''}
            {' · '}
            {inheritance}
          </p>
        </div>
      </div>

      <p className="text-muted-foreground hidden truncate text-sm sm:block">{contact || '—'}</p>
      <p className="text-muted-foreground hidden text-sm tabular-nums sm:block">{barber.display_order}</p>
      <p className="text-muted-foreground hidden min-w-0 truncate text-sm sm:block">{inheritance}</p>

      <div className="flex justify-end gap-1">
        {!barber.deleted_at && (
          <>
            <Button variant="ghost" size="icon-sm" asChild>
              <Link to={`/barberos/${barber.id}`} aria-label={`Editar ${barber.name}`}>
                <Pencil className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label={`Eliminar ${barber.name}`}
              onClick={() => onDelete(barber.id, barber.name)}
              disabled={deleting}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

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

      {isError && (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      )}

      <Card className="gap-0 overflow-hidden rounded-xl py-0">
        <div className="flex items-center border-b p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos y eliminados
          </label>
        </div>

        <div
          className={cn(
            'text-muted-foreground hidden gap-4 border-b px-3 py-2 text-xs font-medium sm:grid',
            BARBER_ROW_COLS,
          )}
        >
          <span>Barbero</span>
          <span>Contacto</span>
          <span>Orden</span>
          <span>Usa config. del local</span>
          <span className="text-right">Acciones</span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        ) : !isError && barbers?.length === 0 ? (
          <div className="p-4">
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
          </div>
        ) : (
          <div className="divide-y">
            {barbers?.map((barber) => (
              <BarberRow
                key={barber.id}
                barber={barber}
                deleting={softDeleteBarber.isPending}
                onDelete={(id, name) => void handleDelete(id, name)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
