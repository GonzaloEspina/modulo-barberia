export interface BarberRecord {
  id: string
  organization_id: string
  user_id: string | null
  name: string
  photo_url: string | null
  phone: string | null
  email: string | null
  calendar_color: string
  use_general_schedules: boolean
  use_general_services: boolean
  use_general_prices: boolean
  use_general_durations: boolean
  display_order: number
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface BarberFormInput {
  name: string
  email?: string
  phone?: string
  calendar_color: string
  display_order: number
  use_general_schedules: boolean
  use_general_services: boolean
  use_general_prices: boolean
  use_general_durations: boolean
  is_active: boolean
  linked_profile_id?: string | null
}

export interface LinkableProfile {
  id: string
  full_name: string | null
  barber_id: string | null
}

export const BARBER_COLOR_PRESETS = [
  '#D97706',
  '#3B82F6',
  '#16A34A',
  '#7C3AED',
  '#EF4444',
  '#0891B2',
  '#1A1A2E',
] as const
