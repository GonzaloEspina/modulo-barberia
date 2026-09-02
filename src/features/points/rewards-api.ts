import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

export interface RewardInput {
  name: string
  description: string | null
  points_required: number
  reward_type: string
  stock: number | null
  starts_at: string | null
  ends_at: string | null
  max_per_client: number | null
  is_active: boolean
}

export function useRewardsAdmin() {
  return useQuery({
    queryKey: ['rewards-admin'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('rewards')
        .select('*')
        .order('points_required')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRewardMutations(organizationId: string | undefined) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['rewards-admin'] })
    void qc.invalidateQueries({ queryKey: ['rewards'] })
  }

  const saveReward = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: RewardInput }) => {
      const payload = { organization_id: organizationId!, ...input }
      if (id) {
        const { error } = await getSupabaseClient().from('rewards').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await getSupabaseClient().from('rewards').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: invalidate,
  })

  const deleteReward = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient().from('rewards').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { saveReward, deleteReward }
}
