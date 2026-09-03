import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type { Service, ServiceFormInput } from '@/types/service'

const SERVICE_COLUMNS =
  'id, organization_id, name, description, price, duration_minutes, points_awarded, display_order, category_color, is_active, visible_on_portal, deleted_at, created_at, updated_at'

export function useServices(search: string, showInactive = false) {
  return useQuery({
    queryKey: ['services', search, showInactive],
    queryFn: async () => {
      let query = getSupabaseClient()
        .from('services')
        .select(SERVICE_COLUMNS)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

      if (!showInactive) {
        query = query.eq('is_active', true)
      }

      const term = search.trim()
      if (term) {
        query = query.ilike('name', `%${term}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map(normalizeService)
    },
  })
}

export function useService(id: string | undefined) {
  return useQuery({
    queryKey: ['services', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('services')
        .select(SERVICE_COLUMNS)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data ? normalizeService(data) : null
    },
  })
}

function normalizeService(row: Record<string, unknown>): Service {
  return {
    ...(row as unknown as Service),
    price: Number(row.price),
    visible_on_portal: row.visible_on_portal !== false,
  }
}

function toDbPayload(input: ServiceFormInput, organizationId: string) {
  return {
    organization_id: organizationId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    price: input.price,
    duration_minutes: input.duration_minutes,
    points_awarded: input.points_awarded,
    display_order: input.display_order,
    category_color: input.category_color?.trim() || null,
    is_active: input.is_active,
    visible_on_portal: input.visible_on_portal,
  }
}

export function useServiceMutations(organizationId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['services'] })

  const createService = useMutation({
    mutationFn: async (input: ServiceFormInput) => {
      if (!organizationId) throw new Error('Organización no disponible')
      const { data, error } = await getSupabaseClient()
        .from('services')
        .insert(toDbPayload(input, organizationId))
        .select(SERVICE_COLUMNS)
        .single()
      if (error) {
        if (error.code === '23505') throw new Error('Ya existe un servicio con ese nombre')
        throw error
      }
      return normalizeService(data)
    },
    onSuccess: invalidate,
  })

  const updateService = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ServiceFormInput }) => {
      if (!organizationId) throw new Error('Organización no disponible')
      const { data, error } = await getSupabaseClient()
        .from('services')
        .update(toDbPayload(input, organizationId))
        .eq('id', id)
        .select(SERVICE_COLUMNS)
        .single()
      if (error) {
        if (error.code === '23505') throw new Error('Ya existe un servicio con ese nombre')
        throw error
      }
      return normalizeService(data)
    },
    onSuccess: invalidate,
  })

  const softDeleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient()
        .from('services')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { createService, updateService, softDeleteService }
}
