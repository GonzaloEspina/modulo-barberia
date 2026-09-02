import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TimeSlotState = 'available' | 'selected' | 'occupied' | 'blocked' | 'conflict' | 'overbooking'

interface TimeSlotProps {
  label: string
  state: TimeSlotState
  subtitle?: string
  onClick?: () => void
  disabled?: boolean
}

const STATE_STYLES: Record<TimeSlotState, string> = {
  available:
    'border-border bg-card hover-surface hover:border-foreground/20',
  selected: 'border-primary bg-primary text-primary-foreground',
  occupied: 'border-transparent bg-muted text-muted-foreground line-through',
  blocked: 'border-transparent bg-muted/50 text-muted-foreground opacity-60',
  conflict: 'border-warning/40 bg-warning/10 text-warning-foreground',
  overbooking: 'border-warning/40 bg-warning/10 text-warning-foreground',
}

export function TimeSlot({ label, state, subtitle, onClick, disabled }: TimeSlotProps) {
  const isInteractive = state === 'available' || state === 'selected' || state === 'overbooking'
  return (
    <button
      type="button"
      disabled={disabled || !isInteractive}
      onClick={onClick}
      className={cn(
        'flex min-h-11 flex-col items-center justify-center rounded-lg border px-2 py-2 text-sm transition-colors',
        STATE_STYLES[state],
        !isInteractive && 'cursor-not-allowed',
      )}
    >
      <span className="font-medium">{label}</span>
      {subtitle && <span className="text-[10px] opacity-80">{subtitle}</span>}
    </button>
  )
}

export function TimeSlotGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">{children}</div>
}
