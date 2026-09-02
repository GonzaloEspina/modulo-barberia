import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatServicePrice } from '@/types/service'

interface ServiceCardProps {
  id: string
  name: string
  durationMinutes: number
  price: number
  selected: boolean
  onToggle: (id: string) => void
}

export function ServiceCard({
  id,
  name,
  durationMinutes,
  price,
  selected,
  onToggle,
}: ServiceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
        selected
          ? 'border-accent bg-accent/10 text-foreground ring-1 ring-accent/30'
          : 'bg-card hover-surface hover:border-foreground/15',
      )}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-accent bg-accent text-accent-foreground' : 'border-input bg-background',
        )}
      >
        {selected && <Check className="size-2.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span className="text-muted-foreground shrink-0 text-xs">
        {durationMinutes} min · {formatServicePrice(price)}
      </span>
    </button>
  )
}

export function ServiceSelectionSummary({
  count,
  durationMinutes,
  totalPrice,
}: {
  count: number
  durationMinutes: number
  totalPrice: number
}) {
  if (count === 0) return null
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span>
        <span className="text-foreground font-medium">{count}</span> servicio{count !== 1 ? 's' : ''}
      </span>
      <span>{durationMinutes} min</span>
      <span className="text-foreground font-medium">{formatServicePrice(totalPrice)}</span>
    </div>
  )
}
