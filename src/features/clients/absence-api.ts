import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

export interface AbsenceWarning {
  warning: boolean
  absence_count: number
  threshold: number
  rule_type: string
  message: string | null
}

export function useClientAbsenceWarning(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-absence-warning', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_client_absence_warning', {
        p_client_id: clientId!,
      })
      if (error) throw error
      return data as AbsenceWarning
    },
  })
}
