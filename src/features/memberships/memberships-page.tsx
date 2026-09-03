import { differenceInCalendarDays } from 'date-fns'
import { Eye, EyeOff, Pencil, Plus, Search, Ticket, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClientCombobox } from '@/components/design-system/client-combobox'
import { EmptyState, PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClients } from '@/features/clients/api'
import { useClientMemberships, useMembershipMutations, useMembershipPlans } from '@/features/memberships/api'
import { useProfile } from '@/hooks/use-profile'
import { formatAppDate } from '@/lib/app-datetime'
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { getClientFullName } from '@/types/client'
import { formatServicePrice } from '@/types/service'

type MembershipPlanRow = {
  id: string
  name: string
  price: number
  appointments_included: number
  validity_months: number
  is_active: boolean
}

type ClientMembershipRow = {
  id: string
  client_id: string
  plan_name: string
  appointments_remaining: number
  appointments_total: number
  status: string
  expires_at: string
  purchased_at: string
  client?: {
    id: string
    first_name: string
    last_name: string
    phone_display: string | null
    phone_normalized: string
  } | Array<{
    id: string
    first_name: string
    last_name: string
    phone_display: string | null
    phone_normalized: string
  }>
}

type StatusFilter = 'active' | 'history' | 'all'

const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  pending_payment: 'Pago pendiente',
  exhausted: 'Agotada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
}

const selectClass =
  'border-input bg-background flex h-11 w-full rounded-lg border px-3 text-sm'

function isLiveStatus(status: string) {
  return status === 'active' || status === 'pending_payment'
}

function membershipStatusVariant(status: string): 'default' | 'secondary' | 'warning' | 'outline' {
  if (status === 'active') return 'default'
  if (status === 'pending_payment') return 'warning'
  return 'secondary'
}

function resolveClient(membership: ClientMembershipRow) {
  if (!membership.client) return null
  return Array.isArray(membership.client) ? membership.client[0] : membership.client
}

function formatMembershipDate(value: string) {
  try {
    return formatAppDate(value)
  } catch {
    return value
  }
}

function MembershipRow({ membership }: { membership: ClientMembershipRow }) {
  const client = resolveClient(membership)
  const clientName = client ? getClientFullName(client) : 'Cliente desconocido'
  const phone = client?.phone_display ?? client?.phone_normalized
  const remainingPct = membership.appointments_total
    ? Math.round((membership.appointments_remaining / membership.appointments_total) * 100)
    : 0
  const daysLeft = differenceInCalendarDays(new Date(membership.expires_at), new Date())
  const expiringSoon = membership.status === 'active' && daysLeft >= 0 && daysLeft <= 14

  return (
    <div className="hover-surface grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7.5rem_6.5rem_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 sm:block">
          {client ? (
            <Link
              to={`/clientes/${client.id}`}
              className="truncate font-medium hover:underline"
            >
              {clientName}
            </Link>
          ) : (
            <p className="truncate font-medium">{clientName}</p>
          )}
          <Badge variant={membershipStatusVariant(membership.status)} className="sm:hidden">
            {MEMBERSHIP_STATUS_LABELS[membership.status] ?? membership.status}
          </Badge>
        </div>
        {phone && <p className="text-muted-foreground truncate text-xs">{phone}</p>}
      </div>

      <p className="min-w-0 truncate text-sm">{membership.plan_name}</p>

      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground text-xs">
          {membership.appointments_remaining}/{membership.appointments_total} turnos
        </p>
        <div data-slot="progress-track" className="bg-foreground/15 h-1.5 overflow-hidden rounded-full">
          <div
            data-slot="progress-fill"
            className={cn(
              'h-full rounded-full transition-[width]',
              remainingPct <= 25 ? 'bg-warning' : 'bg-accent',
            )}
            style={{ width: `${remainingPct}%` }}
          />
        </div>
      </div>

      <p className={cn('text-xs', expiringSoon ? 'text-warning font-medium' : 'text-muted-foreground')}>
        {expiringSoon
          ? daysLeft === 0
            ? 'Vence hoy'
            : `Vence en ${daysLeft} d.`
          : formatMembershipDate(membership.expires_at)}
      </p>

      <Badge variant={membershipStatusVariant(membership.status)} className="hidden justify-self-end sm:inline-flex">
        {MEMBERSHIP_STATUS_LABELS[membership.status] ?? membership.status}
      </Badge>
    </div>
  )
}

