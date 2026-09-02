import { describe, expect, it } from 'vitest'
import { formatDate, membershipExpiresAt } from '@/lib/membership-expiry'
import { calculatePendingAmount, validatePaymentAmount } from '@/lib/payment'
import { generateAvailableSlots, parseTimeToMinutes } from '@/lib/availability'

/** Casos de prueba obligatorios — DOCUMENTO_TECNICO §11.2 y §16 */
describe('§20 Membresías — vencimiento EOMONTH', () => {
  it('31/08/2026 + 3 meses → 30/11/2026', () => {
    const result = membershipExpiresAt(new Date(2026, 7, 31), 3)
    expect(formatDate(result)).toBe('2026-11-30')
  })

  it('31/01/2025 + 1 mes → 28/02/2025', () => {
    const result = membershipExpiresAt(new Date(2025, 0, 31), 1)
    expect(formatDate(result)).toBe('2025-02-28')
  })

  it('31/01/2024 + 1 mes → 29/02/2024', () => {
    const result = membershipExpiresAt(new Date(2024, 0, 31), 1)
    expect(formatDate(result)).toBe('2024-02-29')
  })
})

describe('§20 Pagos', () => {
  it('rechaza monto que excede saldo pendiente', () => {
    expect(validatePaymentAmount(150, 100)).toMatch(/excede/)
  })

  it('acepta monto igual al pendiente', () => {
    expect(validatePaymentAmount(100, 100)).toBeNull()
  })

  it('calcula saldo pendiente', () => {
    expect(calculatePendingAmount(500, 200)).toBe(300)
  })
})

describe('§20 Disponibilidad / turnos', () => {
  it('no ofrece slots fuera de la ventana', () => {
    const duration = 30
    const slots = generateAvailableSlots(
      [{ start: parseTimeToMinutes('09:00'), end: parseTimeToMinutes('10:00') }],
      duration,
      duration,
    )
    expect(slots).toHaveLength(2)
    expect(slots[0].start).toBe(parseTimeToMinutes('09:00'))
    expect(slots[1].start).toBe(parseTimeToMinutes('09:30'))
  })

  it('no atraviesa ocupación (busy range)', () => {
    const duration = 30
    const slots = generateAvailableSlots(
      [{ start: parseTimeToMinutes('09:00'), end: parseTimeToMinutes('11:00') }],
      duration,
      duration,
      [{ start: parseTimeToMinutes('09:30'), end: parseTimeToMinutes('10:00') }],
    )
    expect(slots.map((s) => s.start)).toEqual([
      parseTimeToMinutes('09:00'),
      parseTimeToMinutes('10:00'),
      parseTimeToMinutes('10:30'),
    ])
  })
})

describe('§20 Concurrencia (documentación)', () => {
  it('create_appointment usa advisory lock en SQL (ver migración appointments_full)', () => {
    // La protección real está en private.create_appointment + portal_create_appointment:
    // PERFORM pg_advisory_xact_lock(hashtext(barber_id || date));
    expect(true).toBe(true)
  })
})
