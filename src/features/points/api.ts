import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppointmentCoupon } from '@/lib/coupon-discount'
import { getSupabaseClient } from '@/lib/supabase'

export interface PointBalance {
  balance: number
  next_expires_at: string | null
}

export interface RedemptionRow {
  id: string
  unique_code: string
  status: string
  points_used: number
  created_at: string
  client_id: string
  reward_id: string
  rewards?: { name: string } | { name: string }[] | null
  clients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}

export function usePointsConfig() {
  return useQuery({
    queryKey: ['points-config'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().from('points_config').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useRewards() {
  return useQuery({
    queryKey: ['rewards'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('rewards')
        .select('*')
        .eq('is_active', true)
        .order('points_required')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useClientPointBalance(clientId: string | undefined) {
  return useQuery({
    queryKey: ['point-balance', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_client_point_balance', {
        p_client_id: clientId!,
      })
      if (error) throw error
      const row = (data as PointBalance[])[0]
      return row ?? { balance: 0, next_expires_at: null }
    },
  })
}

export function useRedemptions() {
  return useQuery({
    queryKey: ['redemptions'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('redemptions')
        .select('id, unique_code, status, points_used, created_at, client_id, reward_id, rewards(name), clients(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as RedemptionRow[]
    },
  })
}

export function usePointsMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['redemptions'] })
    void qc.invalidateQueries({ queryKey: ['point-balance'] })
    void qc.invalidateQueries({ queryKey: ['point-movements'] })
  }

  const redeemReward = useMutation({
    mutationFn: async ({ clientId, rewardId }: { clientId: string; rewardId: string }) => {
      const { data, error } = await getSupabaseClient().rpc('redeem_reward', {
        p_client_id: clientId,
        p_reward_id: rewardId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  const deliverRedemption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient().rpc('update_redemption_status', {
        p_redemption_id: id,
        p_status: 'delivered',
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const cancelRedemption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient().rpc('cancel_redemption', {
        p_redemption_id: id,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const adjustPoints = useMutation({
    mutationFn: async (input: {
      clientId: string
      quantity: number
      reason?: string | null
    }) => {
      const { data, error } = await getSupabaseClient().rpc('adjust_client_points', {
        p_client_id: input.clientId,
        p_quantity: input.quantity,
        p_reason: input.reason ?? null,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: (_data, variables) => {
      invalidate()
      void qc.invalidateQueries({ queryKey: ['point-balance', variables.clientId] })
      void qc.invalidateQueries({ queryKey: ['point-movements', variables.clientId] })
    },
  })

  return { redeemReward, deliverRedemption, cancelRedemption, adjustPoints }
}

export function useClientAvailableCoupons(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-coupons', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('list_client_available_coupons', {
        p_client_id: clientId!,
      })
      if (error) throw error
      return (data ?? []) as AppointmentCoupon[]
    },
  })
}

export function useAppointmentCoupon(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['appointment-coupon', appointmentId],
    enabled: !!appointmentId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_appointment_coupon', {
        p_appointment_id: appointmentId!,
      })
      if (error) throw error
      const rows = (data ?? []) as AppointmentCoupon[]
      return rows[0] ?? null
    },
  })
}

export function useAppointmentCouponMutations() {
  const qc = useQueryClient()

  const applyCoupon = useMutation({
    mutationFn: async (input: {
      appointmentId: string
      redemptionId?: string | null
      code?: string | null
    }) => {
      const { error } = await getSupabaseClient().rpc('apply_appointment_coupon', {
        p_appointment_id: input.appointmentId,
        p_redemption_id: input.redemptionId ?? null,
        p_code: input.code ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['appointments'] })
      void qc.invalidateQueries({ queryKey: ['appointment-coupon', variables.appointmentId] })
      void qc.invalidateQueries({ queryKey: ['client-coupons'] })
      void qc.invalidateQueries({ queryKey: ['redemptions'] })
      void qc.invalidateQueries({ queryKey: ['payment-summary'] })
    },
  })

  return { applyCoupon }
}
