export type ClientBookingOverride = 'inherit' | 'allowed' | 'denied'

export interface Client {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  phone_normalized: string
  phone_display: string | null
  nickname: string | null
  email: string | null
  birth_date: string | null
  notes: string | null
  manual_warning: boolean
  manual_warning_reason: string | null
  booking_override: ClientBookingOverride
  registered_at: string
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ClientFormInput {
  first_name: string
  last_name?: string
  phone: string
  nickname?: string
  email?: string
  birth_date?: string
  notes?: string
  manual_warning: boolean
  manual_warning_reason?: string
  booking_override: ClientBookingOverride
}

export function getBookingOverrideOptions(
  portalMode: 'all_except_denied' | 'allowlist_only' | 'disabled',
): { value: ClientBookingOverride; label: string }[] {
  if (portalMode === 'disabled') {
    return []
  }
  if (portalMode === 'all_except_denied') {
    return [
      { value: 'inherit', label: 'Puede reservar (predeterminado)' },
      { value: 'denied', label: 'No, bloquear reservas' },
    ]
  }
  return [
    { value: 'inherit', label: 'No puede reservar (predeterminado)' },
    { value: 'allowed', label: 'Sí, autorizar reservas' },
  ]
}

export function getBookingOverrideBadge(
  override: ClientBookingOverride,
  portalMode: 'all_except_denied' | 'allowlist_only' | 'disabled',
): string | null {
  if (portalMode === 'all_except_denied' && override === 'denied') return 'Reserva bloqueada'
  if (portalMode === 'allowlist_only' && override === 'allowed') return 'Reserva autorizada'
  if (portalMode === 'allowlist_only' && override === 'inherit') return 'Sin autorizar'
  return null
}

export function getClientFullName(
  client: Pick<Client, 'first_name'> & { last_name?: string | null },
): string {
  return [client.first_name, client.last_name]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

export function getClientInitials(
  client: Pick<Client, 'first_name'> & { last_name?: string | null },
): string {
  const first = client.first_name.trim().charAt(0)
  const last = client.last_name?.trim().charAt(0) ?? ''
  return `${first}${last}`.toUpperCase() || '?'
}

export function groupClientsByInitial(clients: Client[]): { initial: string; clients: Client[] }[] {
  const sorted = [...clients].sort((a, b) =>
    getClientFullName(a).localeCompare(getClientFullName(b), 'es', { sensitivity: 'base' }),
  )

  const groups = new Map<string, Client[]>()
  for (const client of sorted) {
    const initial = getClientFullName(client).charAt(0).toUpperCase() || '#'
    const bucket = groups.get(initial) ?? []
    bucket.push(client)
    groups.set(initial, bucket)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([initial, groupClients]) => ({ initial, clients: groupClients }))
}
