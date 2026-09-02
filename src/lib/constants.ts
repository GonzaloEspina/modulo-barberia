export const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE ?? 'America/Argentina/Buenos_Aires'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Organización del portal cliente (MVP single-tenant). */
export const PORTAL_ORG_ID =
  import.meta.env.VITE_PORTAL_ORG_ID ?? 'a0000000-0000-4000-8000-000000000001'

export function assertSupabaseEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local y ejecutá Supabase local.',
    )
  }
}
