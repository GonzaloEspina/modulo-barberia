import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import { formatPhoneDisplay, normalizePhoneAr, phoneSearchDigits } from '@/lib/phone'
import type { Client, ClientFormInput } from '@/types/client'

const CLIENT_COLUMNS =
  'id, organization_id, first_name, last_name, phone_normalized, phone_display, nickname, email, birth_date, notes, manual_warning, manual_warning_reason, booking_override, registered_at, is_active, deleted_at, created_at, updated_at'

export const CLIENT_PAGE_SIZES = [25, 50] as const
export type ClientPageSize = (typeof CLIENT_PAGE_SIZES)[number]
export type ClientSort = 'name' | 'next_appointment' | 'last_activity'

export interface ClientsPageOptions {
  search?: string
  page: number
  pageSize: ClientPageSize
  sort: ClientSort
  warningOnly?: boolean
  hasUpcomingAppointment?: boolean
}

export interface ClientsPageResult {
  clients: Client[]
  total: number
}

function applyClientSearch<T extends { or: (filters: string) => T }>(
  query: T,
  search: string,
): T {
  const term = search.trim()
  if (!term) return query

  const digits = phoneSearchDigits(term)
  if (digits.length >= 3) {
    return query.or(
      `phone_normalized.ilike.%${digits}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,nickname.ilike.%${term}%`,
    )
  }

  return query.or(
    `first_name.ilike.%${term}%,last_name.ilike.%${term}%,nickname.ilike.%${term}%`,
  )
}

function needsClientsRpc(options: ClientsPageOptions): boolean {
  return options.sort !== 'name' || options.hasUpcomingAppointment === true
}

async function fetchClientsPage(options: ClientsPageOptions): Promise<ClientsPageResult> {
  const {
    search = '',
    page,
    pageSize,
    sort,
    warningOnly = false,
    hasUpcomingAppointment = false,
  } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  if (needsClientsRpc(options)) {
    const { data, error } = await getSupabaseClient().rpc('list_clients_page', {
      p_search: search.trim(),
      p_offset: from,
      p_limit: pageSize,
      p_sort: sort,
      p_warning_only: warningOnly,
      p_has_upcoming: hasUpcomingAppointment,
    })
    if (error) throw error

    const result = (data ?? { total: 0, clients: [] }) as ClientsPageResult
    return {
      clients: result.clients ?? [],
      total: result.total ?? 0,
    }
  }

  let query = getSupabaseClient()
    .from('clients')
    .select(CLIENT_COLUMNS, { count: 'exact' })
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true })
    .range(from, to)

  query = applyClientSearch(query, search)
  if (warningOnly) query = query.eq('manual_warning', true)

  const { data, error, count } = await query
  if (error) throw error

  return {
    clients: (data ?? []) as Client[],
    total: count ?? 0,
  }
}

async function fetchAllClients(search: string): Promise<Client[]> {
  let query = getSupabaseClient()
    .from('clients')
    .select(CLIENT_COLUMNS)
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true })

  query = applyClientSearch(query, search)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Client[]
}

export function useClients(search: string) {
  return useQuery({
    queryKey: ['clients', search],
    queryFn: () => fetchAllClients(search),
  })
}

export function useClientsPage(options: ClientsPageOptions) {
  return useQuery({
    queryKey: ['clients', 'page', options],
    queryFn: () => fetchClientsPage(options),
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('clients')
        .select(CLIENT_COLUMNS)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as Client | null
    },
  })
}

function toDbPayload(input: ClientFormInput, organizationId: string) {
  const phone_normalized = normalizePhoneAr(input.phone)
  if (!phone_normalized) {
    throw new Error('Ingresá un teléfono válido')
  }

  return {
    organization_id: organizationId,
    first_name: input.first_name.trim(),
    last_name: input.last_name?.trim() ?? '',
    phone_normalized,
    phone_display: formatPhoneDisplay(input.phone),
    nickname: input.nickname?.trim() || null,
    email: input.email?.trim() || null,
    birth_date: input.birth_date || null,
    notes: input.notes?.trim() || null,
    manual_warning: input.manual_warning,
    manual_warning_reason: input.manual_warning ? input.manual_warning_reason?.trim() || null : null,
    booking_override: input.booking_override,
  }
}

export function useClientMutations(organizationId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['clients'] })

  const createClient = useMutation({
    mutationFn: async (input: ClientFormInput) => {
      if (!organizationId) throw new Error('Organización no disponible')
      const { data, error } = await getSupabaseClient()
        .from('clients')
        .insert(toDbPayload(input, organizationId))
        .select(CLIENT_COLUMNS)
        .single()
      if (error) {
        if (error.code === '23505') throw new Error('Ya existe un cliente con ese teléfono')
        throw error
      }
      return data as Client
    },
    onSuccess: invalidate,
  })

  const updateClient = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ClientFormInput }) => {
      if (!organizationId) throw new Error('Organización no disponible')
      const { data, error } = await getSupabaseClient()
        .from('clients')
        .update(toDbPayload(input, organizationId))
        .eq('id', id)
        .select(CLIENT_COLUMNS)
        .single()
      if (error) {
        if (error.code === '23505') throw new Error('Ya existe un cliente con ese teléfono')
        throw error
      }
      return data as Client
    },
    onSuccess: invalidate,
  })

  const softDeleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient()
        .from('clients')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { createClient, updateClient, softDeleteClient }
}
