import { useState } from 'react'
import { ClientCombobox } from '@/components/design-system/client-combobox'
import { PageHeader, SectionHeader } from '@/components/design-system/layout-primitives'
import { PointsBalance } from '@/components/design-system/points-components'
import { RewardCard } from '@/components/design-system/reward-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useClients } from '@/features/clients/api'
import {
  useClientPointBalance,
  usePointsConfig,
  usePointsMutations,
  useRedemptions,
  useRewards,
} from '@/features/points/api'
import { RewardsAdminPanel } from '@/features/points/rewards-admin-panel'
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify'

const REDEMPTION_STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitado',
  approved: 'Aprobado',
  used: 'Usado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  expired: 'Vencido',
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

  const minRewardPoints = rewards?.length
    ? Math.min(...rewards.map((r) => r.points_required as number))
    : undefined

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
    <div className="space-y-6">
      <PageHeader
        title="Puntos y premios"
        description="Canjes, saldos y catálogo de recompensas"
      />

      <RewardsAdminPanel />

      <Card className="rounded-xl">
        <CardContent className="p-4 text-sm">
          Puntos {config?.enabled ? 'habilitados' : 'deshabilitados'} · Acreditación:{' '}
          {config?.credit_moment as string}
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <SectionHeader title="Canjear premio" />
          <ClientCombobox
            clients={clients ?? []}
            value={selectedClientId}
            onChange={setSelectedClientId}
            placeholder="Seleccionar cliente para canje…"
          />
        </div>

        {selectedClientId && (
          <PointsBalance
            balance={balance?.balance ?? 0}
            nextExpiresAt={balance?.next_expires_at}
            targetPoints={minRewardPoints}
          />
        )}
      </section>

      <section>
        <SectionHeader title="Premios disponibles" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rewards?.map((r) => (
            <RewardCard
              key={r.id as string}
              name={r.name as string}
              description={r.description as string}
              pointsRequired={r.points_required as number}
              clientBalance={selectedClientId ? balance?.balance : undefined}
              stock={r.stock as number | null}
              disabled={!selectedClientId}
              loading={redeemReward.isPending}
              onRedeem={() => void handleRedeem(r.id as string, r.points_required as number)}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Canjes recientes" />
        <div className="space-y-2">
          {redemptions?.length === 0 && (
            <p className="text-muted-foreground text-sm">Sin canjes.</p>
          )}
          {redemptions?.map((r) => {
            const client = r.clients
            const clientName = client
              ? `${(Array.isArray(client) ? client[0] : client)?.first_name} ${(Array.isArray(client) ? client[0] : client)?.last_name}`
              : '—'
            return (
              <div
                key={r.id}
                className="hover-surface flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {relName(r.rewards)} · <code>{r.unique_code}</code>
                  </p>
                  <p className="text-muted-foreground">
                    {clientName} · {r.points_used} pts
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {REDEMPTION_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {r.status === 'requested' && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
