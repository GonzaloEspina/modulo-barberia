/**
 * Normaliza teléfonos argentinos para búsqueda y unicidad.
 * Resultado: solo dígitos con prefijo país 54 (ej. 5491112345678).
 */
export function normalizePhoneAr(input: string): string {
  let digits = input.replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('54') && digits.length >= 12) {
    return digits
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  // Formato local con 15: 11 15 1234 5678 → 5491112345678
  const mobile15 = digits.match(/^(\d{2,4})15(\d{6,8})$/)
  if (mobile15) {
    return `549${mobile15[1]}${mobile15[2]}`
  }

  if (digits.length === 10) {
    return `549${digits}`
  }

  if (digits.length === 11 && digits.startsWith('9')) {
    return `54${digits}`
  }

  if (digits.length >= 8 && digits.length <= 11 && !digits.startsWith('54')) {
    return `54${digits}`
  }

  return digits
}

export function formatPhoneDisplay(input: string): string {
  return input.trim() || ''
}

export function phoneSearchDigits(input: string): string {
  return input.replace(/\D/g, '')
}
