import { describe, expect, it } from 'vitest'
import {
  canShowPortalBooking,
  getPortalBookingUnavailableMessage,
} from '@/lib/portal-booking-policy'

describe('portal booking policy', () => {
  it('blocks booking when portal is disabled', () => {
    expect(canShowPortalBooking(false, 'disabled', 'inherit')).toBe(false)
    expect(getPortalBookingUnavailableMessage('disabled', 'inherit')).toMatch(/no permite reservas/)
  })

  it('requires allowlist authorization', () => {
    expect(canShowPortalBooking(false, 'allowlist_only', 'inherit')).toBe(false)
    expect(canShowPortalBooking(true, 'allowlist_only', 'allowed')).toBe(true)
    expect(getPortalBookingUnavailableMessage('allowlist_only', 'inherit')).toMatch(/habilitada/)
  })

  it('blocks denied clients in all_except_denied mode', () => {
    expect(canShowPortalBooking(false, 'all_except_denied', 'denied')).toBe(false)
    expect(canShowPortalBooking(true, 'all_except_denied', 'inherit')).toBe(true)
    expect(getPortalBookingUnavailableMessage('all_except_denied', 'denied')).toMatch(/no puede reservar/)
  })
})
