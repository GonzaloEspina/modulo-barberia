import { describe, expect, it } from 'vitest'
import { normalizePhoneAr, phoneSearchDigits } from '@/lib/phone'

describe('normalizePhoneAr', () => {
  it('normaliza celular con 15 y espacios', () => {
    expect(normalizePhoneAr('11 15 1234 5678')).toBe('5491112345678')
  })

  it('normaliza sin prefijo país', () => {
    expect(normalizePhoneAr('011 1234-5678')).toBe('5491112345678')
    expect(normalizePhoneAr('11 2345-6789')).toBe('5491123456789')
  })

  it('mantiene número ya con 54', () => {
    expect(normalizePhoneAr('+54 9 11 1234-5678')).toBe('5491112345678')
  })

  it('retorna vacío para entrada vacía', () => {
    expect(normalizePhoneAr('')).toBe('')
    expect(normalizePhoneAr('   ')).toBe('')
  })
})

describe('phoneSearchDigits', () => {
  it('extrae solo dígitos para búsqueda', () => {
    expect(phoneSearchDigits('11-1234')).toBe('111234')
  })
})
