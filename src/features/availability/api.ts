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

/** True si los inicios seleccionados forman un bloque continuo al unir [start, end). */
export function areSelectedSlotsContiguous(
  slots: AvailableSlot[],
  selectedStarts: string[],
): boolean {
  if (selectedStarts.length <= 1) return true
  const selected = slots
    .filter((s) => selectedStarts.includes(s.slot_start))
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start))
  if (selected.length !== selectedStarts.length) return false

  let coverEnd = new Date(selected[0].slot_end).getTime()
  for (let i = 1; i < selected.length; i++) {
    const start = new Date(selected[i].slot_start).getTime()
    if (start > coverEnd) return false
    coverEnd = Math.max(coverEnd, new Date(selected[i].slot_end).getTime())
  }
  return true
}

export function resolveSelectedSlotBlock(
  slots: AvailableSlot[],
  selectedStarts: string[],
): { starts_at: string; ends_at: string; durationMinutes: number } | null {
  if (selectedStarts.length === 0) return null
  const selected = slots
    .filter((s) => selectedStarts.includes(s.slot_start))
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start))
  if (selected.length !== selectedStarts.length) return null

  const starts_at = selected[0].slot_start
  const ends_at = selected[selected.length - 1].slot_end
  const durationMinutes = Math.max(
    1,
    Math.round((new Date(ends_at).getTime() - new Date(starts_at).getTime()) / 60_000),
  )
  return { starts_at, ends_at, durationMinutes }
}
