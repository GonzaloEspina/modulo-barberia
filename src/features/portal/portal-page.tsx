import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PointsBalance } from '@/components/design-system/points-components'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePortalDashboard, usePortalMutations, usePortalSession } from '@/features/portal/api'
import { PortalAppointments } from '@/features/portal/portal-appointments'
import { PortalBooking } from '@/features/portal/portal-booking'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Pendiente',
  in_progress: 'Pendiente',
  completed: 'Asistió',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
  requested: 'Solicitado',
  approved: 'Aprobado',
  delivered: 'Entregado',
  expired: 'Vencido',
}

export function PortalPage() {
  const qc = useQueryClient()
  const { data: session } = usePortalSession()
  const { data: dashboard, isLoading, error } = usePortalDashboard(session?.token)
  const { login, logout } = usePortalMutations()

  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    setMessage('')
    if (!phone.trim()) {
      setMessage('Ingresá tu teléfono')
      return
    }
    try {
      await login.mutateAsync({ phone })
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  const handleLogout = async () => {
    if (session?.token) {
      await logout.mutateAsync(session.token)
    }
    setMessage('')
  }

  if (session && !error) {
    const showBooking = dashboard?.can_book ?? false

    return (
      <div className="bg-background min-h-screen">
        <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Hola, {session.clientName}</h1>
              <p className="text-muted-foreground text-sm">
                {dashboard?.organization.name ?? 'Portal cliente Barbatero'}
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void handleLogout()}>
              Salir
            </Button>
          </div>

        {isLoading && <p className="text-muted-foreground text-sm">Cargando…</p>}

        {dashboard && (
          <>
            <PortalAppointments
              upcoming={dashboard.upcoming_appointments}
              past={dashboard.past_appointments}
            />

            {showBooking && session.token && (
              <PortalBooking
                sessionToken={session.token}
                onBooked={() => void qc.invalidateQueries({ queryKey: ['portal-dashboard'] })}
              />
            )}

            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-base">Membresías</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {dashboard.memberships.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sin membresías activas.</p>
                ) : (
                  dashboard.memberships.map((m) => (
                    <div key={m.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{m.plan_name}</p>
                      <p className="text-muted-foreground">
                        {m.appointments_remaining}/{m.appointments_total} turnos · vence {m.expires_at}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <PointsBalance balance={dashboard.point_balance} className="rounded-xl" />

            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-base">Canjes</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {dashboard.redemptions.length === 0 ? (
                  <p className="text-muted-foreground">Sin canjes registrados.</p>
                ) : (
                  dashboard.redemptions.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3">
                      <p className="font-medium">{r.reward_name}</p>
                      <p className="text-muted-foreground">
                        Código {r.unique_code} · {r.points_used} pts
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {error && (
          <Card className="rounded-xl">
            <CardContent className="p-4 text-sm text-destructive">
              {(error as Error).message}
              <Button className="mt-3" variant="outline" size="sm" onClick={() => void handleLogout()}>
                Volver a ingresar
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Portal cliente</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Ingresá con el teléfono registrado en el local para ver tus turnos, puntos y membresías.
          </p>
        </div>

        <Card className="rounded-xl shadow-sm">
        <CardHeader><CardTitle>Acceso con teléfono</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              className="rounded-lg"
              placeholder="11 1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleLogin()
              }}
            />
          </div>
          <Button
            className="w-full rounded-lg"
            variant="accent"
            disabled={login.isPending || !phone.trim()}
            onClick={() => void handleLogin()}
          >
            Ingresar
          </Button>
          {message && <p className="text-sm text-destructive">{message}</p>}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
