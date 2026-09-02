export type ScheduleExceptionType = 'block' | 'allow'
export type ScheduleExceptionScope = 'organization' | 'barber'

export interface GeneralSchedule {
  id: string
  organization_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface BarberSchedule {
  id: string
  organization_id: string
  barber_id: string
  day_of_week: number
  start_time: string | null
  end_time: string | null
  is_working_day: boolean
  is_active: boolean
}

export interface ScheduleException {
  id: string
  organization_id: string
  barber_id: string | null
  exception_type: ScheduleExceptionType
  scope: ScheduleExceptionScope
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  reason: string | null
  is_active: boolean
}

export interface ScheduleBlockInput {
  start_time: string
  end_time: string
}

export interface ScheduleExceptionInput {
  exception_type: ScheduleExceptionType
  scope: ScheduleExceptionScope
  barber_id?: string | null
  start_date: string
  end_date: string
  start_time?: string | null
  end_time?: string | null
  reason?: string
  is_active: boolean
}

export const ISO_DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
] as const

export function getDayLabel(dayOfWeek: number): string {
  return ISO_DAYS.find((d) => d.value === dayOfWeek)?.label ?? `Día ${dayOfWeek}`
}

export function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`
}
