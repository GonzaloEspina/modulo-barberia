import { describe, expect, it } from 'vitest'
import { resolveEffectiveGeneralService, resolveExclusiveService } from '@/lib/effective-service'
import type { BarberServiceRecord } from '@/types/service'

const barberDefaults = {
  use_general_services: true,
  use_general_prices: true,
  use_general_durations: true,
}

const corte = {
  id: 'svc-1',
  name: 'Corte clásico',
  price: 15000,
  duration_minutes: 30,
  points_awarded: 10,
}

describe('resolveEffectiveGeneralService', () => {
  it('hereda valores generales sin override', () => {
    const result = resolveEffectiveGeneralService({
      barber: barberDefaults,
      service: corte,
    })

    expect(result).toMatchObject({
      price: 15000,
      duration_minutes: 30,
      points_awarded: 10,
      is_available: true,
    })
  })

  it('aplica override de precio', () => {
    const result = resolveEffectiveGeneralService({
      barber: barberDefaults,
      service: corte,
      override: {
        id: 'bs-1',
        is_enabled: true,
        is_exclusive: false,
        price_override: 18000,
        duration_override: null,
        points_override: null,
      },
    })

    expect(result.price).toBe(18000)
    expect(result.duration_minutes).toBe(30)
  })

  it('marca no disponible si override deshabilitado', () => {
    const result = resolveEffectiveGeneralService({
      barber: barberDefaults,
      service: corte,
      override: {
        id: 'bs-1',
        is_enabled: false,
        is_exclusive: false,
        price_override: null,
        duration_override: null,
        points_override: null,
      },
    })

    expect(result.is_available).toBe(false)
  })

  it('no ofrece servicios generales si barbero no usa catálogo general', () => {
    const result = resolveEffectiveGeneralService({
      barber: { ...barberDefaults, use_general_services: false },
      service: corte,
    })

    expect(result.is_available).toBe(false)
  })
})

describe('resolveExclusiveService', () => {
  it('resuelve servicio exclusivo habilitado', () => {
    const record = {
      id: 'ex-1',
      is_exclusive: true,
      is_enabled: true,
      exclusive_name: 'Tratamiento premium',
      exclusive_price: 25000,
      exclusive_duration: 60,
      exclusive_points: 20,
    } as BarberServiceRecord

    const result = resolveExclusiveService(record)

    expect(result).toMatchObject({
      name: 'Tratamiento premium',
      price: 25000,
      duration_minutes: 60,
      points_awarded: 20,
      is_available: true,
      is_exclusive: true,
    })
  })
})
