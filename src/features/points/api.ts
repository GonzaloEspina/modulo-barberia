import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

  return { redeemReward, deliverRedemption, cancelRedemption }
}
