import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  children: ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('grid gap-3 listing-sheet rounded-sm p-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {children}
    </div>
  )
}
