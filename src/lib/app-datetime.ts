import { formatInTimeZone } from 'date-fns-tz'
import { APP_TIMEZONE } from '@/lib/constants'

export const APP_DATE_FORMAT = 'dd/MM/yyyy'
export const APP_DATETIME_FORMAT = 'dd/MM/yyyy HH:mm'

/** Fecha local de la app (yyyy-MM-dd). */
export function appToday(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
}

function asInstant(value: string | Date): Date | string {
  if (value instanceof Date) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00`
  return value
}

/** Fecha visible en el sistema: DD/MM/AAAA. */
export function formatAppDate(value: string | Date): string {
  return formatInTimeZone(asInstant(value), APP_TIMEZONE, APP_DATE_FORMAT)
}

/** Fecha y hora visibles: DD/MM/AAAA HH:mm. */
export function formatAppDateTime(value: string | Date): string {
  return formatInTimeZone(value instanceof Date ? value : new Date(value), APP_TIMEZONE, APP_DATETIME_FORMAT)
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
