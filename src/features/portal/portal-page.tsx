import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Scissors, Ticket } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortalDashboard, usePortalMutations, usePortalSession } from '@/features/portal/api'
import { PortalAppointments } from '@/features/portal/portal-appointments'
import { PortalBooking } from '@/features/portal/portal-booking'
import { PortalPoints } from '@/features/portal/portal-points'
import { formatAppDate } from '@/lib/app-datetime'

function portalGreetingName(sessionName: string, firstName?: string | null) {
  const first = firstName?.trim()
  if (first) return first
  return sessionName.trim()
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
    const showBooking =
      (dashboard?.can_book ?? false) && !(dashboard?.has_upcoming_appointment ?? false)
    const orgName = dashboard?.organization.name ?? 'Barbatero'
    const greetingName = portalGreetingName(session.clientName, dashboard?.client.first_name)

    return (
      <div className="bg-background min-h-screen">
        <header className="bg-card/90 sticky top-0 z-20 border-b backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Scissors className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{orgName}</p>
                <p className="text-muted-foreground text-xs">Portal cliente</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void handleLogout()}>
              <LogOut className="size-4" />
              Salir
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Hola, {greetingName}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Consultá tus puntos, canjes y turnos.
            </p>
          </div>

          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-24 rounded-xl bg-muted" />
              <Skeleton className="h-64 rounded-xl bg-muted" />
            </div>
          )}

          {dashboard && (
            <>
              <PortalPoints
                sessionToken={session.token}
                balance={Number(dashboard.point_balance) || 0}
                nextExpiresAt={dashboard.point_next_expires_at}
                rewards={dashboard.rewards ?? []}
                redemptions={dashboard.redemptions ?? []}
              />

              <PortalAppointments
                upcoming={dashboard.upcoming_appointments}
                past={dashboard.past_appointments}
                canBook={showBooking}
                hasUpcoming={dashboard.has_upcoming_appointment ?? dashboard.upcoming_appointments.length > 0}
              />

              {showBooking && session.token && (
                <PortalBooking
                  sessionToken={session.token}
                  redemptions={dashboard.redemptions ?? []}
                  onBooked={() => void qc.invalidateQueries({ queryKey: ['portal-dashboard'] })}
                />
              )}

              {dashboard.memberships.length > 0 && (
                <Card className="gap-3 py-5 shadow-sm">
                  <CardHeader className="px-5">
                    <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                      <Ticket className="size-4" aria-hidden />
                      Membresías
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-5">
                    {dashboard.memberships.map((m) => (
                      <div key={m.id}>
                        <p className="font-medium">{m.plan_name}</p>
                        <p className="text-muted-foreground text-sm">
                          {m.appointments_remaining}/{m.appointments_total} turnos · vence {formatAppDate(m.expires_at)}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground mb-4 flex size-12 items-center justify-center rounded-xl shadow-sm">
            <Scissors className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Portal cliente</h1>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Ingresá con el teléfono registrado en el local para ver tus turnos, puntos y membresías.
          </p>
        </div>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Acceso con teléfono</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="portal-phone">Teléfono</Label>
              <Input
                id="portal-phone"
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
              {login.isPending ? 'Ingresando…' : 'Ingresar'}
            </Button>
            {message && <p className="text-sm text-destructive">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
