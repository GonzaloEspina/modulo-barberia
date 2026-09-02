import { AlertTriangle, Check, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getClientFullName, type Client } from '@/types/client'
import { cn } from '@/lib/utils'

interface ClientComboboxProps {
  clients: Client[]
  value: string
  onChange: (clientId: string) => void
  placeholder?: string
}

function ClientWarningIcon({ reason }: { reason: string | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={reason ?? 'Advertencia del cliente'}
          className="text-warning inline-flex shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        {reason?.trim() || 'Advertencia manual del cliente'}
      </TooltipContent>
    </Tooltip>
  )
}

export function ClientCombobox({
  clients,
  value,
  onChange,
  placeholder = 'Buscar cliente…',
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = clients.find((c) => c.id === value)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clients
    return clients.filter((c) => {
      const name = getClientFullName(c).toLowerCase()
      const phone = (c.phone_display ?? c.phone_normalized).toLowerCase()
      const nickname = (c.nickname ?? '').toLowerCase()
      return name.includes(term) || phone.includes(term) || nickname.includes(term)
    })
  }, [clients, search])

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-11 w-full justify-start gap-2 rounded-lg px-3 font-normal"
          >
            <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
            {selected ? (
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
                <span className="truncate">
                  {getClientFullName(selected)}
                  {selected.nickname ? ` (${selected.nickname})` : ''}
                  {' · '}
                  {selected.phone_display ?? selected.phone_normalized}
                </span>
                {selected.manual_warning && (
                  <ClientWarningIcon reason={selected.manual_warning_reason} />
                )}
              </span>
            ) : (
              <span className="text-muted-foreground flex-1 truncate text-left">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Nombre, apodo o teléfono…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {filtered.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.id}
                    className="group"
                    onSelect={() => {
                      onChange(client.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn('mr-2 size-4', value === client.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium">
                        <span className="truncate">{getClientFullName(client)}</span>
                        {client.nickname && (
                          <span className="text-muted-foreground truncate text-xs font-normal">
                            ({client.nickname})
                          </span>
                        )}
                        {client.manual_warning && (
                          <ClientWarningIcon reason={client.manual_warning_reason} />
                        )}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {client.phone_display ?? client.phone_normalized}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="sm" asChild>
        <Link to="/clientes/nuevo">
          <Plus className="size-4" />
          Nuevo cliente
        </Link>
      </Button>
    </div>
  )
}
