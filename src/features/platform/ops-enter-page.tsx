import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { getSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export function OpsEnterPage() {
  const { session, isLoading, isConfigured } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const ticket = params.get('ticket') ?? ''
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConfigured || isLoading) return
    if (!session) return
    if (!ticket) {
      setError('Falta el ticket de acceso.')
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: orgId, error: claimError } = await supabase.rpc(
          'platform_claim_ops_handoff',
          { p_ticket: ticket, p_expected_module: 'barberia' },
        )
        if (claimError) throw claimError
        if (!orgId) throw new Error('No se pudo validar el ticket')

        const { error: switchError } = await supabase.rpc('platform_switch_organization', {
          p_org_id: orgId,
        })
        if (switchError) throw switchError

        if (!cancelled) navigate('/', { replace: true })
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'No se pudo entrar')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isConfigured, isLoading, session, ticket, navigate])

  if (!isConfigured) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Supabase no configurado.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Cargando sesión…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
        <p className="text-sm">Iniciá sesión como Superadmin para continuar.</p>
        <Button asChild>
          <Link to="/login" state={{ from: { pathname: '/ops/enter', search: `?ticket=${ticket}` } }}>
            Ir a login
          </Link>
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
        <p className="text-destructive text-sm">{error}</p>
        <Button asChild variant="outline">
          <Link to="/plataforma/organizaciones">Volver a plataforma</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <p className="text-muted-foreground text-sm">Entrando al sistema…</p>
    </div>
  )
}
