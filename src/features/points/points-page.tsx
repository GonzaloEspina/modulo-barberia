import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClientCombobox } from '@/components/design-system/client-combobox'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useClients } from '@/features/clients/api'
import { AdjustPointsForm } from '@/features/points/adjust-points-form'
import {
  useClientPointBalance,
  usePointsConfig,
  usePointsMutations,
  useRedemptions,
  useRewards,
} from '@/features/points/api'
import { RewardsAdminPanel } from '@/features/points/rewards-admin-panel'
import { formatAppDate } from '@/lib/app-datetime'
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify'
import { getClientFullName } from '@/types/client'

const REDEMPTION_STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitado',
  approved: 'Aprobado',
  used: 'Usado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  expired: 'Vencido',
}

const CREDIT_MOMENT_LABELS: Record<string, string> = {
  on_create: 'al crear el turno',
  on_confirm: 'al confirmar el turno',
  on_complete: 'al completar el turno',
  on_payment: 'al registrar el pago',
}

function relName<T extends { name?: string }>(value: T | T[] | null | undefined): string {
  const row = Array.isArray(value) ? value[0] : value
  if (!row) return '—'
  if ('name' in row) return String(row.name ?? '—')
  return '—'
}

export function PointsPage() {
  const [selectedClientId, setSelectedClientId] = useState('')

  const { data: config } = usePointsConfig()
  const { data: rewards } = useRewards()
  const { data: clients } = useClients('')
  const { data: balance } = useClientPointBalance(selectedClientId || undefined)
  const { data: redemptions } = useRedemptions()
  const { redeemReward, deliverRedemption, cancelRedemption } = usePointsMutations()

  const selectedClient = clients?.find((client) => client.id === selectedClientId)
  const selectedClientName = selectedClient ? getClientFullName(selectedClient) : undefined
  const creditLabel = CREDIT_MOMENT_LABELS[String(config?.credit_moment ?? '')] ?? String(config?.credit_moment ?? '')

  const handleRedeem = async (rewardId: string, pointsRequired: number) => {
    if (!selectedClientId) {
      notifyError('Seleccioná un cliente')
      return
    }
    if ((balance?.balance ?? 0) < pointsRequired) {
      notifyError('Saldo insuficiente')
      return
    }
    if (!(await confirmAction('¿Confirmar canje de premio?'))) return
    try {
      const code = await redeemReward.mutateAsync({
        clientId: selectedClientId,
        rewardId,
      })
      notifySuccess(`Canje registrado. Código: ${code}`)
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Puntos y premios"
        description={
          config
            ? `Puntos ${config.enabled ? 'habilitados' : 'deshabilitados'}${creditLabel ? ` · Acreditación ${creditLabel}` : ''}`
            : 'Canjes, saldos y catálogo de recompensas'
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="min-w-0 gap-0 overflow-hidden rounded-xl py-0">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <p className="text-sm font-medium">Canjear premio</p>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/clientes/nuevo">
                <Plus className="size-4" aria-hidden="true" />
                Nuevo cliente
              </Link>
            </Button>
          </div>
          <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <ClientCombobox
                  clients={clients ?? []}
                  value={selectedClientId}
                  onChange={setSelectedClientId}
                  placeholder="Seleccionar cliente…"
                  showCreateClient={false}
                />
              </div>
              {selectedClientId && (
                <p className="shrink-0 text-sm">
                  <span className="text-muted-foreground">Saldo </span>
                  <span className="font-semibold tabular-nums">{balance?.balance ?? 0} pts</span>
                  {balance?.next_expires_at && (
                    <span className="text-muted-foreground">
                      {' · vence '}
                      {formatAppDate(balance.next_expires_at)}
                    </span>
                  )}
                </p>
              )}
            </div>
            {selectedClientId && (
              <AdjustPointsForm
                clientId={selectedClientId}
                clientName={selectedClientName}
                currentBalance={balance?.balance ?? 0}
                className="border-t pt-3"
              />
            )}
          </div>
          <div className="border-t">
            <p className="text-muted-foreground px-3 py-1.5 text-xs font-medium">Premios disponibles</p>
            {!rewards?.length ? (
              <p className="text-muted-foreground px-3 pb-3 text-sm">No hay premios para canjear.</p>
            ) : (
              <div className="divide-y border-t">
                {rewards.map((r) => {
                  const pointsRequired = r.points_required as number
                  const canRedeem =
                    Boolean(selectedClientId) && (balance?.balance ?? 0) >= pointsRequired
                  const missing =
                    selectedClientId && (balance?.balance ?? 0) < pointsRequired
                      ? pointsRequired - (balance?.balance ?? 0)
                      : null
                  return (
                    <div
                      key={r.id as string}
                      className="hover-surface flex items-center gap-3 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.name as string}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {pointsRequired} pts
                          {r.stock != null && ` · stock ${r.stock as number}`}
                          {missing != null && missing > 0 && ` · faltan ${missing} pts`}
                        </p>
                      </div>
                      <Button
                        variant={canRedeem ? 'accent' : 'outline'}
                        size="sm"
                        disabled={!canRedeem || redeemReward.isPending}
                        onClick={() => void handleRedeem(r.id as string, pointsRequired)}
                      >
                        Canjear
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        <RewardsAdminPanel />
      </div>

      <Card className="gap-0 overflow-hidden rounded-xl py-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-medium">Canjes recientes</p>
        </div>
        {!redemptions?.length ? (
          <p className="text-muted-foreground px-3 py-3 text-sm">Sin canjes.</p>
        ) : (
          <div className="divide-y">
            {redemptions.map((r) => {
              const client = r.clients
              const row = Array.isArray(client) ? client[0] : client
              const clientName = row ? getClientFullName(row) : '—'
              return (
                <div
                  key={r.id}
                  className="hover-surface flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {relName(r.rewards)} · <code>{r.unique_code}</code>
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {clientName} · {r.points_used} pts
                    </p>
                  </div>
                  <Badge variant="outline">{REDEMPTION_STATUS_LABELS[r.status] ?? r.status}</Badge>
                  {r.status === 'requested' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void deliverRedemption.mutateAsync(r.id)}
                      >
                        Entregar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void cancelRedemption.mutateAsync(r.id)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
