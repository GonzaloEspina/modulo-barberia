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
  size?: 'default' | 'lg'
}

export function ServiceCard({
  id,
  name,
  durationMinutes,
  price,
  selected,
  onToggle,
  size = 'default',
}: ServiceCardProps) {
  const isLarge = size === 'lg'

  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={cn(
        'max-w-full text-left transition-colors',
        isLarge
          ? 'flex min-h-[88px] w-full flex-col gap-2 rounded-sm border p-4'
          : 'inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card hover-surface hover:border-foreground/15',
      )}
    >
      <span className={cn('flex items-start gap-2', isLarge && 'w-full')}>
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border',
            isLarge ? 'size-5' : 'size-4',
            selected ? 'border-primary-foreground bg-primary-foreground text-primary' : 'border-input bg-background',
          )}
        >
          {selected && <Check className={cn(isLarge ? 'size-3' : 'size-2.5')} strokeWidth={3} />}
        </span>
        <span className={cn('min-w-0 font-medium', isLarge ? 'text-base leading-snug' : 'truncate')}>
          {name}
        </span>
      </span>
      <span
        className={cn(
          'text-muted-foreground',
          selected && 'text-primary-foreground/80',
          isLarge ? 'pl-7 text-sm' : 'shrink-0 text-xs',
        )}
      >
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
