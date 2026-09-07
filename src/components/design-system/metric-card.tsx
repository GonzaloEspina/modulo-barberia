import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
  className?: string
}

export function MetricCard({ label, value, icon: Icon, hint, className }: MetricCardProps) {
  return (
    <div className={cn('listing-sheet rounded-sm p-3 sm:p-4', className)}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-listing text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            {label}
          </p>
          <p className="font-listing text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
        <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </div>
    </div>
  )
}
