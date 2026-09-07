import { Link } from 'react-router-dom'
import { MoreHorizontal, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getClientFullName, type Client } from '@/types/client'
import { cn } from '@/lib/utils'

interface ClientCardProps {
  client: Client
  points?: number
  nextAppointment?: string
  className?: string
  onOpen?: () => void
}

export function ClientCard({ client, points, nextAppointment, className, onOpen }: ClientCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div>
            <p className="font-medium">{getClientFullName(client)}</p>
            {client.nickname && (
              <p className="text-muted-foreground text-sm">&ldquo;{client.nickname}&rdquo;</p>
            )}
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Phone className="size-3.5 shrink-0" />
              {client.phone_display ?? client.phone_normalized}
            </p>
            {client.email && (
              <p className="text-muted-foreground truncate text-sm">{client.email}</p>
            )}
          </div>
          {typeof points === 'number' && (
            <p className="text-sm">
              <span className="font-medium">{points}</span>
              <span className="text-muted-foreground"> puntos</span>
            </p>
          )}
          {nextAppointment && (
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Próximo turno</p>
              <p>{nextAppointment}</p>
            </div>
          )}
        </div>
        {onOpen ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Acciones del cliente"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/turnos/nuevo?client=${client.id}`} onClick={(e) => e.stopPropagation()}>
                  Nuevo turno
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Acciones del cliente">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/clientes/${client.id}`}>Ver ficha</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/turnos/nuevo?client=${client.id}`}>Nuevo turno</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  )

  if (onOpen) {
    return (
      <article
        role="button"
        tabIndex={0}
        className={cn(
          'hover-surface group listing-sheet rounded-sm p-4 cursor-pointer',
          className,
        )}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
      >
        {content}
      </article>
    )
  }

  return (
    <article className={cn('listing-sheet rounded-sm p-4', className)}>
      {content}
    </article>
  )
}

interface BarberCardProps {
  id: string
  name: string
  color: string
  selected: boolean
  subtitle?: string
  onSelect: (id: string) => void
}

export function BarberCard({
  id,
  name,
  color,
  selected,
  subtitle,
  onSelect,
}: BarberCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        'flex w-full items-center gap-3 rounded-sm border bg-card p-4 text-left transition-colors duration-150',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'hover-surface hover:border-foreground/15',
      )}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-sm text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <p className="font-medium">{name}</p>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
    </button>
  )
}
