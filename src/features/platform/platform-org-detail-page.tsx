import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, SectionHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { billingPhaseLabel, usePlatformOrganization } from '@/features/platform/api'
import { usePlatformMutations } from '@/features/platform/platform-mutations'

function addMonthsIso(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function PlatformOrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const { data: org, isLoading, error } = usePlatformOrganization(orgId)
  const {
    switchOrganization,
    extendTrial,
    setPaidUntil,
    setMonthlyPrice,
    setSuspended,
  } = usePlatformMutations()

  const [trialDays, setTrialDays] = useState('14')
  const [paidUntil, setPaidUntilValue] = useState('')
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')

  const phaseClass = useMemo(() => {
    switch (org?.billing_phase) {
      case 'trial':
        return 'text-amber-700'
      case 'active':
        return 'text-green-700'
      case 'expired':
        return 'text-orange-700'
      case 'suspended':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }, [org?.billing_phase])

  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />
  }

  if (error || !org) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">{(error as Error)?.message ?? 'No encontrada'}</p>
        <Button asChild variant="outline">
          <Link to="/plataforma/organizaciones">Volver</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        description="Gestión Superadmin de la barbería (trial, cobro y acceso)."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/plataforma/organizaciones">
              <ArrowLeft className="mr-1 size-4" />
              Volver
            </Link>
          </Button>
        }
      />

      {message && <p className="text-sm">{message}</p>}

      <Card>
        <CardContent className="space-y-3 pt-6 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`font-semibold ${phaseClass}`}>{billingPhaseLabel(org.billing_phase)}</span>
            <span className="text-muted-foreground">
              Trial hasta {org.trial_ends_on ?? '—'} · Pagado hasta {org.paid_until ?? '—'}
            </span>
          </div>
          <p>Precio mensual: ${Number(org.monthly_price).toLocaleString('es-AR')}</p>
          <div className="flex flex-wrap gap-3">
            <span>{org.clients_count} clientes</span>
            <span>{org.barbers_count} barberos</span>
            <span>{org.appointments_count} turnos</span>
          </div>
          <Button
            variant="accent"
            size="sm"
            disabled={switchOrganization.isPending}
            onClick={() => void switchOrganization.mutateAsync(org.id)}
          >
            Entrar a esta barbería
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <SectionHeader title="Extender prueba" />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Días</Label>
              <Input value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="w-28" />
            </div>
            <Button
              variant="outline"
              disabled={extendTrial.isPending}
              onClick={() =>
                void (async () => {
                  setMessage('')
                  try {
                    const next = await extendTrial.mutateAsync({
                      orgId: org.id,
                      days: Number(trialDays) || 14,
                    })
                    setMessage(`Trial extendido hasta ${next}`)
                  } catch (e) {
                    setMessage((e as Error).message)
                  }
                })()
              }
            >
              Extender trial
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <SectionHeader title="Acceso pago" />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Pagado hasta</Label>
              <Input
                type="date"
                value={paidUntil || org.paid_until || addMonthsIso(1)}
                onChange={(e) => setPaidUntilValue(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={setPaidUntil.isPending}
              onClick={() =>
                void (async () => {
                  setMessage('')
                  try {
                    const value = paidUntil || org.paid_until || addMonthsIso(1)
                    const next = await setPaidUntil.mutateAsync({ orgId: org.id, paidUntil: value })
                    setMessage(`Acceso pago hasta ${next}`)
                  } catch (e) {
                    setMessage((e as Error).message)
                  }
                })()
              }
            >
              Guardar paid until
            </Button>
            <Button
              variant="outline"
              disabled={setPaidUntil.isPending}
              onClick={() =>
                void (async () => {
                  setMessage('')
                  try {
                    const next = await setPaidUntil.mutateAsync({
                      orgId: org.id,
                      paidUntil: addMonthsIso(1),
                    })
                    setMessage(`Marcado pago hasta ${next}`)
                  } catch (e) {
                    setMessage((e as Error).message)
                  }
                })()
              }
            >
              +1 mes desde hoy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <SectionHeader title="Precio mensual" />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>ARS</Label>
              <Input
                type="number"
                min={0}
                step="100"
                value={price || String(org.monthly_price ?? 0)}
                onChange={(e) => setPrice(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="outline"
              disabled={setMonthlyPrice.isPending}
              onClick={() =>
                void (async () => {
                  setMessage('')
                  try {
                    const next = await setMonthlyPrice.mutateAsync({
                      orgId: org.id,
                      price: Number(price || org.monthly_price || 0),
                    })
                    setMessage(`Precio actualizado: $${next}`)
                  } catch (e) {
                    setMessage((e as Error).message)
                  }
                })()
              }
            >
              Guardar precio
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <SectionHeader title="Servicio" />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="destructive"
              disabled={setSuspended.isPending || org.billing_phase === 'suspended'}
              onClick={() =>
                void (async () => {
                  setMessage('')
                  try {
                    await setSuspended.mutateAsync({ orgId: org.id, suspended: true })
                    setMessage('Barbería suspendida')
                  } catch (e) {
                    setMessage((e as Error).message)
                  }
                })()
              }
            >
              Suspender
            </Button>
            <Button
              variant="outline"
              disabled={setSuspended.isPending || org.billing_phase !== 'suspended'}
              onClick={() =>
                void (async () => {
                  setMessage('')
                  try {
                    await setSuspended.mutateAsync({ orgId: org.id, suspended: false })
                    setMessage('Barbería reactivada')
                  } catch (e) {
                    setMessage((e as Error).message)
                  }
                })()
              }
            >
              Reactivar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
