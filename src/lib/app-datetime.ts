import { formatInTimeZone } from 'date-fns-tz'
import { APP_TIMEZONE } from '@/lib/constants'

/** Fecha local de la app (yyyy-MM-dd). */
export function appToday(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
}

/** Día ISO 1=lunes … 7=domingo en la zona de la app. */
export function appIsoDayOfWeek(dateYmd: string): number {
  const asUtcNoon = new Date(`${dateYmd}T12:00:00Z`)
  const weekday = formatInTimeZone(asUtcNoon, APP_TIMEZONE, 'i')
  return Number(weekday)
}

export function isAppPastDate(dateYmd: string): boolean {
  return dateYmd < appToday()
}

export function isAppPastInstant(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

/** Si la fecha es pasada, la reemplaza por hoy. */
export function clampAppDate(dateYmd: string): string {
  return isAppPastDate(dateYmd) ? appToday() : dateYmd
}
