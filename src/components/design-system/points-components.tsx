import { TrendingDown, TrendingUp } from 'lucide-react'
import { formatAppDate } from '@/lib/app-datetime'
import { cn } from '@/lib/utils'

interface PointsBalanceProps {
  balance: number
  nextExpiresAt?: string | null
  targetPoints?: number
  className?: string
}

export function PointsBalance({
  balance,
  nextExpiresAt,
  targetPoints,
  className,
}: PointsBalanceProps) {
  const progress =
    targetPoints && targetPoints > 0
      ? Math.min(100, Math.round((balance / targetPoints) * 100))
      : null

  return (
    <div className={cn('listing-sheet rounded-sm p-5', className)}>
      <p className="text-muted-foreground text-sm">Saldo de puntos</p>
      <p className="font-listing mt-1 text-3xl font-semibold tabular-nums">{balance}</p>
      {nextExpiresAt && (
        <p className="text-muted-foreground mt-2 text-sm">
          Próximo vencimiento:{' '}
          {formatAppDate(nextExpiresAt)}
        </p>
      )}
      {progress != null && (
        <div className="mt-4 space-y-2">
          <div className="bg-muted h-1.5 overflow-hidden rounded-sm">
            <div className="bg-accent h-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-muted-foreground text-xs">
            Te faltan {Math.max(targetPoints! - balance, 0)} pts para el próximo premio
          </p>
        </div>
      )}
    </div>
  )
}

interface PointsMovementProps {
  quantity: number
  label: string
  date: string
  className?: string
}

export function PointsMovement({ quantity, label, date, className }: PointsMovementProps) {
  const positive = quantity > 0
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border bg-card p-3', className)}>
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          positive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
        )}
      >
        {positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {positive ? '+' : ''}
          {quantity} · {label}
        </p>
        <p className="text-muted-foreground text-sm">{date}</p>
      </div>
    </div>
  )
}

export function PointsMovementList({
  movements,
}: {
  movements: PointsMovementProps[]
}) {
  if (movements.length === 0) {
    return <p className="text-muted-foreground text-sm">Sin movimientos registrados.</p>
  }
  return (
    <div className="space-y-2">
      {movements.map((m, i) => (
        <PointsMovement key={`${m.date}-${m.label}-${i}`} {...m} />
      ))}
    </div>
  )
}
