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
        <header className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-sm">
                <Scissors className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="font-display truncate text-sm font-semibold tracking-wide uppercase">
                  {orgName}
                </p>
                <p className="font-listing text-[11px] tracking-[0.14em] text-sidebar-foreground/60 uppercase">
                  Portal cliente
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-white/10 hover:text-white"
              onClick={() => void handleLogout()}
            >
              <LogOut className="size-4" />
              Salir
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
          <div className="border-b border-border pb-4">
            <h1 className="font-display text-3xl font-semibold tracking-wide uppercase">
              Hola, {greetingName}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Consultá tus puntos, canjes y turnos.
            </p>
          </div>

          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-24 rounded-sm" />
              <Skeleton className="h-64 rounded-sm" />
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
                hasUpcoming={
                  dashboard.has_upcoming_appointment ?? dashboard.upcoming_appointments.length > 0
                }
              />

              {showBooking && session.token && (
                <PortalBooking
                  sessionToken={session.token}
                  redemptions={dashboard.redemptions ?? []}
                  onBooked={() => void qc.invalidateQueries({ queryKey: ['portal-dashboard'] })}
                />
              )}

              {dashboard.memberships.length > 0 && (
                <Card className="gap-3 rounded-sm py-5 shadow-none">
                  <CardHeader className="px-5">
                    <CardTitle className="font-display flex items-center gap-2 text-base font-semibold tracking-wide uppercase">
                      <Ticket className="size-4" aria-hidden />
                      Membresías
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-5">
                    {dashboard.memberships.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-baseline justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                      >
                        <p className="font-medium">{m.plan_name}</p>
                        <p className="text-muted-foreground font-listing text-sm tabular-nums">
                          {m.appointments_remaining}/{m.appointments_total} ·{' '}
                          {formatAppDate(m.expires_at)}
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
    <div className="bg-background flex min-h-screen flex-col">
      <header className="bg-sidebar text-sidebar-foreground px-4 py-8">
        <div className="mx-auto flex max-w-md flex-col items-start gap-3">
          <div className="bg-sidebar-accent text-sidebar-accent-foreground flex size-11 items-center justify-center rounded-sm">
            <Scissors className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-wide uppercase">
              Portal cliente
            </h1>
            <p className="mt-2 max-w-sm text-sm text-sidebar-foreground/75">
              Ingresá con el teléfono registrado en el local para ver tus turnos, puntos y
              membresías.
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="listing-sheet w-full max-w-md rounded-sm p-6">
          <h2 className="font-display text-xl font-semibold tracking-wide">Acceso con teléfono</h2>
          <div className="mt-5 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="portal-phone">Teléfono</Label>
              <Input
                id="portal-phone"
                placeholder="11 1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleLogin()
                }}
              />
            </div>
            <Button
              className="w-full"
              variant="accent"
              disabled={login.isPending}
              onClick={() => void handleLogin()}
            >
              {login.isPending ? 'Ingresando…' : 'Ingresar'}
            </Button>
            {message && <p className="text-sm text-destructive">{message}</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
