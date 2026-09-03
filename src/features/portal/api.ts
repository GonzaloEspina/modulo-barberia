import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PORTAL_ORG_ID } from '@/lib/constants'
import type { AppointmentCoupon } from '@/lib/coupon-discount'
import { getSupabaseClient } from '@/lib/supabase'
import {
  clearPortalSession,
  loadPortalSession,
  savePortalSession,
  type PortalSession,
} from '@/features/portal/portal-session'

export interface PortalAppointment {
  id: string
  starts_at: string
  ends_at: string
  status: string
  barber_name: string
  service_names: string | null
  total_amount: number
}

export interface PortalDashboard {
  client: { id: string; first_name: string; last_name: string; phone_display: string | null }
  organization: { name: string }
  portal_booking_mode: 'all_except_denied' | 'allowlist_only' | 'disabled'
  booking_override: 'inherit' | 'allowed' | 'denied'
  can_book: boolean
  has_upcoming_appointment?: boolean
  upcoming_appointments: PortalAppointment[]
  past_appointments: PortalAppointment[]
  memberships: Array<{
    id: string
    plan_name: string
    appointments_remaining: number
    appointments_total: number
    expires_at: string
    status: string
  }>
  point_balance: number
  point_next_expires_at?: string | null
  rewards: PortalReward[]
  redemptions: PortalRedemption[]
}

export interface PortalReward {
  id: string
  name: string
  description: string | null
  points_required: number
  reward_type: string
  value: number | null
  stock: number | null
  can_redeem: boolean
}

export interface PortalRedemption {
  id: string
  unique_code: string
  status: string
  points_used: number
  reward_name: string
  reward_type?: string | null
  value?: number | null
  service_id?: string | null
  appointment_id?: string | null
  created_at: string
}

const BOOKING_COUPON_TYPES = new Set([
  'percentage_discount',
  'fixed_discount',
  'free_service',
])

export function availablePortalCoupons(redemptions: PortalRedemption[]): AppointmentCoupon[] {
  return redemptions
    .filter((redemption) =>
      (redemption.status === 'requested' || redemption.status === 'approved')
      && !redemption.appointment_id
      && BOOKING_COUPON_TYPES.has(redemption.reward_type ?? ''),
    )
    .map((redemption) => ({
      id: redemption.id,
      unique_code: redemption.unique_code,
      status: redemption.status,
      reward_name: redemption.reward_name,
      reward_type: redemption.reward_type ?? '',
      value: redemption.value ?? null,
      service_id: redemption.service_id,
      points_used: redemption.points_used,
    }))
}

export function usePortalSession() {
  return useQuery({
    queryKey: ['portal-session'],
    queryFn: () => loadPortalSession(),
    staleTime: Infinity,
  })
}

export function usePortalDashboard(token: string | undefined) {
  return useQuery({
    queryKey: ['portal-dashboard', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('portal_get_dashboard', {
        p_session_token: token!,
      })
      if (error) throw error
      return data as PortalDashboard
    },
  })
}

export function usePortalMutations() {
  const qc = useQueryClient()

  const login = useMutation({
    mutationFn: async ({ phone }: { phone: string }) => {
      const { data, error } = await getSupabaseClient().rpc('portal_login_with_phone', {
        p_phone: phone,
        p_organization_id: PORTAL_ORG_ID,
      })
      if (error) throw error
      const row = (data as Array<{
        session_token: string
        client_id: string
        client_name: string
        expires_at: string
      }>)[0]
      if (!row) throw new Error('No se pudo iniciar sesión')
      const session: PortalSession = {
        token: row.session_token,
        clientId: row.client_id,
        clientName: row.client_name,
        expiresAt: row.expires_at,
      }
      savePortalSession(session)
      return session
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portal-session'] }),
  })

  const logout = useMutation({
    mutationFn: async (token: string) => {
      await getSupabaseClient().rpc('portal_logout', { p_session_token: token })
      clearPortalSession()
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-session'] })
      void qc.removeQueries({ queryKey: ['portal-dashboard'] })
    },
  })

  return { login, logout }
}

export interface PortalService {
  id: string
  name: string
  duration_minutes: number
  price: number
}

export interface PortalBarber {
  id: string
  name: string
}

export interface PortalSlot {
  barber_id: string
  barber_name: string
  slot_start: string
  slot_end: string
  total_duration_minutes: number
}

export function usePortalServices(token: string | undefined) {
  return useQuery({
    queryKey: ['portal-services', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('portal_list_services', {
        p_session_token: token!,
      })
      if (error) throw error
      return (data ?? []) as PortalService[]
    },
  })
}

export function usePortalBarbers(token: string | undefined, serviceIds: string[]) {
  return useQuery({
    queryKey: ['portal-barbers', token, serviceIds],
    enabled: !!token && serviceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('portal_list_barbers', {
        p_session_token: token!,
        p_service_ids: serviceIds,
      })
      if (error) throw error
      return (data ?? []) as PortalBarber[]
    },
  })
}

export function usePortalSlots(
  token: string | undefined,
  date: string,
  serviceIds: string[],
  barberId: string | null,
) {
  return useQuery({
    queryKey: ['portal-slots', token, date, serviceIds, barberId],
    enabled: !!token && !!date && serviceIds.length > 0 && !!barberId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('portal_get_available_slots', {
        p_session_token: token!,
        p_date: date,
        p_service_ids: serviceIds,
        p_barber_id: barberId,
      })
      if (error) throw error
      return (data ?? []) as PortalSlot[]
    },
  })
}

export function usePortalBookingMutations() {
  const qc = useQueryClient()

  const bookAppointment = useMutation({
    mutationFn: async (input: {
      token: string
      barberId: string
      startsAt: string
      serviceIds: string[]
      notes?: string
      redemptionId?: string | null
      code?: string | null
    }) => {
      const { data, error } = await getSupabaseClient().rpc('portal_create_appointment', {
        p_session_token: input.token,
        p_barber_id: input.barberId,
        p_starts_at: input.startsAt,
        p_service_ids: input.serviceIds,
        p_notes: input.notes ?? null,
        p_redemption_id: input.redemptionId ?? null,
        p_code: input.code ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-dashboard'] })
      void qc.invalidateQueries({ queryKey: ['portal-slots'] })
    },
  })

  return { bookAppointment }
}

export function usePortalRedeemMutations() {
  const qc = useQueryClient()

  const redeemReward = useMutation({
    mutationFn: async (input: { token: string; rewardId: string }) => {
      const { data, error } = await getSupabaseClient().rpc('portal_redeem_reward', {
        p_session_token: input.token,
        p_reward_id: input.rewardId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-dashboard'] })
    },
  })

  return { redeemReward }
}
