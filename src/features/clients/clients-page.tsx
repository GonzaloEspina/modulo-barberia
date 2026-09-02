import { Plus, Search, Users } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClientCard } from '@/components/design-system/people-cards'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useClients } from '@/features/clients/api'
import { useProfile } from '@/hooks/use-profile'
import { getBookingOverrideBadge, getClientFullName, groupClientsByInitial } from '@/types/client'

export function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: profile } = useProfile()
  const { data: clients, isLoading, isError, error } = useClients(search)
  const portalMode = profile?.organization?.settings.portal_booking_mode ?? 'disabled'

  const groupedClients = useMemo(
    () => groupClientsByInitial(clients ?? []),
    [clients],
  )

  const countLabel = useMemo(() => {
    if (isLoading) return 'Cargando…'
    return `${clients?.length ?? 0} cliente${clients?.length === 1 ? '' : 's'}`
  }, [clients?.length, isLoading])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={countLabel}
        actions={
          <Button variant="accent" asChild>
            <Link to="/clientes/nuevo">
              <Plus className="size-4" />
              Agregar cliente
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="rounded-lg pl-9"
          placeholder="Buscar por nombre, apodo o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar clientes"
        />
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

      {!isError && !isLoading && clients?.length === 0 && (
        <EmptyState
          icon={Users}
          title="Aún no hay clientes registrados"
          description="Agregá tu primer cliente para empezar a gestionar turnos."
          action={
            <Button variant="accent" asChild>
              <Link to="/clientes/nuevo">Agregar cliente</Link>
            </Button>
          }
        />
      )}

      <div className="hidden overflow-hidden rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">Apodo</th>
              <th className="px-4 py-3 text-left font-medium">Teléfono</th>
              <th className="px-4 py-3 text-left font-medium">Correo</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {groupedClients.map(({ initial, clients: group }) => (
              <Fragment key={initial}>
                <tr className="border-t bg-muted/30">
                  <td colSpan={5} className="text-muted-foreground px-4 py-2 text-xs font-semibold tracking-wide uppercase">
                    {initial}
                  </td>
                </tr>
                {group.map((client) => {
                  const bookingBadge = getBookingOverrideBadge(client.booking_override, portalMode)
                  return (
                    <tr
                      key={client.id}
                      className="group/interactive-row cursor-pointer border-t"
                      onClick={() => navigate(`/clientes/${client.id}`)}
                    >
                      <td className="interactive-row__cell px-4 py-3 font-medium">
                        {getClientFullName(client)}
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
                      <td className="interactive-row__cell px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {client.manual_warning && <Badge variant="warning">Advertencia</Badge>}
                          {bookingBadge && <Badge variant="outline">{bookingBadge}</Badge>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 md:hidden">
        {groupedClients.map(({ initial, clients: group }) => (
          <section key={initial} className="space-y-2">
            <h2 className="text-muted-foreground px-1 text-xs font-semibold tracking-wide uppercase">
              {initial}
            </h2>
            <div className="space-y-3">
              {group.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onOpen={() => navigate(`/clientes/${client.id}`)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
