export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type AttendanceStatus =
  | 'pending'
  | 'attended'
  | 'no_show'
  | 'cancelled_early'
  | 'cancelled_late'
  | 'rescheduled'

export interface AppointmentService {
  id: string
  service_name: string
  price_applied: number
  duration_applied: number
  points_applied: number
  sort_order: number
}

export interface Appointment {
  id: string
  organization_id: string
  client_id: string
  barber_id: string
  starts_at: string
  ends_at: string
  total_duration_minutes: number
  subtotal: number
  discount_amount: number
  total_amount: number
  status: AppointmentStatus
  attendance_status: AttendanceStatus
  client_membership_id: string | null
  membership_turns_consumed: number
  is_overbooking: boolean
  overbooking_reason: string | null
  notes: string | null
  creation_channel: string
  cancelled_at: string | null
  cancellation_reason: string | null
  client?: { first_name: string; last_name: string; phone_display: string | null }
  barber?: { name: string; calendar_color: string }
  appointment_services?: AppointmentService[]
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  pending: 'Pendiente',
  attended: 'Asistió',
  no_show: 'No asistió',
  cancelled_early: 'Canceló a tiempo',
  cancelled_late: 'Canceló tarde',
  rescheduled: 'Reprogramado',
}
