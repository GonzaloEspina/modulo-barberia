import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

export interface PlatformOrganization {
  id: string
  name: string
  phone: string | null
  address: string | null
  timezone: string
  is_active: boolean
  created_at: string
  clients_count: number
  barbers_count: number
  appointments_count: number
}

export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ['platform-admin'],
    queryFn: async () => {
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      if (!user) return false
      const { data, error } = await getSupabaseClient()
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) return false
      return Boolean(data)
    },
    staleTime: 60_000,
  })
}

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: ['platform-organizations'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('platform_list_organizations')
      if (error) throw error
      return (data ?? []) as PlatformOrganization[]
    },
  })
}
