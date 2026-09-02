import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type {
  BarberServiceRecord,
  BarberServiceOverrideInput,
  ExclusiveServiceInput,
} from '@/types/service'

const BARBER_SERVICE_COLUMNS =
  'id, organization_id, barber_id, service_id, is_enabled, is_exclusive, exclusive_name, price_override, duration_override, points_override, exclusive_price, exclusive_duration, exclusive_points, created_at, updated_at'

function normalizeBarberService(row: Record<string, unknown>): BarberServiceRecord {
  return {
    ...(row as unknown as BarberServiceRecord),
    price_override: row.price_override != null ? Number(row.price_override) : null,
    exclusive_price: row.exclusive_price != null ? Number(row.exclusive_price) : null,
  }
}

export function useBarberServices(barberId: string | undefined) {
  return useQuery({
    queryKey: ['barber-services', barberId],
    enabled: !!barberId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('barber_services')
        .select(BARBER_SERVICE_COLUMNS)
        .eq('barber_id', barberId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map(normalizeBarberService)
    },
  })
}

export function useBarberServiceMutations(barberId: string | undefined, organizationId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['barber-services', barberId] })
  }

  const upsertOverride = useMutation({
    mutationFn: async (input: BarberServiceOverrideInput) => {
      if (!barberId || !organizationId) throw new Error('Barbero no disponible')

      const { data: existing, error: fetchError } = await getSupabaseClient()
        .from('barber_services')
        .select('id')
        .eq('barber_id', barberId)
        .eq('service_id', input.service_id)
        .maybeSingle()
      if (fetchError) throw fetchError

      const payload = {
        organization_id: organizationId,
        barber_id: barberId,
        service_id: input.service_id,
        is_exclusive: false,
        is_enabled: input.is_enabled,
        price_override: input.price_override,
        duration_override: input.duration_override,
        points_override: input.points_override,
        exclusive_name: null,
        exclusive_price: null,
        exclusive_duration: null,
        exclusive_points: null,
      }

      if (existing?.id) {
        const { error } = await getSupabaseClient()
          .from('barber_services')
          .update(payload)
          .eq('id', existing.id)
        if (error) throw error
        return
      }

      const { error } = await getSupabaseClient().from('barber_services').insert(payload)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const removeOverride = useMutation({
    mutationFn: async (serviceId: string) => {
      if (!barberId) throw new Error('Barbero no disponible')
      const { error } = await getSupabaseClient()
        .from('barber_services')
        .delete()
        .eq('barber_id', barberId)
        .eq('service_id', serviceId)
        .eq('is_exclusive', false)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const createExclusive = useMutation({
    mutationFn: async (input: ExclusiveServiceInput) => {
      if (!barberId || !organizationId) throw new Error('Barbero no disponible')
      const { error } = await getSupabaseClient().from('barber_services').insert({
        organization_id: organizationId,
        barber_id: barberId,
        service_id: null,
        is_exclusive: true,
        is_enabled: input.is_enabled,
        exclusive_name: input.exclusive_name.trim(),
        exclusive_price: input.exclusive_price,
        exclusive_duration: input.exclusive_duration,
        exclusive_points: input.exclusive_points,
      })
      if (error) {
        if (error.code === '23505') throw new Error('Ya existe un servicio exclusivo con ese nombre')
        throw error
      }
    },
    onSuccess: invalidate,
  })

  const updateExclusive = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ExclusiveServiceInput }) => {
      const { error } = await getSupabaseClient()
        .from('barber_services')
        .update({
          is_enabled: input.is_enabled,
          exclusive_name: input.exclusive_name.trim(),
          exclusive_price: input.exclusive_price,
          exclusive_duration: input.exclusive_duration,
          exclusive_points: input.exclusive_points,
        })
        .eq('id', id)
      if (error) {
        if (error.code === '23505') throw new Error('Ya existe un servicio exclusivo con ese nombre')
        throw error
      }
    },
    onSuccess: invalidate,
  })

  const deleteExclusive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient()
        .from('barber_services')
        .delete()
        .eq('id', id)
        .eq('is_exclusive', true)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return {
    upsertOverride,
    removeOverride,
    createExclusive,
    updateExclusive,
    deleteExclusive,
  }
}
