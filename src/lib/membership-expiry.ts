/**
 * Réplica TS de private.membership_expires_at para tests §11.2
 */
export function membershipExpiresAt(startsAt: Date, validityMonths: number): Date {
  const base = new Date(startsAt)
  const target = new Date(base.getFullYear(), base.getMonth() + validityMonths, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const day = Math.min(base.getDate(), lastDay)
  return new Date(target.getFullYear(), target.getMonth(), day)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
