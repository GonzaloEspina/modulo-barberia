import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { formatInTimeZone } from 'date-fns-tz'
import { AlertTriangle, ListFilter, Minus, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useAppointmentMutations, useAppointments } from '@/features/appointments/api'
import { useBarbers } from '@/features/barbers/api'
import { useGeneralSchedules } from '@/features/schedules/api'
import { useIsMobile } from '@/hooks/use-mobile'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { APP_TIMEZONE } from '@/lib/constants'
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_OPTIONS,
  visibleAppointmentStatus,
  type Appointment,
  type AppointmentStatus,
  type VisibleAppointmentStatus,
} from '@/types/appointment'
import { getClientFullName } from '@/types/client'

import './calendar.css'

const filterOptionClass =
  'hover:bg-muted/60 flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 text-xs'

const MIN_ZOOM = 1
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.25
/** Alto mínimo compacto: nombre + horario con padding vertical simétrico. */
const CONTENT_SLOT_FLOOR_PX = 48
const ZOOM_STORAGE_KEY = 'calendar-zoom'
const DEFAULT_SLOT_MIN_TIME = '10:00:00'
const DEFAULT_SLOT_MAX_TIME = '20:00:00'

function clampZoom(value: number) {
  const stepped = Math.round(value / ZOOM_STEP) * ZOOM_STEP
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(stepped.toFixed(2))))
}

function formatSlotTime(value: string | null) {
  if (!value) return null
  const [hours, minutes] = value.split(':')
  if (!hours || !minutes) return null
  return `${hours}:${minutes}`
}

/** Normaliza "HH:mm" / "HH:mm:ss" / timestamptz time a "HH:mm:ss" para FullCalendar. */
function toFullCalendarTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const hours = match[1].padStart(2, '0')
  const minutes = match[2]
  const seconds = match[3] ?? '00'
  return `${hours}:${minutes}:${seconds}`
}

function timeToMinutes(value: string): number | null {
  const normalized = toFullCalendarTime(value)
  if (!normalized) return null
  const [h, m, s] = normalized.split(':').map(Number)
  return h * 60 + m + s / 60
}

function findSlotLaneAtY(root: HTMLElement, clientY: number) {
  const lanes = root.querySelectorAll<HTMLElement>(
    '.fc-timegrid-slots td.fc-timegrid-slot-lane[data-time]',
  )
  for (const lane of lanes) {
    const rect = lane.getBoundingClientRect()
    if (clientY >= rect.top && clientY < rect.bottom) return lane
  }
  return null
}

function readStoredZoom() {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
    const parsed = raw ? Number(raw) : MIN_ZOOM
    return Number.isFinite(parsed) ? clampZoom(parsed) : MIN_ZOOM
  } catch {
    return MIN_ZOOM
  }
}

const STATUS_DOT_CLASS: Record<AppointmentStatus, string> = {
  pending: 'calendar-status-dot--pending',
  confirmed: 'calendar-status-dot--pending',
  in_progress: 'calendar-status-dot--pending',
  completed: 'calendar-status-dot--completed',
  cancelled: 'calendar-status-dot--cancelled',
  no_show: 'calendar-status-dot--no-show',
}

