import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-wide uppercase sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground font-listing text-sm tabular-nums">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 sm:gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-wide uppercase">{title}</h2>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="listing-sheet flex flex-col items-center justify-center rounded-sm px-6 py-14 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-11 items-center justify-center rounded-sm">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="font-display text-base font-semibold tracking-wide uppercase">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface BoxOfficeBarProps {
  left: { label: string; value: string }
  right: { label: string; value: string }
  note?: string
  className?: string
}

/** Producción vs caja — lectura de taquilla, no métricas en cards. */
export function BoxOfficeBar({ left, right, note, className }: BoxOfficeBarProps) {
  return (
    <div className={cn('listing-sheet overflow-hidden rounded-sm', className)}>
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="px-4 py-5 sm:px-6">
          <p className="font-listing text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
            {left.label}
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tracking-wide tabular-nums sm:text-4xl">
            {left.value}
          </p>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <p className="font-listing text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
            {right.label}
          </p>
          <p className="font-display mt-1 text-3xl font-semibold tracking-wide tabular-nums sm:text-4xl">
            {right.value}
          </p>
        </div>
      </div>
      {note && (
        <p className="border-t border-border px-4 py-2.5 font-listing text-xs tracking-wide text-muted-foreground sm:px-6">
          {note}
        </p>
      )}
    </div>
  )
}
