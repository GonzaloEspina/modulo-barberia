import { CreditCard, Pencil, Phone, Ticket, Trash2, Users } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from '@/components/design-system/metric-card'
import { EmptyState, PageHeader, SectionHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useClients } from '@/features/clients/api'
import { useClientMemberships, useMembershipMutations, useMembershipPlans } from '@/features/memberships/api'
import { useProfile } from '@/hooks/use-profile'
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify'
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

const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  pending_payment: 'Pago pendiente',
  exhausted: 'Agotada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
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
    return format(new Date(value), 'dd MMM yyyy', { locale: es })
  } catch {
    return value
  }
}

function ActiveMembershipCard({ membership }: { membership: ClientMembershipRow }) {
  const client = resolveClient(membership)
  const clientName = client ? getClientFullName(client) : 'Cliente desconocido'
  const phone = client?.phone_display ?? client?.phone_normalized
  const used = membership.appointments_total - membership.appointments_remaining
  const progress = membership.appointments_total
    ? Math.round((used / membership.appointments_total) * 100)
    : 0

  return (
    <Card className="hover-surface overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {client ? (
              <Link
                to={`/clientes/${client.id}`}
                className="font-medium hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {clientName}
              </Link>
            ) : (
              <p className="font-medium">{clientName}</p>
            )}
            {phone && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Phone className="size-3.5 shrink-0" />
                {phone}
              </p>
            )}
          </div>
          <Badge variant={membershipStatusVariant(membership.status)}>
            {MEMBERSHIP_STATUS_LABELS[membership.status] ?? membership.status}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">{membership.plan_name}</p>
          <p className="text-muted-foreground text-sm">
            {membership.appointments_remaining} de {membership.appointments_total} turnos disponibles
          </p>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-accent h-full rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Vence el {formatMembershipDate(membership.expires_at)}
          {' · '}
          Vendida el {formatMembershipDate(membership.purchased_at)}
        </p>
      </CardContent>
    </Card>
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
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editingPlanActive, setEditingPlanActive] = useState(true)
  const [planName, setPlanName] = useState('')
  const [planPrice, setPlanPrice] = useState('')
  const [planTurns, setPlanTurns] = useState('4')
  const [planMonths, setPlanMonths] = useState('3')

  const membershipRows = (memberships ?? []) as ClientMembershipRow[]

  const activeMemberships = useMemo(
    () => membershipRows.filter((m) => m.status === 'active'),
    [membershipRows],
  )

  const otherMemberships = useMemo(
    () => membershipRows.filter((m) => m.status !== 'active'),
    [membershipRows],
  )

  const resetPlanForm = () => {
    setEditingPlanId(null)
    setEditingPlanActive(true)
    setPlanName('')
    setPlanPrice('')
    setPlanTurns('4')
    setPlanMonths('3')
  }

  const startEditPlan = (plan: MembershipPlanRow) => {
    setEditingPlanId(plan.id)
    setEditingPlanActive(plan.is_active)
    setPlanName(plan.name)
    setPlanPrice(String(plan.price))
    setPlanTurns(String(plan.appointments_included))
    setPlanMonths(String(plan.validity_months))
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
      resetPlanForm()
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  const handleDeletePlan = async (plan: MembershipPlanRow) => {
    if (!(await confirmAction(`¿Eliminar el plan "${plan.name}"?`))) return
    try {
      await deletePlan.mutateAsync(plan.id)
      if (editingPlanId === plan.id) resetPlanForm()
      if (planId === plan.id) setPlanId('')
      notifySuccess('Plan eliminado')
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membresías"
        description="Gestioná planes, vendé packs a clientes y seguí el uso de turnos."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Planes activos" value={String(plans?.length ?? 0)} icon={CreditCard} />
        <MetricCard label="Membresías activas" value={String(activeMemberships.length)} icon={Ticket} />
        <MetricCard label="Total vendidas" value={String(membershipRows.length)} icon={Users} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardContent className="space-y-4 pt-6">
            <SectionHeader
              title="Planes"
              description="Catálogo de packs que podés vender a los clientes."
            />
            <div className="grid gap-2">
              {allPlans?.length === 0 && (
                <p className="text-muted-foreground text-sm">Aún no hay planes creados.</p>
              )}
              {allPlans?.map((raw) => {
                const p = raw as MembershipPlanRow
                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {!p.is_active && <Badge variant="secondary">Inactivo</Badge>}
                      </div>
                      <p className="text-muted-foreground">
                        {p.appointments_included} turnos / {p.validity_months} meses ·{' '}
                        {formatServicePrice(Number(p.price))}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEditPlan(p)}>
                        <Pencil className="size-4" aria-hidden="true" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDeletePlan(p)}
                        disabled={deletePlan.isPending}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-medium">{editingPlanId ? 'Editar plan' : 'Crear plan'}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="plan_months">Meses de vigencia</Label>
                  <Input
                    id="plan_months"
                    type="number"
                    placeholder="3"
                    value={planMonths}
                    onChange={(e) => setPlanMonths(e.target.value)}
                  />
                </div>
              </div>
              {editingPlanId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={editingPlanActive}
                    onChange={(e) => setEditingPlanActive(e.target.checked)}
                  />
                  Plan activo para ventas
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="accent" onClick={() => void submitPlan()} disabled={savePlan.isPending}>
                  {editingPlanId ? 'Guardar cambios' : 'Crear plan'}
                </Button>
                {editingPlanId && (
                  <Button type="button" variant="outline" onClick={resetPlanForm}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <SectionHeader
                title="Vender membresía"
                description="Asigná un plan a un cliente y activá el pack."
              />
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="sell_client">Cliente</Label>
                  <select
                    id="sell_client"
                    className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  >
                    <option value="">Seleccionar cliente…</option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sell_plan">Plan</Label>
                  <select
                    id="sell_plan"
                    className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
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
                <Button
                  variant="accent"
                  className="w-full"
                  disabled={!clientId || !planId || purchase.isPending}
                  onClick={() => void sell()}
                >
                  Activar membresía
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <SectionHeader
                title="Membresías activas"
                description={`${activeMemberships.length} cliente${activeMemberships.length === 1 ? '' : 's'} con pack vigente.`}
              />
              {activeMemberships.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="Sin membresías activas"
                  description="Cuando vendas un plan, aparecerá acá con el cliente y los turnos restantes."
                />
              ) : (
                <div className="space-y-3">
                  {activeMemberships.map((m) => (
                    <ActiveMembershipCard key={m.id} membership={m} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {otherMemberships.length > 0 && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <SectionHeader
                  title="Historial"
                  description="Membresías vencidas, agotadas o canceladas."
                />
                <div className="space-y-3">
                  {otherMemberships.map((m) => (
                    <ActiveMembershipCard key={m.id} membership={m} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
