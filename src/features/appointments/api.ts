import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type { Appointment } from '@/types/appointment'

const APPT_COLUMNS = `
  id, organization_id, client_id, barber_id,
  starts_at, ends_at, total_duration_minutes,
  subtotal, discount_amount, total_amount,
  status, attendance_status,
  client_membership_id, membership_turns_consumed,
  is_overbooking, overbooking_reason, notes,
  creation_channel, cancelled_at, cancellation_reason,
  client:clients(first_name, last_name, phone_display),
  barber:barbers(name, calendar_color)
`

export function useAppointments(from?: string, to?: string) {
  return useQuery({
    queryKey: ['appointments', from, to],
    queryFn: async () => {
      let query = getSupabaseClient()
        .from('appointments')
        .select(APPT_COLUMNS)
        .order('starts_at', { ascending: true })

      if (from) query = query.gte('starts_at', `${from}T00:00:00`)
      if (to) query = query.lte('starts_at', `${to}T23:59:59`)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as Appointment[]
    },
  })
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: ['appointments', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('appointments')
        .select(`${APPT_COLUMNS}, appointment_services(id, service_name, price_applied, duration_applied, points_applied, sort_order)`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Appointment | null
    },
  })
}

export function useAppointmentMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['appointments'] })
    void queryClient.invalidateQueries({ queryKey: ['available-slots'] })
    void queryClient.invalidateQueries({ queryKey: ['schedule-gaps'] })
  }

  const createAppointment = useMutation({
    mutationFn: async (input: {
      client_id: string
      barber_id: string
      starts_at: string
      service_ids: string[]
      client_membership_id?: string | null
      is_overbooking?: boolean
      overbooking_reason?: string | null
      notes?: string | null
      /** Fin del bloque cuando ocupa más de un cupo (turno múltiple). */
      ends_at?: string | null
    }) => {
      const { data, error } = await getSupabaseClient().rpc('create_appointment', {
        p_client_id: input.client_id,
        p_barber_id: input.barber_id,
        p_starts_at: input.starts_at,
        p_service_ids: input.service_ids,
        p_client_membership_id: input.client_membership_id ?? null,
        p_is_overbooking: input.is_overbooking ?? false,
        p_overbooking_reason: input.overbooking_reason ?? null,
        p_notes: input.notes ?? null,
        p_ends_at: input.ends_at ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  const cancelAppointment = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await getSupabaseClient().rpc('cancel_appointment', {
        p_appointment_id: id,
        p_reason: reason ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const rescheduleAppointment = useMutation({
    mutationFn: async ({ id, starts_at }: { id: string; starts_at: string }) => {
      const { error } = await getSupabaseClient().rpc('reschedule_appointment', {
        p_appointment_id: id,
        p_new_starts_at: starts_at,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      attendance,
    }: {
      id: string
      status?: string
      attendance?: string
    }) => {
      const { error } = await getSupabaseClient().rpc('update_appointment_status', {
        p_appointment_id: id,
        p_status: status ?? null,
        p_attendance: attendance ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { createAppointment, cancelAppointment, rescheduleAppointment, updateStatus }
}
