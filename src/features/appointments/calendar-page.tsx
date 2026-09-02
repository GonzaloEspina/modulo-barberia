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
import { AlertTriangle, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAppointmentMutations, useAppointments } from '@/features/appointments/api'
import { useBarbers } from '@/features/barbers/api'
import { useIsMobile } from '@/hooks/use-mobile'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { APP_TIMEZONE } from '@/lib/constants'
import {
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type AppointmentStatus,
} from '@/types/appointment'

import './calendar.css'

const selectClass =
  'border-input bg-background h-8 min-w-0 shrink rounded-md border px-2 text-xs'

const STATUS_DOT_CLASS: Record<AppointmentStatus, string> = {
  pending: 'calendar-status-dot--pending',
  confirmed: 'calendar-status-dot--confirmed',
  in_progress: 'calendar-status-dot--in-progress',
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
    const clientName = appt.client
      ? `${appt.client.first_name} ${appt.client.last_name}`
      : 'Cliente'
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

function renderEventContent(arg: EventContentArg) {
  const status = arg.event.extendedProps.status as AppointmentStatus
  const isOverbooking = arg.event.extendedProps.isOverbooking as boolean
  const dotClass = STATUS_DOT_CLASS[status] ?? 'calendar-status-dot--pending'
  const timeHtml = arg.timeText
    ? `<span class="fc-event-time">${arg.timeText}</span>`
    : ''
  const overbookingHtml = isOverbooking
    ? '<span class="fc-event-overbooking" aria-hidden="true">⚠</span>'
    : ''

  return {
    html: `<div class="fc-event-inner-custom">
      <span class="calendar-status-dot ${dotClass}" aria-hidden="true"></span>
      ${overbookingHtml}
      ${timeHtml}
      <span class="fc-event-title fc-sticky">${arg.event.title}</span>
    </div>`,
  }
}

export function CalendarPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { data: profile } = useProfile()
  const { data: barbers } = useBarbers(false)
  const { rescheduleAppointment } = useAppointmentMutations()

  const initialView = isMobile ? 'listDay' : 'timeGridWeek'

  const [range, setRange] = useState(() => {
    const today = formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
    return { from: today, to: today }
  })
  const [barberFilter, setBarberFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [message, setMessage] = useState('')

  const { data: appointments, isLoading } = useAppointments(range.from, range.to)

  const filtered = useMemo(() => {
    return (appointments ?? []).filter((a) => {
      if (barberFilter && a.barber_id !== barberFilter) return false
      if (statusFilter && a.status !== statusFilter) return false
      if (!isAdminRole(profile) && profile?.barber_id && a.barber_id !== profile.barber_id) {
        return false
      }
      return true
    })
  }, [appointments, barberFilter, statusFilter, profile])

  const events = useMemo(() => toEvents(filtered), [filtered])

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
    setRange({ from, to })
  }, [])

  const navigateToNewAppointment = useCallback((start: Date) => {
    if (start.getTime() < Date.now()) {
      setMessage('No se pueden crear turnos en el pasado')
      return
    }
    const params = new URLSearchParams({
      date: formatInTimeZone(start, APP_TIMEZONE, 'yyyy-MM-dd'),
      time: formatInTimeZone(start, APP_TIMEZONE, 'HH:mm'),
    })
    if (barberFilter) params.set('barber', barberFilter)
    navigate(`/turnos/nuevo?${params.toString()}`)
  }, [barberFilter, navigate])

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
    if (barberFilter) params.set('barber', barberFilter)
    return `/turnos/nuevo?${params.toString()}`
  }, [barberFilter])

  return (
    <div className="calendar-page -m-4 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
      <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto">
        <h1 className="shrink-0 text-lg font-semibold tracking-tight">Calendario</h1>
        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
          {isAdminRole(profile) && (
            <select
              className={selectClass}
              aria-label="Filtrar por barbero"
              value={barberFilter}
              onChange={(e) => setBarberFilter(e.target.value)}
            >
              <option value="">Todos los barberos</option>
              {barbers?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <select
            className={selectClass}
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Button variant="accent" size="sm" className="h-8 shrink-0 gap-1.5" asChild>
            <Link to={newAppointmentHref}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuevo turno</span>
              <span className="sm:hidden">Nuevo</span>
            </Link>
          </Button>
        </div>
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
          {(Object.entries(APPOINTMENT_STATUS_LABELS) as [AppointmentStatus, string][]).map(
            ([status, label]) => (
              <span key={status} className="inline-flex items-center gap-1">
                <span
                  className={`calendar-status-dot ${STATUS_DOT_CLASS[status]}`}
                  aria-hidden="true"
                />
                {label}
              </span>
            ),
          )}
        </div>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="calendar-overbooking-icon size-3" aria-hidden="true" />
          Sobreturno
        </span>
      </div>

      {message && (
        <p className="text-muted-foreground shrink-0 text-xs">{message}</p>
      )}

      <div className="calendar-shell min-h-0 flex-1 overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <p className="text-muted-foreground p-3 text-sm">Cargando turnos…</p>
        ) : (
          <div className="calendar-compact flex h-full min-h-0 flex-col p-1">
            <FullCalendar
              key={initialView}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView={initialView}
              locale={esLocale}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: isMobile
                  ? 'listDay,timeGridDay'
                  : 'timeGridDay,timeGridWeek,dayGridMonth,listDay',
              }}
              views={{
                timeGridDay: { buttonText: 'Día' },
                timeGridWeek: { buttonText: 'Semana' },
                dayGridMonth: { buttonText: 'Mes' },
                listDay: { buttonText: 'Lista' },
              }}
              slotMinTime="10:00:00"
              slotMaxTime="20:00:00"
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"
              allDaySlot={false}
              height="100%"
              expandRows
              events={events}
              editable
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
        )}
      </div>
    </div>
  )
}
