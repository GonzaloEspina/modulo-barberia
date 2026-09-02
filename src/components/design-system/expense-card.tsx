import { format } from 'date-fns'
import { Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatServicePrice } from '@/types/service'
import { cn } from '@/lib/utils'

interface ExpenseCardProps {
  description: string
  amount: number
  date: string
  type?: 'general' | 'fixed'
  className?: string
}

export function ExpenseCard({
  description,
  amount,
  date,
  type = 'general',
  className,
}: ExpenseCardProps) {
  return (
    <article className={cn('hover-surface rounded-xl border bg-card p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Receipt className="size-4" />
          </div>
          <div>
            <p className="font-medium">{description}</p>
            <p className="text-muted-foreground text-sm">
              {format(new Date(date), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold">{formatServicePrice(amount)}</p>
          <Badge variant="outline" className="mt-1">
            {type === 'fixed' ? 'Fijo' : 'General'}
          </Badge>
        </div>
      </div>
    </article>
  )
}
