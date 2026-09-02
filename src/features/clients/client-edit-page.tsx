import { useQuery } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus, Phone } from 'lucide-react'
import { AppointmentCard } from '@/components/design-system/appointment-components'
import { ClientWarning } from '@/components/design-system/client-warning'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { PointsBalance, PointsMovementList } from '@/components/design-system/points-components'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientPortalAccessPanel } from '@/features/clients/client-portal-access-panel'
import { useClientAbsenceWarning } from '@/features/clients/absence-api'
import { ClientForm } from '@/features/clients/client-form'
import { clientFormValuesToInput } from '@/features/clients/client-form-mapper'
import { useClient, useClientMutations } from '@/features/clients/api'
import { useClientPointBalance, useRedemptions } from '@/features/points/api'
import { useProfile } from '@/hooks/use-profile'
import { APP_TIMEZONE } from '@/lib/constants'
import { notifyError, notifySuccess } from '@/lib/notify'
import { getSupabaseClient } from '@/lib/supabase'
import { getClientFullName } from '@/types/client'
import type { Appointment, AppointmentStatus } from '@/types/appointment'

function useClientAppointments(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-appointments', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('appointments')
        .select(`
          id, starts_at, ends_at, status, total_amount,
          barber:barbers(name, calendar_color),
          client:clients(first_name, last_name, phone_display)
        `)
        .eq('client_id', clientId!)
        .neq('status', 'cancelled')
        .order('starts_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
  })
}

function useClientPointMovements(clientId: string | undefined) {
  return useQuery({
    queryKey: ['point-movements', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('point_movements')
        .select('quantity, reason, created_at, movement_type')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
  })
}

export function ClientEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: client, isLoading, isError } = useClient(id)
  const { data: absenceWarning } = useClientAbsenceWarning(id)
  const { data: balance } = useClientPointBalance(id)
  const { data: appointments, isLoading: loadingAppointments } = useClientAppointments(id)
  const { data: movements } = useClientPointMovements(id)
  const { data: redemptions } = useRedemptions()
  const { updateClient } = useClientMutations(profile?.organization_id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (isError || !client) {
    return (
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Cliente no encontrado</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  const fullName = getClientFullName(client)
  const clientRedemptions = (redemptions ?? []).filter((r) => r.client_id === client.id)
  const upcoming = (appointments ?? []).filter((a) => new Date(a.starts_at as string) >= new Date())
  const past = (appointments ?? []).filter((a) => new Date(a.starts_at as string) < new Date())

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        description={
          client.nickname
            ? `${client.nickname} · ${client.phone_display ?? client.phone_normalized}`
            : (client.phone_display ?? client.phone_normalized)
        }
        actions={
          <Button variant="accent" asChild>
            <Link to={`/turnos/nuevo?client=${client.id}`}>
              <CalendarPlus className="size-4" />
              Nuevo turno
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <Avatar className="size-14 rounded-xl">
          <AvatarFallback className="rounded-xl text-lg">
            {client.first_name.slice(0, 1)}{client.last_name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="flex items-center gap-2 text-sm">
            <Phone className="text-muted-foreground size-4" />
            {client.phone_display ?? client.phone_normalized}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {balance?.balance ?? 0} puntos disponibles
          </p>
        </div>
      </div>

      {absenceWarning?.warning && (
        <ClientWarning
          message={
            absenceWarning.message
              ?? `Cliente con ${absenceWarning.absence_count} inasistencias registradas.`
          }
        />
      )}

      <Tabs defaultValue="resumen">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="turnos">Turnos</TabsTrigger>
          <TabsTrigger value="puntos">Puntos</TabsTrigger>
          <TabsTrigger value="canjes">Canjes</TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-base">Próximo turno</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {upcoming[0] ? (
                  formatInTimeZone(upcoming[0].starts_at as string, APP_TIMEZONE, 'dd/MM/yyyy HH:mm')
                ) : (
                  <span className="text-muted-foreground">Sin turnos próximos</span>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardHeader><CardTitle className="text-base">Último turno</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {past[0] ? (
                  formatInTimeZone(past[0].starts_at as string, APP_TIMEZONE, 'dd/MM/yyyy HH:mm')
                ) : (
                  <span className="text-muted-foreground">Sin historial</span>
                )}
              </CardContent>
            </Card>
          </div>
          <PointsBalance
            balance={balance?.balance ?? 0}
            nextExpiresAt={balance?.next_expires_at}
          />
          <ClientPortalAccessPanel phoneDisplay={client.phone_display} />
        </TabsContent>

        <TabsContent value="turnos" className="mt-4 space-y-3">
          {loadingAppointments ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : appointments?.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin turnos registrados.</p>
          ) : (
            appointments?.map((a) => {
              const barber = Array.isArray(a.barber) ? a.barber[0] : a.barber
              const cardAppointment: Appointment = {
                id: a.id as string,
                organization_id: client.organization_id,
                client_id: client.id,
                barber_id: '',
                starts_at: a.starts_at as string,
                ends_at: a.ends_at as string,
                total_duration_minutes: 0,
                subtotal: Number(a.total_amount),
                discount_amount: 0,
                total_amount: Number(a.total_amount),
                status: a.status as AppointmentStatus,
                attendance_status: 'pending',
                client_membership_id: null,
                membership_turns_consumed: 0,
                is_overbooking: false,
                overbooking_reason: null,
                notes: null,
                creation_channel: 'panel',
                cancelled_at: null,
                cancellation_reason: null,
                client,
                barber: barber ?? undefined,
              }
              return (
                <AppointmentCard key={a.id as string} appointment={cardAppointment} />
              )
            })
          )}
        </TabsContent>

        <TabsContent value="puntos" className="mt-4 space-y-4">
          <PointsBalance
            balance={balance?.balance ?? 0}
            nextExpiresAt={balance?.next_expires_at}
          />
          <PointsMovementList
            movements={(movements ?? []).map((m) => ({
              quantity: Number(m.quantity),
              label: String(m.reason ?? m.movement_type ?? 'Movimiento'),
              date: formatInTimeZone(m.created_at as string, APP_TIMEZONE, 'dd/MM/yyyy'),
            }))}
          />
        </TabsContent>

        <TabsContent value="canjes" className="mt-4 space-y-3">
          {clientRedemptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin canjes para este cliente.</p>
          ) : (
            clientRedemptions.map((r) => (
              <Card key={r.id} className="rounded-xl">
                <CardContent className="p-4 text-sm">
                  <p className="font-medium">
                    {Array.isArray(r.rewards) ? r.rewards[0]?.name : r.rewards?.name} · {r.unique_code}
                  </p>
                  <p className="text-muted-foreground">{r.points_used} pts · {r.status}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="datos" className="mt-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Datos del cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientForm
                client={client}
                isSubmitting={updateClient.isPending}
                onCancel={() => navigate('/clientes')}
                onSubmit={async (values) => {
                  try {
                    await updateClient.mutateAsync({
                      id: client.id,
                      input: clientFormValuesToInput(values),
                    })
                    notifySuccess('Cliente actualizado')
                    navigate('/clientes')
                  } catch (err) {
                    notifyError((err as Error).message)
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
