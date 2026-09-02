import { PaymentStatusBadge } from '@/components/design-system/status-badges'
import { formatServicePrice } from '@/types/service'
import { cn } from '@/lib/utils'

interface PaymentStatusProps {
  total: number
  paid: number
  pending: number
  status: string
  className?: string
}

export function PaymentStatus({
  total,
  paid,
  pending,
  status,
  className,
}: PaymentStatusProps) {
  const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

  return (
    <div className={cn('space-y-4 rounded-xl border bg-card p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Estado del pago</h3>
        <PaymentStatusBadge status={status} />
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="font-medium">{formatServicePrice(total)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Pagado</p>
          <p className="font-medium text-success">{formatServicePrice(paid)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Pendiente</p>
          <p className="font-medium">{formatServicePrice(pending)}</p>
        </div>
      </div>
      {total > 0 && (
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className="bg-success h-full rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
