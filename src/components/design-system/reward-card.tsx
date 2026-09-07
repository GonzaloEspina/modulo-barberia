import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RewardCardProps {
  name: string
  description?: string | null
  pointsRequired: number
  clientBalance?: number
  stock?: number | null
  disabled?: boolean
  loading?: boolean
  onRedeem?: () => void
  className?: string
}

export function RewardCard({
  name,
  description,
  pointsRequired,
  clientBalance,
  stock,
  disabled,
  loading,
  onRedeem,
  className,
}: RewardCardProps) {
  const canRedeem =
    clientBalance != null && clientBalance >= pointsRequired && !disabled
  const missing =
    clientBalance != null && clientBalance < pointsRequired
      ? pointsRequired - clientBalance
      : null

  return (
    <article
      className={cn(
        'flex flex-col rounded-sm border bg-card p-4 transition-colors hover-surface',
        canRedeem ? 'border-accent/30' : 'opacity-95',
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground mb-3 flex size-10 items-center justify-center rounded-sm">
        <Gift className="size-5" />
      </div>
      <h3 className="font-semibold">{name}</h3>
      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      <p className="mt-3 font-medium">{pointsRequired} puntos</p>
      {stock != null && (
        <p className="text-muted-foreground text-xs">Stock: {stock}</p>
      )}
      <div className="mt-4">
        {missing != null && missing > 0 ? (
          <p className="text-muted-foreground text-sm">Te faltan {missing} puntos</p>
        ) : (
          onRedeem && (
            <Button
              variant={canRedeem ? 'accent' : 'outline'}
              size="sm"
              disabled={!canRedeem || loading}
              onClick={onRedeem}
            >
              Canjear
            </Button>
          )
        )}
      </div>
    </article>
  )
}
