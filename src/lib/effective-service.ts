import type { BarberRecord } from '@/types/barber'
import type { BarberServiceRecord, EffectiveService, Service } from '@/types/service'

export interface ResolveEffectiveServiceInput {
  barber: Pick<
    BarberRecord,
    'use_general_services' | 'use_general_prices' | 'use_general_durations'
  >
  service: Pick<Service, 'id' | 'name' | 'price' | 'duration_minutes' | 'points_awarded'>
  override?: Pick<
    BarberServiceRecord,
    | 'id'
    | 'is_enabled'
    | 'is_exclusive'
    | 'price_override'
    | 'duration_override'
    | 'points_override'
  > | null
}

export function resolveEffectiveGeneralService(
  input: ResolveEffectiveServiceInput,
): EffectiveService {
  const { barber, service, override } = input

  if (override && override.is_enabled === false) {
    return unavailableGeneral(service, override.id)
  }

  if (!override && !barber.use_general_services) {
    return unavailableGeneral(service, null)
  }

  const price = barber.use_general_prices
    ? (override?.price_override ?? service.price)
    : (override?.price_override ?? service.price)

  const duration_minutes = barber.use_general_durations
    ? (override?.duration_override ?? service.duration_minutes)
    : (override?.duration_override ?? service.duration_minutes)

  const points_awarded = override?.points_override ?? service.points_awarded

  return {
    barber_service_id: override?.id ?? null,
    service_id: service.id,
    name: service.name,
    price,
    duration_minutes,
    points_awarded,
    is_available: true,
    is_exclusive: false,
  }
}

export function resolveExclusiveService(record: BarberServiceRecord): EffectiveService | null {
  if (!record.is_exclusive || !record.exclusive_name) return null
  if (!record.is_enabled) {
    return {
      barber_service_id: record.id,
      service_id: null,
      name: record.exclusive_name,
      price: record.exclusive_price ?? 0,
      duration_minutes: record.exclusive_duration ?? 0,
      points_awarded: record.exclusive_points ?? 0,
      is_available: false,
      is_exclusive: true,
    }
  }

  return {
    barber_service_id: record.id,
    service_id: null,
    name: record.exclusive_name,
    price: record.exclusive_price ?? 0,
    duration_minutes: record.exclusive_duration ?? 0,
    points_awarded: record.exclusive_points ?? 0,
    is_available: true,
    is_exclusive: true,
  }
}

function unavailableGeneral(
  service: Pick<Service, 'id' | 'name'>,
  barberServiceId: string | null,
): EffectiveService {
  return {
    barber_service_id: barberServiceId,
    service_id: service.id,
    name: service.name,
    price: 0,
    duration_minutes: 0,
    points_awarded: 0,
    is_available: false,
    is_exclusive: false,
  }
}
