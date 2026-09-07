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
        <h1 className="font-display text-3xl font-semibold tracking-wide uppercase sm:text-4xl">{title}</h1>
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
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2 sm:gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-wide uppercase">{title}</h2>
        {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
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
    <div className="listing-sheet flex flex-col items-center justify-center rounded-sm px-6 py-12 text-center">
      <div className="bg-primary text-primary-foreground mb-4 flex size-10 items-center justify-center rounded-sm">
        <Icon className="size-4" aria-hidden />
      </div>
      <h3 className="font-display text-xl font-semibold tracking-wide uppercase">{title}</h3>
      {description && <p className="text-muted-foreground mt-2 max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

interface BoxOfficeSide {
  label: string
  value: string
}

export function BoxOfficeBar({
  left,
  right,
  note,
  className,
}: {
  left: BoxOfficeSide
  right: BoxOfficeSide
  note?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="listing-sheet grid overflow-hidden rounded-sm sm:grid-cols-2">
        <div className="bg-primary text-primary-foreground flex flex-col justify-between gap-2 px-4 py-5">
          <p className="font-listing text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
            {left.label}
          </p>
          <p className="font-listing text-3xl font-semibold tabular-nums sm:text-4xl">{left.value}</p>
        </div>
        <div className="bg-accent text-accent-foreground flex flex-col justify-between gap-2 px-4 py-5">
          <p className="font-listing text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
            {right.label}
          </p>
          <p className="font-listing text-3xl font-semibold tabular-nums sm:text-4xl">{right.value}</p>
        </div>
      </div>
      {note && <p className="text-muted-foreground font-listing text-sm tabular-nums">{note}</p>}
    </div>
  )
}
