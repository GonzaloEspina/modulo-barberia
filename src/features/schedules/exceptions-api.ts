import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type { ScheduleException, ScheduleExceptionInput } from '@/types/schedule'

const COLUMNS =
  'id, organization_id, barber_id, exception_type, scope, start_date, end_date, start_time, end_time, reason, is_active'

export function useScheduleExceptions() {
  return useQuery({
    queryKey: ['schedule-exceptions'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('schedule_exceptions')
        .select(COLUMNS)
        .order('start_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as ScheduleException[]
    },
  })
}

function toDbPayload(input: ScheduleExceptionInput, organizationId: string) {
  const fullDay = !input.start_time && !input.end_time

  return {
    organization_id: organizationId,
    barber_id: input.scope === 'barber' ? input.barber_id ?? null : null,
    exception_type: input.exception_type,
    scope: input.scope,
    start_date: input.start_date,
    end_date: input.end_date,
    start_time: fullDay ? null : input.start_time ?? null,
    end_time: fullDay ? null : input.end_time ?? null,
    reason: input.reason?.trim() || null,
    is_active: input.is_active,
  }
}

export function useScheduleExceptionMutations(organizationId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['schedule-exceptions'] })

  const createException = useMutation({
    mutationFn: async (input: ScheduleExceptionInput) => {
      if (!organizationId) throw new Error('Organización no disponible')
      const { error } = await getSupabaseClient()
        .from('schedule_exceptions')
        .insert(toDbPayload(input, organizationId))
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const updateException = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ScheduleExceptionInput }) => {
      if (!organizationId) throw new Error('Organización no disponible')
      const { error } = await getSupabaseClient()
        .from('schedule_exceptions')
        .update(toDbPayload(input, organizationId))
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const deleteException = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient().from('schedule_exceptions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { createException, updateException, deleteException }
}
