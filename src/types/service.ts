export interface Service {
  id: string
  organization_id: string
  name: string
  description: string | null
  price: number
  duration_minutes: number
  points_awarded: number
  display_order: number
  category_color: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ServiceFormInput {
  name: string
  description?: string
  price: number
  duration_minutes: number
  points_awarded: number
  display_order: number
  category_color?: string
  is_active: boolean
}

export interface BarberServiceRecord {
  id: string
  organization_id: string
  barber_id: string
  service_id: string | null
  is_enabled: boolean
  is_exclusive: boolean
  exclusive_name: string | null
  price_override: number | null
  duration_override: number | null
  points_override: number | null
  exclusive_price: number | null
  exclusive_duration: number | null
  exclusive_points: number | null
  created_at: string
  updated_at: string
}

export interface BarberServiceOverrideInput {
  service_id: string
  is_enabled: boolean
  price_override: number | null
  duration_override: number | null
  points_override: number | null
}

export interface ExclusiveServiceInput {
  exclusive_name: string
  exclusive_price: number
  exclusive_duration: number
  exclusive_points: number
  is_enabled: boolean
}

export interface EffectiveService {
  barber_service_id: string | null
  service_id: string | null
  name: string
  price: number
  duration_minutes: number
  points_awarded: number
  is_available: boolean
  is_exclusive: boolean
}

export const SERVICE_COLOR_PRESETS = [
  '#D97706',
  '#3B82F6',
  '#16A34A',
  '#7C3AED',
  '#EF4444',
  '#0891B2',
] as const

export function formatServicePrice(amount: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatServiceDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}
