import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

export function usePlatformMutations() {
  const qc = useQueryClient()

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['platform-organizations'] })
    void qc.invalidateQueries({ queryKey: ['platform-organization'] })
    void qc.invalidateQueries({ queryKey: ['platform-billing-settings'] })
  }

  const createOrganization = useMutation({
    mutationFn: async (input: { name: string; phone?: string; address?: string }) => {
      const { data, error } = await getSupabaseClient().rpc('platform_create_organization', {
        p_name: input.name,
        p_phone: input.phone ?? null,
        p_address: input.address ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  const assignAdmin = useMutation({
    mutationFn: async ({ orgId, email }: { orgId: string; email: string }) => {
      const { error } = await getSupabaseClient().rpc('platform_assign_org_admin', {
        p_org_id: orgId,
        p_email: email,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const switchOrganization = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await getSupabaseClient().rpc('platform_switch_organization', {
        p_org_id: orgId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries()
      window.location.href = '/'
    },
  })

  const createOrganizationWithAdmin = useMutation({
    mutationFn: async (input: {
      name: string
      adminEmail: string
      adminPassword: string
      adminFullName?: string
    }) => {
      const { data, error } = await getSupabaseClient().rpc('platform_create_organization_with_admin', {
        p_org_name: input.name,
        p_admin_email: input.adminEmail,
        p_admin_password: input.adminPassword,
        p_admin_full_name: input.adminFullName ?? null,
      })
      if (error) throw error
      const row = (data as Array<{ organization_id: string; user_id: string }>)[0]
      return row
    },
    onSuccess: invalidate,
  })

  const extendTrial = useMutation({
    mutationFn: async ({ orgId, days }: { orgId: string; days: number }) => {
      const { data, error } = await getSupabaseClient().rpc('platform_extend_trial', {
        p_org_id: orgId,
        p_days: days,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  const setPaidUntil = useMutation({
    mutationFn: async ({ orgId, paidUntil }: { orgId: string; paidUntil: string }) => {
      const { data, error } = await getSupabaseClient().rpc('platform_set_paid_until', {
        p_org_id: orgId,
        p_paid_until: paidUntil,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  const setMonthlyPrice = useMutation({
    mutationFn: async ({ orgId, price }: { orgId: string; price: number }) => {
      const { data, error } = await getSupabaseClient().rpc('platform_set_monthly_price', {
        p_org_id: orgId,
        p_price: price,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: invalidate,
  })

  const setSuspended = useMutation({
    mutationFn: async ({ orgId, suspended }: { orgId: string; suspended: boolean }) => {
      const { error } = await getSupabaseClient().rpc('platform_set_org_suspended', {
        p_org_id: orgId,
        p_suspended: suspended,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const updateBillingSettings = useMutation({
    mutationFn: async (input: { defaultTrialDays: number; defaultMonthlyPrice: number }) => {
      const { error } = await getSupabaseClient().rpc('platform_update_billing_settings', {
        p_default_trial_days: input.defaultTrialDays,
        p_default_monthly_price: input.defaultMonthlyPrice,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return {
    createOrganization,
    createOrganizationWithAdmin,
    assignAdmin,
    switchOrganization,
    extendTrial,
    setPaidUntil,
    setMonthlyPrice,
    setSuspended,
    updateBillingSettings,
  }
}
