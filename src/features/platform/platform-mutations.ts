import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

export function usePlatformMutations() {
  const qc = useQueryClient()

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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform-organizations'] }),
  })

  const assignAdmin = useMutation({
    mutationFn: async ({ orgId, email }: { orgId: string; email: string }) => {
      const { error } = await getSupabaseClient().rpc('platform_assign_org_admin', {
        p_org_id: orgId,
        p_email: email,
      })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform-organizations'] }),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform-organizations'] }),
  })

  return { createOrganization, createOrganizationWithAdmin, assignAdmin, switchOrganization }
}
