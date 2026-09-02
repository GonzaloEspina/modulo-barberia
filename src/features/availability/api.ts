import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

export interface AvailableSlot {
  barber_id: string
  barber_name: string
  slot_start: string
  slot_end: string
  total_duration_minutes: number
}

export interface ScheduleGap {
  barber_id: string
  barber_name: string
  gap_start: string
  gap_end: string
  duration_minutes: number
}

export function useAvailableSlots(
  date: string,
  serviceIds: string[],
  barberId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ['available-slots', date, serviceIds, barberId ?? 'all'],
    enabled: enabled && !!date && serviceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_available_slots', {
        p_date: date,
        p_service_ids: serviceIds,
        p_barber_id: barberId ?? null,
      })
      if (error) throw error
      return (data ?? []) as AvailableSlot[]
    },
  })
}

export function useScheduleGaps(
  date: string,
  barberId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ['schedule-gaps', date, barberId ?? 'all'],
    enabled: enabled && !!date,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_schedule_gaps', {
        p_date: date,
        p_barber_id: barberId ?? null,
      })
      if (error) throw error
      return (data ?? []) as ScheduleGap[]
    },
  })
}

/** Unifica horarios por hora de inicio (útil cuando hay varios barberos). */
export function dedupeSlotsByStart(slots: AvailableSlot[]): AvailableSlot[] {
  const seen = new Set<string>()
  return slots.filter((slot) => {
    if (seen.has(slot.slot_start)) return false
    seen.add(slot.slot_start)
    return true
  })
}
