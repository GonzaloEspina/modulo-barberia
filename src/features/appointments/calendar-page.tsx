import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { formatInTimeZone } from 'date-fns-tz'
import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAppointmentMutations, useAppointments } from '@/features/appointments/api'
import { useBarbers } from '@/features/barbers/api'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { APP_TIMEZONE } from '@/lib/constants'
import { APPOINTMENT_STATUS_LABELS, type Appointment } from '@/types/appointment'

import './calendar.css'

const selectClass =
  'border-input bg-background h-8 rounded-md border px-2 text-xs'

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

export function CalendarPage() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: barbers } = useBarbers(false)
  const { rescheduleAppointment } = useAppointmentMutations()

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

  const newAppointmentHref = useMemo(() => {
    const params = new URLSearchParams({
      date: formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd'),
    })
    if (barberFilter) params.set('barber', barberFilter)
    return `/turnos/nuevo?${params.toString()}`
  }, [barberFilter])

  return (
    <div className="calendar-page -m-4 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Calendario</h1>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="accent" size="sm" className="h-8 gap-1.5" asChild>
            <Link to={newAppointmentHref}>
              <Plus className="size-4" />
              Nuevo turno
            </Link>
          </Button>
        </div>
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
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              locale={esLocale}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: '',
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
              eventDrop={handleEventDrop}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              select={handleDateSelect}
              datesSet={handleDatesSet}
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
              nowIndicator
            />
          </div>
        )}
      </div>
    </div>
  )
}
