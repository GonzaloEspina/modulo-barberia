import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type { GeneralSchedule, ScheduleBlockInput } from '@/types/schedule'

const COLUMNS = 'id, organization_id, day_of_week, start_time, end_time, is_active'

export function useGeneralSchedules() {
  return useQuery({
    queryKey: ['general-schedules'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('general_schedules')
        .select(COLUMNS)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time')
      if (error) throw error
      return (data ?? []) as GeneralSchedule[]
    },
  })
}

export function useGeneralScheduleMutations(organizationId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['general-schedules'] })

  const saveDay = useMutation({
    mutationFn: async ({
      dayOfWeek,
      blocks,
    }: {
      dayOfWeek: number
      blocks: ScheduleBlockInput[]
    }) => {
      if (!organizationId) throw new Error('Organización no disponible')

      const { error: deleteError } = await getSupabaseClient()
        .from('general_schedules')
        .delete()
        .eq('organization_id', organizationId)
        .eq('day_of_week', dayOfWeek)
      if (deleteError) throw deleteError

      if (blocks.length === 0) return

      const rows = blocks.map((block) => ({
        organization_id: organizationId,
        day_of_week: dayOfWeek,
        start_time: block.start_time,
        end_time: block.end_time,
        is_active: true,
      }))

      const { error: insertError } = await getSupabaseClient().from('general_schedules').insert(rows)
      if (insertError) throw insertError
    },
    onSuccess: invalidate,
  })

  return { saveDay }
}
