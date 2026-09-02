import type { ClientBookingOverride } from '@/types/client'
import type { PortalBookingMode } from '@/types/database'

export function getPortalBookingUnavailableMessage(
  portalMode: PortalBookingMode,
  bookingOverride: ClientBookingOverride,
): string {
  if (portalMode === 'disabled') {
    return 'La barbería no permite reservas online. Contactá al local para coordinar tu turno.'
  }
  if (portalMode === 'allowlist_only' && bookingOverride !== 'allowed') {
    return 'Tu cuenta no está habilitada para reservar online. Pedí autorización en el local.'
  }
  if (portalMode === 'all_except_denied' && bookingOverride === 'denied') {
    return 'Tu cuenta no puede reservar turnos online. Contactá al local.'
  }
  return 'La reserva online no está disponible para tu perfil. Contactá al local.'
}

export function canShowPortalBooking(
  canBook: boolean,
  portalMode: PortalBookingMode,
  bookingOverride: ClientBookingOverride,
): boolean {
  if (!canBook) return false
  if (portalMode === 'disabled') return false
  if (portalMode === 'allowlist_only' && bookingOverride !== 'allowed') return false
  if (portalMode === 'all_except_denied' && bookingOverride === 'denied') return false
  return true
}
