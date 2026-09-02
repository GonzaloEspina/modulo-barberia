import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertSupabaseEnv, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/constants'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    assertSupabaseEnv()
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = getSupabaseClient()
    const value = instance[prop as keyof SupabaseClient]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
