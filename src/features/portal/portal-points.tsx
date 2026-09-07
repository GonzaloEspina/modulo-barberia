import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatAppDate } from '@/lib/app-datetime'
import {
  usePortalRedeemMutations,
  type PortalRedemption,
  type PortalReward,
} from '@/features/portal/api'
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify'

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitado',
  approved: 'Aprobado',
  delivered: 'Entregado',
  expired: 'Vencido',
  used: 'Usado',
  cancelled: 'Cancelado',
}

interface PortalPointsProps {
  sessionToken: string
  balance: number
  nextExpiresAt?: string | null
  rewards: PortalReward[]
  redemptions: PortalRedemption[]
}

function RewardRow({
  reward,
  balance,
  redeeming,
  onRedeem,
}: {
  reward: PortalReward
  balance: number
  redeeming: boolean
  onRedeem: () => void
}) {
  const missing = Math.max(reward.points_required - balance, 0)

  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <p className="min-w-0 truncate font-medium">{reward.name}</p>
      {reward.can_redeem ? (
        <Button
          type="button"
          variant="accent"
          size="xs"
          className="shrink-0"
          disabled={redeeming}
          onClick={onRedeem}
        >
          {redeeming ? 'Canjeando…' : `Canjear · ${reward.points_required}`}
        </Button>
      ) : (
        <p className="text-muted-foreground shrink-0 text-xs">
          {reward.points_required} pts · faltan {missing}
        </p>
      )}
    </li>
  )
}

export function PortalPoints({
  sessionToken,
  balance,
  nextExpiresAt,
  rewards,
  redemptions,
}: PortalPointsProps) {
  const { redeemReward } = usePortalRedeemMutations()

  const handleRedeem = async (reward: PortalReward) => {
    if (
      !(await confirmAction(
        `¿Canjear ${reward.name} por ${reward.points_required} puntos? Mostrá el código en el local.`,
      ))
    ) {
      return
    }
    try {
      const code = await redeemReward.mutateAsync({
        token: sessionToken,
        rewardId: reward.id,
      })
      notifySuccess(`Canje listo. Código: ${code}`)
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  return (
    <Card className="gap-0 py-3">
      <CardContent className="space-y-2 px-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold tracking-wide uppercase">Tus puntos</p>
            {nextExpiresAt && (
              <p className="text-muted-foreground text-xs">
                Vence {formatAppDate(nextExpiresAt)}
              </p>
            )}
          </div>
          <p className="font-listing text-3xl font-semibold tabular-nums">{balance}</p>
        </div>

        {rewards.length === 0 ? (
          <p className="text-muted-foreground text-xs">Por ahora no hay premios para canjear.</p>
        ) : (
          <ul className="divide-y border-t">
            {rewards.map((reward) => (
              <RewardRow
                key={reward.id}
                reward={reward}
                balance={balance}
                redeeming={redeemReward.isPending && redeemReward.variables?.rewardId === reward.id}
                onRedeem={() => void handleRedeem(reward)}
              />
            ))}
          </ul>
        )}

        {redemptions.length > 0 && (
          <ul className="divide-y border-t">
            {redemptions.map((redemption) => (
              <li
                key={redemption.id}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
              >
                <p className="min-w-0 truncate">
                  <span className="font-medium">{redemption.reward_name}</span>
                  <span className="text-muted-foreground"> · {redemption.unique_code}</span>
                </p>
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  {STATUS_LABELS[redemption.status] ?? redemption.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