/** Mezcla un hex con otro (amount 0–1 hacia `mixWith`). */
function mixHex(hex: string, mixWith: string, amount: number): string {
  const parse = (value: string) => {
    const h = value.replace('#', '')
    return [
      Number.parseInt(h.slice(0, 2), 16),
      Number.parseInt(h.slice(2, 4), 16),
      Number.parseInt(h.slice(4, 6), 16),
    ] as const
  }
  const [r1, g1, b1] = parse(hex)
  const [r2, g2, b2] = parse(mixWith)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`
}

/** Tono alterno: más oscuro y frío para contrastar turnos consecutivos. */
function alternateAppointmentColor(base: string): string {
  return mixHex(mixHex(base, '#1c1917', 0.42), '#334155', 0.28)
}

function toEvents(appointments: Appointment[]): EventInput[] {
  const sorted = [...appointments].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  )
  const stripeIndexByDayBarber = new Map<string, number>()

  return sorted.map((appt) => {
    const clientName = appt.client ? getClientFullName(appt.client) : 'Cliente'
    const day = formatInTimeZone(new Date(appt.starts_at), APP_TIMEZONE, 'yyyy-MM-dd')
    const stripeKey = `${day}:${appt.barber_id}`
    const stripe = stripeIndexByDayBarber.get(stripeKey) ?? 0
    stripeIndexByDayBarber.set(stripeKey, stripe + 1)

    const base = appt.barber?.calendar_color ?? '#64748b'
    const color = stripe % 2 === 0 ? base : alternateAppointmentColor(base)

    return {
      id: appt.id,
      title: clientName,
      start: appt.starts_at,
      end: appt.ends_at,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        status: appt.status,
        barberId: appt.barber_id,
        barberName: appt.barber?.name,
        isOverbooking: appt.is_overbooking,
      },
    }
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderEventContent(arg: EventContentArg) {
  const status = arg.event.extendedProps.status as AppointmentStatus
  const isOverbooking = arg.event.extendedProps.isOverbooking as boolean
  const visibleStatus = visibleAppointmentStatus(status)
  const statusLabel = visibleStatus ? APPOINTMENT_STATUS_LABELS[visibleStatus] : ''
  const title = arg.event.title
  const timeText = arg.timeText || ''
  const tooltip = [title, timeText, statusLabel, isOverbooking ? 'Sobreturno' : '']
    .filter(Boolean)
    .join(' · ')
  const timeHtml = timeText
    ? `<span class="fc-event-time">${escapeHtml(timeText)}</span>`
    : ''
  const overbookingHtml = isOverbooking
    ? '<span class="fc-event-overbooking" aria-hidden="true">⚠</span>'
    : ''
  const statusDotHtml = visibleStatus
    ? `<span class="calendar-status-dot ${STATUS_DOT_CLASS[visibleStatus]}" aria-hidden="true"></span>`
    : ''

  return {
    html: `<div class="fc-event-inner-custom" title="${escapeHtml(tooltip)}">
      <div class="fc-event-heading">
        ${statusDotHtml}
        ${overbookingHtml}
        <span class="fc-event-title">${escapeHtml(title)}</span>
      </div>
      ${timeHtml}
    </div>`,
  }
}

export function CalendarPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { data: profile } = useProfile()
  const { data: barbers } = useBarbers(false)
  const { data: generalSchedules } = useGeneralSchedules()
  const { rescheduleAppointment } = useAppointmentMutations()

  const calendarRef = useRef<FullCalendar>(null)
  const calendarShellRef = useRef<HTMLDivElement>(null)
  const slotTimeTooltipRef = useRef<HTMLDivElement>(null)
  const hoveredSlotRef = useRef<HTMLElement | null>(null)
  const hoverTimeRef = useRef<string | null>(null)
  /** Solo para el primer mount: no remountar al cambiar breakpoint. */
  const initialViewRef = useRef(isMobile ? 'listDay' : 'timeGridWeek')
  const [zoom, setZoom] = useState(readStoredZoom)
  const zoomed = zoom > MIN_ZOOM
  const slotMinHeight = Math.round(CONTENT_SLOT_FLOOR_PX * zoom)

  const applyZoom = useCallback((next: number | ((current: number) => number)) => {
    setZoom((current) => {
      const target = typeof next === 'function' ? next(current) : next
      return clampZoom(target)
    })
  }, [])

  useLayoutEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom))
    } catch {
      /* ignore quota / private mode */
    }
    calendarRef.current?.getApi().updateSize()
  }, [zoom])

  /** Mobile no longer offers Mes — leave month if the viewport shrinks while on it. */
  useEffect(() => {
    if (!isMobile) return
    const api = calendarRef.current?.getApi()
    if (api?.view.type === 'dayGridMonth') {
      api.changeView('timeGridWeek')
    }
  }, [isMobile])

  useEffect(() => {
    const el = calendarShellRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      applyZoom((current) => current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  const clearSlotHover = useCallback(() => {
    hoveredSlotRef.current?.classList.remove('is-slot-hover')
    hoveredSlotRef.current = null
    hoverTimeRef.current = null
    const tooltip = slotTimeTooltipRef.current
    if (tooltip) tooltip.hidden = true
  }, [])

  const handleSlotPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') {
        clearSlotHover()
        return
      }

      const root = event.currentTarget
      const body = root.querySelector('.fc-timegrid-body')
      if (!body) {
        clearSlotHover()
        return
      }

      const bodyRect = body.getBoundingClientRect()
      const insideBody =
        event.clientX >= bodyRect.left &&
        event.clientX <= bodyRect.right &&
        event.clientY >= bodyRect.top &&
        event.clientY <= bodyRect.bottom

      const lane = insideBody ? findSlotLaneAtY(root, event.clientY) : null
      const time = formatSlotTime(lane?.getAttribute('data-time') ?? null)
      const tooltip = slotTimeTooltipRef.current

      if (!lane || !time || !tooltip) {
        clearSlotHover()
        return
      }

      if (hoveredSlotRef.current !== lane) {
        hoveredSlotRef.current?.classList.remove('is-slot-hover')
        hoveredSlotRef.current = lane
        lane.classList.add('is-slot-hover')
      }

      if (hoverTimeRef.current !== time) {
        tooltip.textContent = time
        hoverTimeRef.current = time
      }

      tooltip.hidden = false
      const offset = 14
      const tooltipWidth = tooltip.offsetWidth || 48
      const tooltipHeight = tooltip.offsetHeight || 24
      const left = Math.min(event.clientX + offset, window.innerWidth - tooltipWidth - 8)
      const top = Math.min(event.clientY + offset, window.innerHeight - tooltipHeight - 8)
      tooltip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`
    },
    [clearSlotHover],
  )

  useEffect(() => {
    const el = calendarShellRef.current
    if (!el) return
    const onScroll = () => clearSlotHover()
    el.addEventListener('scroll', onScroll, true)
    return () => el.removeEventListener('scroll', onScroll, true)
  }, [clearSlotHover])

  const [range, setRange] = useState(() => {
    const today = formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
    return { from: today, to: today }
  })
  const [barberFilters, setBarberFilters] = useState<string[]>([])
  const [statusFilters, setStatusFilters] = useState<VisibleAppointmentStatus[]>([])
  const [message, setMessage] = useState('')

  const { data: appointments, isLoading, isFetching } = useAppointments(range.from, range.to)
  const showInitialLoader = isLoading && !appointments

  const toggleBarberFilter = useCallback((barberId: string) => {
    setBarberFilters((current) =>
      current.includes(barberId)
        ? current.filter((id) => id !== barberId)
        : [...current, barberId],
    )
  }, [])

  const toggleStatusFilter = useCallback((status: VisibleAppointmentStatus) => {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    )
  }, [])

  const clearAllFilters = useCallback(() => {
    setBarberFilters([])
    setStatusFilters([])
  }, [])

  const filtered = useMemo(() => {
    const barberSet = barberFilters.length > 0 ? new Set(barberFilters) : null
    const statusSet = statusFilters.length > 0 ? new Set(statusFilters) : null

    return (appointments ?? []).filter((a) => {
      if (barberSet && !barberSet.has(a.barber_id)) return false
      if (statusSet) {
        if (!statusSet.has(a.status as VisibleAppointmentStatus)) return false
      } else if (a.status === 'cancelled') {
        return false
      }
      if (!isAdminRole(profile) && profile?.barber_id && a.barber_id !== profile.barber_id) {
        return false
      }
      return true
    })
  }, [appointments, barberFilters, statusFilters, profile])

  const events = useMemo(() => toEvents(filtered), [filtered])

  const { slotMinTime, slotMaxTime } = useMemo(() => {
    let minMinutes = Number.POSITIVE_INFINITY
    let maxMinutes = Number.NEGATIVE_INFINITY

    for (const row of generalSchedules ?? []) {
      const start = timeToMinutes(row.start_time)
      const end = timeToMinutes(row.end_time)
      if (start != null) minMinutes = Math.min(minMinutes, start)
      if (end != null) maxMinutes = Math.max(maxMinutes, end)
    }

    // Ampliar el cierre si hay turnos más tarde; no adelantar el inicio
    // (el eje debe coincidir con el horario de apertura, p. ej. 09:30).
    for (const appt of filtered) {
      const endLocal = formatInTimeZone(new Date(appt.ends_at), APP_TIMEZONE, 'HH:mm:ss')
      const end = timeToMinutes(endLocal)
      if (end != null) maxMinutes = Math.max(maxMinutes, end)
    }

    if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)) {
      return { slotMinTime: DEFAULT_SLOT_MIN_TIME, slotMaxTime: DEFAULT_SLOT_MAX_TIME }
    }

    // Alinear el cierre al bloque de 30 min; el inicio queda exacto (p. ej. 09:30).
    const ceilMax = Math.ceil(maxMinutes / 30) * 30
    const toHms = (total: number) => {
      const h = Math.floor(total / 60)
      const m = Math.round(total % 60)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    }

    return {
      slotMinTime: toHms(Math.max(0, minMinutes)),
      slotMaxTime: toHms(Math.min(24 * 60, Math.max(ceilMax, minMinutes + 60))),
    }
  }, [generalSchedules, filtered])

  const legendBarbers = useMemo(() => {
    if (!isAdminRole(profile) && profile?.barber_id) {
      const mine = barbers?.find((b) => b.id === profile.barber_id)
      return mine ? [mine] : []
    }
    return barbers ?? []
  }, [barbers, profile])

  const handleDatesSet = useCallback((arg: { startStr: string; endStr: string }) => {
    const from = formatInTimeZone(new Date(arg.startStr), APP_TIMEZONE, 'yyyy-MM-dd')
    const to = formatInTimeZone(new Date(arg.endStr), APP_TIMEZONE, 'yyyy-MM-dd')
    setRange((prev) => (prev.from === from && prev.to === to ? prev : { from, to }))
  }, [])

  const singleBarberFilter = barberFilters.length === 1 ? barberFilters[0] : ''

  const navigateToNewAppointment = useCallback((start: Date) => {
    if (start.getTime() < Date.now()) {
      setMessage('No se pueden crear turnos en el pasado')
      return
    }
    const params = new URLSearchParams({
      date: formatInTimeZone(start, APP_TIMEZONE, 'yyyy-MM-dd'),
      time: formatInTimeZone(start, APP_TIMEZONE, 'HH:mm'),
    })
    if (singleBarberFilter) params.set('barber', singleBarberFilter)
    navigate(`/turnos/nuevo?${params.toString()}`)
  }, [singleBarberFilter, navigate])

  const handleEventClick = (info: EventClickArg) => {
    navigate(`/turnos/${info.event.id}`)
  }

  const handleEventDrop = async (info: EventDropArg) => {
    const apptId = info.event.id
    const newStart = info.event.start?.toISOString()
    if (!apptId || !newStart) {
      info.revert()
      return
    }
    if (new Date(newStart).getTime() < Date.now()) {
      info.revert()
      setMessage('No se pueden reprogramar turnos al pasado')
      return
    }

    try {
      await rescheduleAppointment.mutateAsync({ id: apptId, starts_at: newStart })
      setMessage('Turno reprogramado')
    } catch (e) {
      info.revert()
      setMessage((e as Error).message)
    }
  }

  const handleDateClick = (info: DateClickArg) => {
    navigateToNewAppointment(info.date)
  }

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    navigateToNewAppointment(selectInfo.start)
    selectInfo.view.calendar.unselect()
  }

  const selectAllow = useCallback(
    (selectInfo: { start: Date }) => selectInfo.start.getTime() >= Date.now(),
    [],
  )

  const eventAllow = useCallback(
    (dropInfo: { start: Date | null }) =>
      dropInfo.start ? dropInfo.start.getTime() >= Date.now() : false,
    [],
  )

  const newAppointmentHref = useMemo(() => {
    const params = new URLSearchParams({
      date: formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd'),
    })
    if (singleBarberFilter) params.set('barber', singleBarberFilter)
    return `/turnos/nuevo?${params.toString()}`
  }, [singleBarberFilter])

  const activeFilterCount = barberFilters.length + statusFilters.length

  function renderBarberFilterOptions() {
    if (!isAdminRole(profile)) return null
    return (
      <fieldset className="space-y-1">
        <legend className="text-muted-foreground mb-1.5 text-[0.6875rem] font-medium tracking-wide uppercase">
          Barberos
        </legend>
        {(barbers ?? []).length === 0 ? (
          <p className="text-muted-foreground text-xs">Sin barberos</p>
        ) : (
          (barbers ?? []).map((b) => {
            const checked = barberFilters.includes(b.id)
            return (
              <label key={b.id} className={filterOptionClass}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleBarberFilter(b.id)}
                  aria-label={`Filtrar por ${b.name}`}
                />
                <span
                  className="calendar-barber-swatch shrink-0"
                  style={{ backgroundColor: b.calendar_color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
              </label>
            )
          })
        )}
      </fieldset>
    )
  }

  function renderStatusFilterOptions() {
    return (
      <fieldset className="space-y-1">
        <legend className="text-muted-foreground mb-1.5 text-[0.6875rem] font-medium tracking-wide uppercase">
          Estados
        </legend>
        {APPOINTMENT_STATUS_OPTIONS.map((value) => {
          const checked = statusFilters.includes(value)
          return (
            <label key={value} className={filterOptionClass}>
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggleStatusFilter(value)}
                aria-label={`Filtrar por ${APPOINTMENT_STATUS_LABELS[value]}`}
              />
              <span
                className={`calendar-status-dot shrink-0 ${STATUS_DOT_CLASS[value]}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{APPOINTMENT_STATUS_LABELS[value]}</span>
            </label>
          )
        })}
      </fieldset>
    )
  }

  function renderFilterTrigger(
    label: string,
    count: number,
    className?: string,
  ) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('h-8 gap-1.5 rounded-sm', className)}
      >
        <ListFilter className="size-3.5" />
        {label}
        {count > 0 && (
          <span className="bg-accent text-accent-foreground ml-0.5 inline-flex size-5 items-center justify-center rounded-sm text-[0.6875rem] font-semibold tabular-nums">
            {count}
          </span>
        )}
      </Button>
    )
  }

  return (
    <div className="calendar-page -m-4 flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center">
          <h1 className="font-display shrink-0 text-lg font-semibold tracking-wide uppercase">Agenda</h1>
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:flex-nowrap">
            {/* Mobile: collapse filters into one control */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 min-w-11 gap-1.5 rounded-sm md:hidden"
                  aria-label="Filtros del calendario"
                >
                  <ListFilter className="size-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span className="bg-accent text-accent-foreground ml-0.5 inline-flex size-5 items-center justify-center rounded-sm text-[0.6875rem] font-semibold tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 space-y-4 rounded-sm p-3 md:hidden">
                {renderBarberFilterOptions()}
                {renderStatusFilterOptions()}
              </PopoverContent>
            </Popover>

            {/* Desktop: multi-select popovers */}
            <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex md:flex-nowrap">
              {isAdminRole(profile) && (
                <Popover>
                  <PopoverTrigger asChild>
                    {renderFilterTrigger('Barberos', barberFilters.length)}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 rounded-sm p-3">
                    {renderBarberFilterOptions()}
                  </PopoverContent>
                </Popover>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  {renderFilterTrigger('Estados', statusFilters.length)}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 rounded-sm p-3">
                  {renderStatusFilterOptions()}
                </PopoverContent>
              </Popover>
            </div>

            <div
              className="hidden shrink-0 items-center gap-0.5 md:flex"
              role="group"
              aria-label="Zoom del calendario"
            >
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-8"
                disabled={zoom <= MIN_ZOOM}
                aria-label="Alejar"
                onClick={() => applyZoom((current) => current - ZOOM_STEP)}
              >
                <Minus className="size-4" />
              </Button>
              <span className="text-muted-foreground w-11 text-center text-xs tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-8"
                disabled={zoom >= MAX_ZOOM}
                aria-label="Acercar"
                onClick={() => applyZoom((current) => current + ZOOM_STEP)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <Button variant="accent" size="sm" className="hidden h-8 shrink-0 gap-1.5 md:inline-flex" asChild>
              <Link to={newAppointmentHref}>
                <Plus className="size-4" />
                Nuevo turno
              </Link>
            </Button>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            aria-label="Filtros activos"
          >
            {barberFilters.map((barberId) => (
              <span
                key={`barber-${barberId}`}
                className="border-border bg-card text-foreground inline-flex max-w-full items-center gap-1 rounded-sm border px-2 py-1 text-xs"
              >
                <span className="truncate">
                  {barbers?.find((b) => b.id === barberId)?.name ?? 'Barbero'}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground -mr-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm"
                  aria-label="Quitar filtro de barbero"
                  onClick={() => toggleBarberFilter(barberId)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ))}
            {statusFilters.map((status) => (
              <span
                key={`status-${status}`}
                className="border-border bg-card text-foreground inline-flex max-w-full items-center gap-1 rounded-sm border px-2 py-1 text-xs"
              >
                <span className="truncate">{APPOINTMENT_STATUS_LABELS[status]}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground -mr-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm"
                  aria-label="Quitar filtro de estado"
                  onClick={() => toggleStatusFilter(status)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground px-1.5 py-1 text-xs font-medium underline-offset-2 hover:underline"
              onClick={clearAllFilters}
            >
              Quitar todos
            </button>
          </div>
        )}
      </div>

      <div className="calendar-legend hidden max-h-16 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 overflow-hidden text-[0.6875rem] text-muted-foreground sm:flex sm:max-h-none">
        {legendBarbers.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground/70">Barberos</span>
            {legendBarbers.map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1">
                <span
                  className="calendar-barber-swatch"
                  style={{ backgroundColor: b.calendar_color }}
                  aria-hidden="true"
                />
                {b.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground/70">Estado</span>
          {APPOINTMENT_STATUS_OPTIONS.map((status) => (
              <span key={status} className="inline-flex items-center gap-1">
                <span
                  className={`calendar-status-dot ${STATUS_DOT_CLASS[status]}`}
                  aria-hidden="true"
                />
                {APPOINTMENT_STATUS_LABELS[status]}
              </span>
            ))}
        </div>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="calendar-overbooking-icon size-3" aria-hidden="true" />
          Sobreturno
        </span>
      </div>

      {message && (
        <p className="text-muted-foreground shrink-0 text-xs">{message}</p>
      )}

      <div
        ref={calendarShellRef}
        className="calendar-shell relative min-h-0 flex-1 overflow-hidden rounded-sm border bg-card"
      >
        {showInitialLoader ? (
          <p className="text-muted-foreground p-3 text-sm">Cargando turnos…</p>
        ) : (
          <>
            {isFetching && (
              <p className="text-muted-foreground pointer-events-none absolute top-2 right-2 z-10 rounded-md bg-card/90 px-2 py-1 text-[0.6875rem] shadow-sm">
                Actualizando…
              </p>
            )}
            <div
              className={cn(
                'calendar-compact flex h-full min-h-0 flex-col p-1',
                zoomed && 'calendar-compact--zoomed',
              )}
              style={
                {
                  '--calendar-zoom': String(zoom),
                  '--calendar-slot-height': `${slotMinHeight}px`,
                } as CSSProperties
              }
              onPointerMove={handleSlotPointerMove}
              onPointerLeave={clearSlotHover}
            >
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView={initialViewRef.current}
                locale={esLocale}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: isMobile
                    ? 'listDay,timeGridDay,timeGridWeek'
                    : 'timeGridDay,timeGridWeek,dayGridMonth,listDay',
                }}
                views={{
                  timeGridDay: { buttonText: 'Día' },
                  timeGridWeek: { buttonText: 'Semana' },
                  dayGridMonth: { buttonText: 'Mes' },
                  listDay: { buttonText: 'Lista' },
                }}
                dayMaxEvents={isMobile ? 3 : false}
                slotMinTime={slotMinTime}
                slotMaxTime={slotMaxTime}
                slotDuration="00:30:00"
                slotLabelInterval="01:00:00"
                allDaySlot={false}
                height="100%"
                expandRows={false}
                slotEventOverlap={false}
                eventOverlap={false}
                events={events}
                editable={!isMobile}
                eventStartEditable={!isMobile}
                eventDurationEditable={false}
                eventResizableFromStart={false}
                selectable
                selectMirror
                selectAllow={selectAllow}
                eventAllow={eventAllow}
                eventDrop={handleEventDrop}
                eventClick={handleEventClick}
                dateClick={handleDateClick}
                select={handleDateSelect}
                datesSet={handleDatesSet}
                eventContent={renderEventContent}
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
                nowIndicator
                noEventsContent="Sin turnos en este período"
              />
            </div>
          </>
        )}
      </div>
      {createPortal(
        <div
          ref={slotTimeTooltipRef}
          hidden
          className="calendar-slot-time-tooltip"
          role="status"
          aria-live="polite"
        />,
        document.body,
      )}
    </div>
  )
}
