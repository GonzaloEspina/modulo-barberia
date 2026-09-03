import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from '@/types/appointment'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  pending: 'bg-muted text-muted-foreground border-transparent',
  confirmed: 'bg-muted text-muted-foreground border-transparent',
  in_progress: 'bg-muted text-muted-foreground border-transparent',
  completed: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-muted text-muted-foreground border-transparent line-through',
  no_show: 'bg-destructive/10 text-destructive border-destructive/20',
}

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  )
}

export function OverbookingIndicator({ className }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'text-warning inline-flex shrink-0 items-center',
              className,
            )}
            aria-label="Sobreturno"
          >
            <AlertTriangle className="size-3.5" strokeWidth={1.75} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Sobreturno</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export type PaymentStatusKind = 'pending' | 'partial' | 'paid' | 'refunded'

const PAYMENT_LABELS: Record<PaymentStatusKind, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagado',
  refunded: 'Reembolsado',
}

const PAYMENT_STYLES: Record<PaymentStatusKind, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  partial: 'bg-accent/15 text-accent-foreground border-accent/20',
  paid: 'bg-success/10 text-success border-success/20',
  refunded: 'bg-muted text-muted-foreground border-transparent',
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatusKind | string
  className?: string
}) {
  const key = (status in PAYMENT_LABELS ? status : 'pending') as PaymentStatusKind
  return (
    <Badge variant="outline" className={cn(PAYMENT_STYLES[key], className)}>
      {PAYMENT_LABELS[key]}
    </Badge>
  )
}
