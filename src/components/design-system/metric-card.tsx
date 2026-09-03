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
    <div className={cn('rounded-xl border bg-card p-3 sm:p-4', className)}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 space-y-1 sm:space-y-2">
          <p className="truncate text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
          <p className="text-muted-foreground text-xs sm:text-sm">{label}</p>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
        <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9">
          <Icon className="size-3.5 sm:size-4" aria-hidden />
        </div>
      </div>
    </div>
  )
}
