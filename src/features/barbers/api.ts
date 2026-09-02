import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type { BarberFormInput, BarberRecord, LinkableProfile } from '@/types/barber'

const BARBER_COLUMNS =
  'id, organization_id, user_id, name, photo_url, phone, email, calendar_color, use_general_schedules, use_general_services, use_general_prices, use_general_durations, display_order, is_active, deleted_at, created_at, updated_at'

export function useBarbers(includeInactive = false) {
  return useQuery({
    queryKey: ['barbers', includeInactive],
    queryFn: async () => {
      let query = getSupabaseClient()
        .from('barbers')
        .select(BARBER_COLUMNS)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

      if (!includeInactive) {
        query = query.is('deleted_at', null).eq('is_active', true)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as BarberRecord[]
    },
  })
}

export function useBarber(id: string | undefined) {
  return useQuery({
    queryKey: ['barbers', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('barbers')
        .select(BARBER_COLUMNS)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as BarberRecord | null
    },
  })
}

export function useLinkableProfiles(currentBarberId?: string) {
  return useQuery({
    queryKey: ['profiles', 'linkable-barbers', currentBarberId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('profiles')
        .select('id, full_name, barber_id, role')
        .eq('role', 'barber')
        .eq('is_active', true)

      if (error) throw error

      return (data ?? []).filter(
        (p) => !p.barber_id || p.barber_id === currentBarberId,
      ) as LinkableProfile[]
    },
  })
}

function toBarberPayload(input: BarberFormInput, organizationId: string) {
  return {
    organization_id: organizationId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    calendar_color: input.calendar_color,
    display_order: input.display_order,
    use_general_schedules: input.use_general_schedules,
    use_general_services: input.use_general_services,
    use_general_prices: input.use_general_prices,
    use_general_durations: input.use_general_durations,
    is_active: input.is_active,
  }
}

async function syncBarberProfileLink(barberId: string, linkedProfileId: string | null | undefined) {
  const supabase = getSupabaseClient()

  const { data: current } = await supabase
    .from('barbers')
    .select('user_id')
    .eq('id', barberId)
    .single()

  const previousUserId = current?.user_id as string | null

  if (previousUserId && previousUserId !== linkedProfileId) {
    await supabase.from('profiles').update({ barber_id: null }).eq('id', previousUserId)
  }

  if (!linkedProfileId) {
    await supabase.from('barbers').update({ user_id: null }).eq('id', barberId)
    return
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ barber_id: barberId })
    .eq('id', linkedProfileId)

  if (profileError) throw profileError

  const { error: barberError } = await supabase
    .from('barbers')
    .update({ user_id: linkedProfileId })
    .eq('id', barberId)

  if (barberError) throw barberError
}

export function useBarberMutations(organizationId: string | undefined) {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['barbers'] })
    void queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  const createBarber = useMutation({
    mutationFn: async (input: BarberFormInput) => {
      if (!organizationId) throw new Error('Organización no disponible')
      const { data, error } = await getSupabaseClient()
        .from('barbers')
        .insert(toBarberPayload(input, organizationId))
        .select(BARBER_COLUMNS)
        .single()
      if (error) throw error
      const barber = data as BarberRecord
      if (input.linked_profile_id) {
        await syncBarberProfileLink(barber.id, input.linked_profile_id)
      }
      return barber
    },
    onSuccess: invalidate,
  })

  const updateBarber = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: BarberFormInput }) => {
      if (!organizationId) throw new Error('Organización no disponible')
      const { data, error } = await getSupabaseClient()
        .from('barbers')
        .update(toBarberPayload(input, organizationId))
        .eq('id', id)
        .select(BARBER_COLUMNS)
        .single()
      if (error) throw error
      await syncBarberProfileLink(id, input.linked_profile_id)
      return data as BarberRecord
    },
    onSuccess: invalidate,
  })

  const softDeleteBarber = useMutation({
    mutationFn: async (id: string) => {
      const { data: barber } = await getSupabaseClient()
        .from('barbers')
        .select('user_id')
        .eq('id', id)
        .single()

      if (barber?.user_id) {
        await getSupabaseClient()
          .from('profiles')
          .update({ barber_id: null })
          .eq('id', barber.user_id)
      }

      const { error } = await getSupabaseClient()
        .from('barbers')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
          user_id: null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { createBarber, updateBarber, softDeleteBarber }
}
