import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { getSupabaseClient } from '@/lib/supabase'
import type { Profile } from '@/types/database'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select(
      `
      id,
      organization_id,
      role,
      barber_id,
      full_name,
      permissions,
      is_active,
      organization:organizations (
        id,
        name,
        logo_url,
        phone,
        address,
        timezone,
        currency,
        settings,
        is_active
      ),
      barber:barbers (
        id,
        organization_id,
        user_id,
        name,
        photo_url,
        phone,
        email,
        calendar_color,
        use_general_schedules,
        use_general_services,
        use_general_prices,
        use_general_durations,
        display_order,
        is_active
      )
    `,
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    permissions: data.permissions as Profile['permissions'],
    organization: Array.isArray(data.organization) ? data.organization[0] : data.organization,
    barber: Array.isArray(data.barber) ? (data.barber[0] ?? null) : (data.barber ?? null),
  } as Profile
}

export function useProfile() {
  const { user, isConfigured } = useAuth()

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: isConfigured && !!user?.id,
    staleTime: 60_000,
  })
}

export function isAdminRole(profile: Profile | null | undefined): boolean {
  return profile?.role === 'admin'
}

export function isBarberRole(profile: Profile | null | undefined): boolean {
  return profile?.role === 'barber'
}
