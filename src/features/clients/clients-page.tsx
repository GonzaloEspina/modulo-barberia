import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClientCard } from '@/components/design-system/people-cards'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CLIENT_PAGE_SIZES,
  type ClientPageSize,
  type ClientSort,
  useClientsPage,
} from '@/features/clients/api'
import { getClientFullName } from '@/types/client'

function ClientWarningIcon({ reason }: { reason: string | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={reason ?? 'Advertencia del cliente'}
          className="text-warning inline-flex shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        {reason?.trim() || 'Advertencia manual del cliente'}
      </TooltipContent>
    </Tooltip>
  )
}

const SORT_OPTIONS: { value: ClientSort; label: string }[] = [
  { value: 'name', label: 'Nombre' },
  { value: 'next_appointment', label: 'Próximo turno' },
  { value: 'last_activity', label: 'Última actividad' },
]

export function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<ClientPageSize>(25)
  const [sort, setSort] = useState<ClientSort>('name')
  const [warningOnly, setWarningOnly] = useState(false)
  const [hasUpcomingAppointment, setHasUpcomingAppointment] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, sort, warningOnly, hasUpcomingAppointment])

  const { data, isLoading, isError, error } = useClientsPage({
    search,
    page,
    pageSize,
    sort,
    warningOnly,
    hasUpcomingAppointment,
  })

  const clients = data?.clients ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = warningOnly || hasUpcomingAppointment || search.trim().length > 0

  const rangeLabel = useMemo(() => {
    if (isLoading) return 'Cargando…'
    if (total === 0) return '0 clientes'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${total} cliente${total === 1 ? '' : 's'} · Mostrando ${from}–${to} de ${total}`
  }, [isLoading, page, pageSize, total])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={isLoading ? 'Cargando…' : `${total} cliente${total === 1 ? '' : 's'}`}
        actions={
          <Button variant="accent" asChild>
            <Link to="/clientes/nuevo">
              <Plus className="size-4" />
              Agregar cliente
            </Link>
          </Button>
        }
      />

      <div className="bg-background/95 sticky top-14 z-10 -mx-4 space-y-3 border-y px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="rounded-lg pl-9"
            placeholder="Buscar por nombre, apodo o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar clientes"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 max-sm:[&_label]:text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="clients-page-size" className="text-muted-foreground text-xs">
              Por página
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value) as ClientPageSize)}
            >
              <SelectTrigger id="clients-page-size" className="w-[88px]" aria-label="Clientes por página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clients-sort" className="text-muted-foreground text-xs">
              Ordenar por
            </Label>
            <Select value={sort} onValueChange={(value) => setSort(value as ClientSort)}>
              <SelectTrigger id="clients-sort" className="w-full min-w-[9rem] max-w-[11rem] sm:w-[180px]" aria-label="Ordenar clientes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-4 pb-0.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={warningOnly}
                onCheckedChange={(checked) => setWarningOnly(checked === true)}
                aria-label="Solo clientes con advertencia"
              />
              Solo advertencias
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={hasUpcomingAppointment}
                onCheckedChange={(checked) => setHasUpcomingAppointment(checked === true)}
                aria-label="Solo clientes con turno próximo"
              />
              Con turno próximo
            </label>
          </div>
        </div>
      </div>

      {isError && (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}

      {!isError && !isLoading && total === 0 && (
        <EmptyState
          icon={Users}
          title={hasFilters ? 'No hay clientes que coincidan' : 'Aún no hay clientes registrados'}
          description={
            hasFilters
              ? 'Probá cambiar la búsqueda o los filtros activos.'
              : 'Agregá tu primer cliente para empezar a gestionar turnos.'
          }
          action={
            hasFilters ? undefined : (
              <Button variant="accent" asChild>
                <Link to="/clientes/nuevo">Agregar cliente</Link>
              </Button>
            )
          }
        />
      )}

      {!isError && !isLoading && clients.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Apodo</th>
                  <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                  <th className="px-4 py-3 text-left font-medium">Correo</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="group/interactive-row cursor-pointer border-t"
                    onClick={() => navigate(`/clientes/${client.id}`)}
                  >
                    <td className="interactive-row__cell px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {client.manual_warning && (
                          <ClientWarningIcon reason={client.manual_warning_reason} />
                        )}
                        {getClientFullName(client)}
                      </span>
                    </td>
                    <td className="interactive-row__cell interactive-row__cell--muted px-4 py-3">
                      {client.nickname ?? '—'}
                    </td>
                    <td className="interactive-row__cell interactive-row__cell--muted px-4 py-3">
                      {client.phone_display ?? client.phone_normalized}
                    </td>
                    <td className="interactive-row__cell interactive-row__cell--muted px-4 py-3">
                      {client.email ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onOpen={() => navigate(`/clientes/${client.id}`)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">{rangeLabel}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Siguiente
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
