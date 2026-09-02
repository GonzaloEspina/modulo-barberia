import { Pencil, Plus, Scissors, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useServices, useServiceMutations } from '@/features/services/api'
import { useProfile } from '@/hooks/use-profile'
import { confirmAction } from '@/lib/notify'
import { formatServiceDuration, formatServicePrice } from '@/types/service'

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

      <div className="relative max-w-md">
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

      {isError && (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      )}

      {!isError && !isLoading && services?.length === 0 && (
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
      )}

      <div className="grid gap-3">
        {services?.map((service) => (
          <Card key={service.id} className="hover-surface">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-1 size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: service.category_color ?? '#D97706' }}
                  aria-hidden="true"
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{service.name}</p>
                    {!service.is_active && <Badge variant="secondary">Inactivo</Badge>}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {formatServicePrice(service.price)}
                    {' · '}
                    {formatServiceDuration(service.duration_minutes)}
                    {' · '}
                    {service.points_awarded} pts
                  </p>
                  {service.description && (
                    <p className="text-muted-foreground text-xs">{service.description}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/servicios/${service.id}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Editar
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDelete(service.id, service.name)}
                  disabled={softDeleteService.isPending}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