export function MembershipsPage() {
  const { data: profile } = useProfile()
  const { data: plans } = useMembershipPlans()
  const { data: allPlans } = useMembershipPlans(true)
  const { data: memberships } = useClientMemberships()
  const { data: clients } = useClients('')
  const { purchase, savePlan, deletePlan } = useMembershipMutations()

  const [clientId, setClientId] = useState('')
  const [planId, setPlanId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [showInactivePlans, setShowInactivePlans] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editingPlanActive, setEditingPlanActive] = useState(true)
  const [planName, setPlanName] = useState('')
  const [planPrice, setPlanPrice] = useState('')
  const [planTurns, setPlanTurns] = useState('4')
  const [planMonths, setPlanMonths] = useState('3')

  const membershipRows = (memberships ?? []) as ClientMembershipRow[]
  const planRows = (allPlans ?? []) as MembershipPlanRow[]
  const activePlanRows = useMemo(() => planRows.filter((plan) => plan.is_active), [planRows])
  const inactivePlanRows = useMemo(() => planRows.filter((plan) => !plan.is_active), [planRows])
  const visiblePlanRows = showInactivePlans ? inactivePlanRows : activePlanRows

  const activeMemberships = useMemo(
    () => membershipRows.filter((m) => isLiveStatus(m.status)),
    [membershipRows],
  )
  const historyMemberships = useMemo(
    () => membershipRows.filter((m) => !isLiveStatus(m.status)),
    [membershipRows],
  )

  const filteredMemberships = useMemo(() => {
    const source =
      statusFilter === 'active'
        ? activeMemberships
        : statusFilter === 'history'
          ? historyMemberships
          : membershipRows

    const sorted = [...source].sort((a, b) => {
      if (statusFilter === 'history') {
        return new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
      }
      return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
    })

    const term = search.trim().toLowerCase()
    if (!term) return sorted

    return sorted.filter((m) => {
      const client = resolveClient(m)
      const name = client ? getClientFullName(client).toLowerCase() : ''
      const phone = (client?.phone_display ?? client?.phone_normalized ?? '').toLowerCase()
      return name.includes(term) || phone.includes(term) || m.plan_name.toLowerCase().includes(term)
    })
  }, [activeMemberships, historyMemberships, membershipRows, search, statusFilter])

  const resetPlanForm = () => {
    setEditingPlanId(null)
    setEditingPlanActive(true)
    setPlanName('')
    setPlanPrice('')
    setPlanTurns('4')
    setPlanMonths('3')
  }

  const openCreatePlan = () => {
    resetPlanForm()
    setPlanFormOpen(true)
  }

  const startEditPlan = (plan: MembershipPlanRow) => {
    setEditingPlanId(plan.id)
    setEditingPlanActive(plan.is_active)
    setPlanName(plan.name)
    setPlanPrice(String(plan.price))
    setPlanTurns(String(plan.appointments_included))
    setPlanMonths(String(plan.validity_months))
    setPlanFormOpen(true)
  }

  const closePlanForm = () => {
    setPlanFormOpen(false)
    resetPlanForm()
  }

  const sell = async () => {
    if (!clientId || !planId) return
    try {
      await purchase.mutateAsync({ client_id: clientId, plan_id: planId, payment_confirmed: true })
      notifySuccess('Membresía activada')
      setClientId('')
      setPlanId('')
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  const submitPlan = async () => {
    if (!profile?.organization_id || !planName.trim()) return
    try {
      await savePlan.mutateAsync({
        id: editingPlanId ?? undefined,
        organization_id: profile.organization_id,
        name: planName,
        price: Number(planPrice),
        appointments_included: Number(planTurns),
        validity_months: Number(planMonths),
        is_active: editingPlanId ? editingPlanActive : true,
      })
      notifySuccess(editingPlanId ? 'Plan actualizado' : 'Plan creado')
      closePlanForm()
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  const handleDeletePlan = async (plan: MembershipPlanRow) => {
    if (!(await confirmAction(`¿Eliminar el plan "${plan.name}"?`))) return
    try {
      await deletePlan.mutateAsync(plan.id)
      if (editingPlanId === plan.id) closePlanForm()
      if (planId === plan.id) setPlanId('')
      notifySuccess('Plan eliminado')
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  const listDescription =
    statusFilter === 'active'
      ? `${activeMemberships.length} vigente${activeMemberships.length === 1 ? '' : 's'}`
      : statusFilter === 'history'
        ? `${historyMemberships.length} en historial`
        : `${membershipRows.length} en total`

  return (
    <div className="space-y-5">
      <PageHeader
        title="Membresías"
        description={`${activeMemberships.length} activa${activeMemberships.length === 1 ? '' : 's'} · ${plans?.length ?? 0} plan${(plans?.length ?? 0) === 1 ? '' : 'es'} · ${membershipRows.length} vendida${membershipRows.length === 1 ? '' : 's'}`}
      />

      <Card className="gap-0 rounded-xl py-0">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>Vender a un cliente</Label>
            <ClientCombobox
              clients={clients ?? []}
              value={clientId}
              onChange={setClientId}
              placeholder="Buscar cliente…"
              showCreateClient={false}
            />
          </div>
          <div className="min-w-0 space-y-1.5 sm:w-52 lg:w-72">
            <Label htmlFor="sell_plan">Plan</Label>
            <select
              id="sell_plan"
              className={selectClass}
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              <option value="">Seleccionar plan…</option>
              {plans?.map((p) => (
                <option key={p.id as string} value={p.id as string}>
                  {p.name as string} — {formatServicePrice(Number(p.price))}
                </option>
              ))}
            </select>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <Label className="hidden opacity-0 sm:block" aria-hidden>
              Acciones
            </Label>
            <div className="flex gap-2">
              <Button
                variant="accent"
                className="h-11 flex-1 sm:flex-none"
                disabled={!clientId || !planId || purchase.isPending}
                onClick={() => void sell()}
              >
                Activar
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 sm:flex-none"
                onClick={openCreatePlan}
              >
                <Plus className="size-4" aria-hidden="true" />
                Nuevo plan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(visiblePlanRows.length > 0 || inactivePlanRows.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {visiblePlanRows.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate font-medium">{plan.name}</span>
              <span className="text-muted-foreground hidden sm:inline">
                {plan.appointments_included} turnos · {plan.validity_months} meses ·{' '}
                {formatServicePrice(Number(plan.price))}
              </span>
              {!plan.is_active && <Badge variant="secondary">Inactivo</Badge>}
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Editar ${plan.name}`}
                onClick={() => startEditPlan(plan)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive size-7"
                aria-label={`Eliminar ${plan.name}`}
                disabled={deletePlan.isPending}
                onClick={() => void handleDeletePlan(plan)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {inactivePlanRows.length > 0 && (
            <Button
              variant={showInactivePlans ? 'accent' : 'outline'}
              size="sm"
              aria-pressed={showInactivePlans}
              className={
                showInactivePlans
                  ? undefined
                  : 'border-accent bg-accent/15 text-foreground hover:bg-accent hover:text-accent-foreground'
              }
              onClick={() => setShowInactivePlans((open) => !open)}
            >
              {showInactivePlans ? (
                <Eye className="size-4" aria-hidden="true" />
              ) : (
                <EyeOff className="size-4" aria-hidden="true" />
              )}
              {showInactivePlans
                ? 'Ver activos'
                : `Mostrar inactivos (${inactivePlanRows.length})`}
            </Button>
          )}
        </div>
      )}

      {planFormOpen && (
        <Card className="rounded-xl">
          <CardContent className="space-y-4 p-4">
            <p className="text-sm font-medium">{editingPlanId ? 'Editar plan' : 'Nuevo plan'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="plan_name">Nombre del plan</Label>
                <Input
                  id="plan_name"
                  placeholder="Ej. Pack 4 turnos"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_price">Precio</Label>
                <Input
                  id="plan_price"
                  type="number"
                  placeholder="50000"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_turns">Turnos incluidos</Label>
                <Input
                  id="plan_turns"
                  type="number"
                  placeholder="4"
                  value={planTurns}
                  onChange={(e) => setPlanTurns(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2 sm:max-w-xs">
                <Label htmlFor="plan_months">Meses de vigencia</Label>
                <Input
                  id="plan_months"
                  type="number"
                  placeholder="3"
                  value={planMonths}
                  onChange={(e) => setPlanMonths(e.target.value)}
                />
              </div>
              {editingPlanId && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={editingPlanActive}
                    onChange={(e) => setEditingPlanActive(e.target.checked)}
                  />
                  Plan activo para ventas
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={() => void submitPlan()} disabled={savePlan.isPending}>
                {editingPlanId ? 'Guardar cambios' : 'Crear plan'}
              </Button>
              <Button type="button" variant="outline" onClick={closePlanForm}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden rounded-xl">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="rounded-lg pl-9"
              placeholder="Buscar cliente, teléfono o plan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar membresías"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="active">Activas ({activeMemberships.length})</TabsTrigger>
              <TabsTrigger value="history">Historial ({historyMemberships.length})</TabsTrigger>
              <TabsTrigger value="all">Todas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="text-muted-foreground hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7.5rem_6.5rem_auto] gap-4 border-b px-3 py-2 text-xs font-medium sm:grid">
          <span>Cliente</span>
          <span>Plan</span>
          <span>Uso</span>
          <span>Vence</span>
          <span className="text-right">Estado</span>
        </div>

        {filteredMemberships.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Ticket}
              title={search.trim() ? 'Sin resultados' : statusFilter === 'active' ? 'Sin membresías activas' : 'Sin membresías'}
              description={
                search.trim()
                  ? 'Probá con otro nombre, teléfono o plan.'
                  : 'Cuando vendas un plan, el cliente y los turnos restantes aparecen acá.'
              }
            />
          </div>
        ) : (
          <div className="divide-y">
            {filteredMemberships.map((membership) => (
              <MembershipRow key={membership.id} membership={membership} />
            ))}
          </div>
        )}

        {filteredMemberships.length > 0 && (
          <p className="text-muted-foreground border-t px-3 py-2 text-xs">
            Mostrando {filteredMemberships.length} · {listDescription}
          </p>
        )}
      </Card>
    </div>
  )
}
