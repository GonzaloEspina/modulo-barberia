import { Pencil, Plus, Scissors, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useServices, useServiceMutations } from '@/features/services/api'
import { useProfile } from '@/hooks/use-profile'
import { confirmAction } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { formatServiceDuration, formatServicePrice, type Service } from '@/types/service'

const SERVICE_ROW_COLS =
  'sm:grid-cols-[minmax(0,1.8fr)_6rem_4.75rem_4rem_auto]'

function ServiceRow({
  service,
  deleting,
  onDelete,
}: {
  service: Service
  deleting: boolean
  onDelete: (id: string, name: string) => void
}) {
  const price = formatServicePrice(service.price)
  const duration = formatServiceDuration(service.duration_minutes)

  return (
    <div
      className={cn(
        'hover-surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:gap-4',
        SERVICE_ROW_COLS,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: service.category_color ?? '#D97706' }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium">{service.name}</p>
            {!service.is_active && <Badge variant="secondary">Inactivo</Badge>}
            {!service.visible_on_portal && <Badge variant="outline">Oculto en portal</Badge>}
          </div>
          {service.description && (
            <p className="text-muted-foreground truncate text-xs">{service.description}</p>
          )}
          <p className="text-muted-foreground text-xs sm:hidden">
            {price} · {duration} · {service.points_awarded} pts
          </p>
        </div>
      </div>

      <p className="hidden text-sm tabular-nums sm:block">{price}</p>
      <p className="text-muted-foreground hidden text-sm sm:block">{duration}</p>
      <p className="text-muted-foreground hidden text-sm sm:block">{service.points_awarded} pts</p>

      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to={`/servicios/${service.id}`} aria-label={`Editar ${service.name}`}>
            <Pencil className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          aria-label={`Eliminar ${service.name}`}
          onClick={() => onDelete(service.id, service.name)}
          disabled={deleting}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function ServicesPage() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const { data: profile } = useProfile()
  const { data: services, isLoading, isError, error } = useServices(search, showInactive)
  const { softDeleteService } = useServiceMutations(profile?.organization_id)

  const countLabel = useMemo(() => {
    if (isLoading) return 'Cargando…'
    return `${services?.length ?? 0} servicio${services?.length === 1 ? '' : 's'}`
  }, [services?.length, isLoading])

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirmAction(`¿Eliminar ${name}? Se realizará una baja lógica.`))) return
    await softDeleteService.mutateAsync(id)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Servicios"
        description={countLabel}
        actions={
          <Button variant="accent" asChild>
            <Link to="/servicios/nuevo">
              <Plus className="size-4" aria-hidden="true" />
              Nuevo servicio
            </Link>
          </Button>
        }
      />

      {isError && (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      )}

      <Card className="gap-0 overflow-hidden rounded-xl py-0">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="rounded-lg pl-9"
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar servicios"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
        </div>

        <div
          className={cn(
            'text-muted-foreground hidden gap-4 border-b px-3 py-2 text-xs font-medium sm:grid',
            SERVICE_ROW_COLS,
          )}
        >
          <span>Servicio</span>
          <span>Precio</span>
          <span>Duración</span>
          <span>Puntos</span>
          <span className="text-right">Acciones</span>
        </div>

        {!isError && !isLoading && services?.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Scissors}
              title="No se encontraron servicios"
              description="Creá tu primer servicio para empezar a ofrecer turnos."
              action={
                <Button variant="accent" asChild>
                  <Link to="/servicios/nuevo">Nuevo servicio</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y">
            {services?.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                deleting={softDeleteService.isPending}
                onDelete={(id, name) => void handleDelete(id, name)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
