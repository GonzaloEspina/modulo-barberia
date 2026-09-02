import { describe, expect, it } from 'vitest'
import { calculatePendingAmount, derivePaymentStatus, validatePaymentAmount } from '@/lib/payment'

describe('payment helpers', () => {
  it('calcula saldo pendiente', () => {
    expect(calculatePendingAmount(10000, 3000)).toBe(7000)
    expect(calculatePendingAmount(10000, 12000)).toBe(0)
  })

  it('rechaza pago que excede saldo', () => {
    expect(validatePaymentAmount(8000, 7000)).toMatch(/excede/)
    expect(validatePaymentAmount(7000, 7000)).toBeNull()
  })

  it('deriva estado de pago', () => {
    expect(derivePaymentStatus(0, 0)).toBe('paid')
    expect(derivePaymentStatus(100, 0)).toBe('pending')
    expect(derivePaymentStatus(100, 50)).toBe('partial')
    expect(derivePaymentStatus(100, 100)).toBe('paid')
  })
})
