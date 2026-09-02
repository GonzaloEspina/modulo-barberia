import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

export interface OrgUser {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  barber_id: string | null
  barber_name: string | null
  is_active: boolean
  created_at: string
}

export function useOrgUsers(includeInactive = false) {
  return useQuery({
    queryKey: ['org-users', includeInactive],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('org_list_users', {
        p_include_inactive: includeInactive,
      })
      if (error) throw error
      return (data ?? []) as OrgUser[]
    },
  })
}

export function useOrgUserMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['org-users'] })
    void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    void queryClient.invalidateQueries({ queryKey: ['barbers'] })
  }

  const createUser = useMutation({
    mutationFn: async (input: {
      email: string
      password: string
      full_name: string
      role: UserRole
      barber_id?: string | null
    }) => {
      const { data, error } = await getSupabaseClient().rpc('org_create_user', {
        p_email: input.email,
        p_password: input.password,
        p_full_name: input.full_name,
        p_role: input.role,
        p_barber_id: input.role === 'barber' ? input.barber_id ?? null : null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  const updateUser = useMutation({
    mutationFn: async (input: {
      user_id: string
      full_name?: string
      role?: UserRole
      barber_id?: string | null
      is_active?: boolean
    }) => {
      const { error } = await getSupabaseClient().rpc('org_update_user', {
        p_user_id: input.user_id,
        p_full_name: input.full_name ?? null,
        p_role: input.role ?? null,
        p_barber_id: input.barber_id ?? null,
        p_is_active: input.is_active ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const setPassword = useMutation({
    mutationFn: async (input: { user_id: string; password: string }) => {
      const { error } = await getSupabaseClient().rpc('org_set_user_password', {
        p_user_id: input.user_id,
        p_password: input.password,
      })
      if (error) throw error
    },
  })

  return { createUser, updateUser, setPassword }
}
