import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

export function useMembershipPlans(includeInactive = false) {
  return useQuery({
    queryKey: ['membership-plans', includeInactive],
    queryFn: async () => {
      let q = getSupabaseClient()
        .from('membership_plans')
        .select('*')
        .is('deleted_at', null)
        .order('display_order')
      if (!includeInactive) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useClientMemberships(clientId?: string) {
  return useQuery({
    queryKey: ['client-memberships', clientId],
    queryFn: async () => {
      let q = getSupabaseClient()
        .from('client_memberships')
        .select(`
          *,
          client:clients(id, first_name, last_name, phone_display, phone_normalized)
        `)
        .is('deleted_at', null)
        .order('purchased_at', { ascending: false })
      if (clientId) q = q.eq('client_id', clientId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMembershipMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['membership-plans'] })
    void qc.invalidateQueries({ queryKey: ['client-memberships'] })
  }

  const purchase = useMutation({
    mutationFn: async (input: { client_id: string; plan_id: string; payment_confirmed: boolean }) => {
      const { data, error } = await getSupabaseClient().rpc('purchase_client_membership', {
        p_client_id: input.client_id,
        p_plan_id: input.plan_id,
        p_payment_confirmed: input.payment_confirmed,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  const savePlan = useMutation({
    mutationFn: async (input: {
      id?: string
      organization_id: string
      name: string
      price: number
      appointments_included: number
      validity_months: number
      description?: string
      is_active: boolean
    }) => {
      const payload = {
        organization_id: input.organization_id,
        name: input.name.trim(),
        price: input.price,
        appointments_included: input.appointments_included,
        validity_months: input.validity_months,
        description: input.description?.trim() || null,
        is_active: input.is_active,
      }
      if (input.id) {
        const { error } = await getSupabaseClient().from('membership_plans').update(payload).eq('id', input.id)
        if (error) throw error
      } else {
        const { error } = await getSupabaseClient().from('membership_plans').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: invalidate,
  })

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient()
        .from('membership_plans')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { purchase, savePlan, deletePlan }
}
