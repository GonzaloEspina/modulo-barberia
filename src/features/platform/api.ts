import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { getSupabaseClient } from '@/lib/supabase'

export type BillingPhase = 'trial' | 'active' | 'expired' | 'suspended'

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
  trial_ends_on: string | null
  paid_until: string | null
  monthly_price: number
  suspended_at: string | null
  billing_phase: BillingPhase
}

export interface PlatformOrganizationDetail extends PlatformOrganization {
  suspend_when_unpaid: boolean
}

export interface PlatformBillingSettings {
  default_trial_days: number
  default_monthly_price: number
}

export function billingPhaseLabel(phase: BillingPhase) {
  switch (phase) {
    case 'trial':
      return 'Prueba'
    case 'active':
      return 'Activa'
    case 'expired':
      return 'Vencida'
    case 'suspended':
      return 'Suspendida'
    default:
      return phase
  }
}

export function useIsPlatformAdmin() {
  const { user, isConfigured } = useAuth()

  return useQuery({
    queryKey: ['platform-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false
      const { data, error } = await getSupabaseClient()
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) return false
      return Boolean(data)
    },
    enabled: isConfigured && !!user?.id,
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

export function usePlatformOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: ['platform-organization', orgId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('platform_get_organization', {
        p_org_id: orgId,
      })
      if (error) throw error
      const row = (data as PlatformOrganizationDetail[] | null)?.[0]
      if (!row) throw new Error('Organización no encontrada')
      return row
    },
    enabled: Boolean(orgId),
  })
}

export function usePlatformBillingSettings() {
  return useQuery({
    queryKey: ['platform-billing-settings'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('platform_billing_settings')
        .select('default_trial_days, default_monthly_price')
        .eq('id', true)
        .maybeSingle()
      if (error) throw error
      return (data ?? {
        default_trial_days: 14,
        default_monthly_price: 0,
      }) as PlatformBillingSettings
    },
  })
}
