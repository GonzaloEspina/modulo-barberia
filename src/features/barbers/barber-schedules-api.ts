import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type { BarberSchedule, ScheduleBlockInput } from '@/types/schedule'

const COLUMNS =
  'id, organization_id, barber_id, day_of_week, start_time, end_time, is_working_day, is_active'

export type BarberDayMode = 'general' | 'custom' | 'closed'

export interface BarberDayScheduleInput {
  dayOfWeek: number
  mode: BarberDayMode
  blocks: ScheduleBlockInput[]
}

export function useBarberSchedules(barberId: string | undefined) {
  return useQuery({
    queryKey: ['barber-schedules', barberId],
    enabled: !!barberId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('barber_schedules')
        .select(COLUMNS)
        .eq('barber_id', barberId!)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time')
      if (error) throw error
      return (data ?? []) as BarberSchedule[]
    },
  })
}

export function useBarberScheduleMutations(barberId: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['barber-schedules', barberId] })

  const saveDay = useMutation({
    mutationFn: async (input: BarberDayScheduleInput) => {
      if (!barberId) throw new Error('Barbero no disponible')

      const { error: deleteError } = await getSupabaseClient()
        .from('barber_schedules')
        .delete()
        .eq('barber_id', barberId)
        .eq('day_of_week', input.dayOfWeek)
      if (deleteError) throw deleteError

      if (input.mode === 'general') return

      if (input.mode === 'closed') {
        const { error } = await getSupabaseClient().from('barber_schedules').insert({
          barber_id: barberId,
          day_of_week: input.dayOfWeek,
          is_working_day: false,
          start_time: null,
          end_time: null,
          is_active: true,
        })
        if (error) throw error
        return
      }

      if (input.blocks.length === 0) {
        throw new Error('Agregá al menos un bloque horario')
      }

      const rows = input.blocks.map((block) => ({
        barber_id: barberId,
        day_of_week: input.dayOfWeek,
        start_time: block.start_time,
        end_time: block.end_time,
        is_working_day: true,
        is_active: true,
      }))

      const { error } = await getSupabaseClient().from('barber_schedules').insert(rows)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const clearDay = useMutation({
    mutationFn: async (dayOfWeek: number) => {
      if (!barberId) throw new Error('Barbero no disponible')
      const { error } = await getSupabaseClient()
        .from('barber_schedules')
        .delete()
        .eq('barber_id', barberId)
        .eq('day_of_week', dayOfWeek)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { saveDay, clearDay }
}

export function getBarberDayMode(
  dayOfWeek: number,
  schedules: BarberSchedule[],
  useGeneralSchedules: boolean,
): BarberDayMode {
  const dayRows = schedules.filter((s) => s.day_of_week === dayOfWeek)
  if (dayRows.length === 0) return useGeneralSchedules ? 'general' : 'closed'
  if (dayRows.some((s) => !s.is_working_day)) return 'closed'
  return 'custom'
}

export function getBarberDayBlocks(dayOfWeek: number, schedules: BarberSchedule[]): ScheduleBlockInput[] {
  return schedules
    .filter((s) => s.day_of_week === dayOfWeek && s.is_working_day && s.start_time && s.end_time)
    .map((s) => ({ start_time: s.start_time!, end_time: s.end_time! }))
}
