import { formatInTimeZone } from 'date-fns-tz'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppointmentStatusBadge } from '@/components/design-system/status-badges'
import { PaymentStatus } from '@/components/design-system/payment-status'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppointment, useAppointmentMutations } from '@/features/appointments/api'
import { AppointmentCouponField } from '@/features/appointments/appointment-coupon-field'
import { usePaymentMethods, usePaymentMutations, usePayments, usePaymentSummary } from '@/features/payments/api'
import {
  useAppointmentCoupon,
  useAppointmentCouponMutations,
  useClientAvailableCoupons,
} from '@/features/points/api'
import { ReceiptUploadButton } from '@/components/receipt-upload-button'
import { useProfile } from '@/hooks/use-profile'
import { APP_TIMEZONE } from '@/lib/constants'
import { notifyError, notifySuccess } from '@/lib/notify'
import { confirmAction } from '@/lib/notify'
import { validatePaymentAmount } from '@/lib/payment'
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_OPTIONS,
  visibleAppointmentStatus,
  type AppointmentStatus,
} from '@/types/appointment'
import { formatServicePrice } from '@/types/service'
import { getClientFullName } from '@/types/client'

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: appt, isLoading } = useAppointment(id)
  const { cancelAppointment, updateStatus } = useAppointmentMutations()
  const { data: summary } = usePaymentSummary(id)
  const { data: payments } = usePayments(id)
  const { data: methods } = usePaymentMethods()
  const { registerPayment } = usePaymentMutations()
  const { data: appliedCoupon } = useAppointmentCoupon(id)
  const { data: clientCoupons } = useClientAvailableCoupons(appt?.client_id)
  const { applyCoupon } = useAppointmentCouponMutations()

  const [payAmount, setPayAmount] = useState('')
  const [payMethodId, setPayMethodId] = useState('')
  const [redemptionId, setRedemptionId] = useState('')
  const [couponCode, setCouponCode] = useState('')

  useEffect(() => {
    if (summary?.pending_amount != null) {
      setPayAmount(String(summary.pending_amount))
    }
  }, [summary?.pending_amount])

  if (isLoading || !appt) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  const clientName = appt.client ? getClientFullName(appt.client) : 'Cliente'

  const handleApplyCoupon = async () => {
    if (!appt) return
    if (!redemptionId && !couponCode.trim()) {
      notifyError('Seleccioná un cupón o ingresá el código')
      return
    }
    try {
      await applyCoupon.mutateAsync({
        appointmentId: appt.id,
        redemptionId: redemptionId || null,
        code: redemptionId ? null : couponCode.trim(),
      })
      notifySuccess('Cupón aplicado')
      setRedemptionId('')
      setCouponCode('')
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  const handlePay = async () => {
    const amount = Number(payAmount)
    const err = validatePaymentAmount(amount, summary?.pending_amount ?? 0)
    if (err) { notifyError(err); return }
    if (!payMethodId) { notifyError('Seleccioná método de pago'); return }
    try {
      await registerPayment.mutateAsync({
        appointment_id: appt.id,
        payment_method_id: payMethodId,
        amount,
      })
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={clientName}
        description={`${formatInTimeZone(appt.starts_at, APP_TIMEZONE, 'dd/MM/yyyy HH:mm')} · ${appt.barber?.name}`}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card className="min-w-0 rounded-xl">
        <CardHeader>
          <CardTitle className="flex flex-wrap gap-2">
            <AppointmentStatusBadge status={appt.status} />
            {appt.is_overbooking && <Badge variant="warning">Sobreturno</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm">
            {appt.appointment_services?.map((s) => (
              <li key={s.id} className="flex justify-between gap-4 py-1">
                <span>{s.service_name}</span>
                <span>{formatServicePrice(Number(s.price_applied))}</span>
              </li>
            ))}
          </ul>
          {Number(appt.discount_amount) > 0 && (
            <p className="text-success text-sm">
              Descuento: -{formatServicePrice(Number(appt.discount_amount))}
            </p>
          )}
          <p className="font-semibold">Total: {formatServicePrice(Number(appt.total_amount))}</p>

          {appliedCoupon ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium">{appliedCoupon.reward_name}</p>
              <p className="text-muted-foreground">
                Código {appliedCoupon.unique_code}
              </p>
            </div>
          ) : appt.status !== 'cancelled' ? (
            <div className="space-y-2">
              <AppointmentCouponField
                coupons={clientCoupons ?? []}
                redemptionId={redemptionId}
                code={couponCode}
                onRedemptionIdChange={setRedemptionId}
                onCodeChange={setCouponCode}
                disabled={applyCoupon.isPending}
              />
              <Button
                type="button"
                variant="outline"
                disabled={applyCoupon.isPending || (!redemptionId && !couponCode.trim())}
                onClick={() => void handleApplyCoupon()}
              >
                {applyCoupon.isPending ? 'Aplicando…' : 'Aplicar cupón'}
              </Button>
            </div>
          ) : null}

          <div>
            <Label htmlFor="appointment-status">Estado</Label>
            <select
              id="appointment-status"
              className="border-input bg-background mt-1.5 h-10 w-full rounded-lg border px-3 text-sm"
              value={visibleAppointmentStatus(appt.status)}
              onChange={(e) => {
                const next = e.target.value as AppointmentStatus
                if (next === 'cancelled') {
                  void confirmAction('¿Cancelar turno? Se libera el horario.').then((ok) => {
                    if (!ok) return
                    void cancelAppointment.mutateAsync({ id: appt.id, reason: 'Cancelado desde panel' })
                  })
                  return
                }
                void updateStatus.mutateAsync({ id: appt.id, status: next })
              }}
            >
              {APPOINTMENT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {appt.status !== 'cancelled' && (
            <Button
              variant="outline"
              onClick={() => {
                void confirmAction('¿Cancelar turno? Se libera el horario.').then((ok) => {
                  if (!ok) return
                  void cancelAppointment.mutateAsync({ id: appt.id, reason: 'Cancelado desde panel' })
                    .then(() => navigate('/turnos'))
                })
              }}
            >
              Cancelar turno
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-4">
      <PaymentStatus
        total={Number(appt.total_amount)}
        paid={Number(summary?.paid_amount ?? 0)}
        pending={Number(summary?.pending_amount ?? 0)}
        status={summary?.payment_status ?? 'pending'}
      />

      <Card className="rounded-xl">
        <CardHeader><CardTitle>Registrar pago</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(summary?.pending_amount ?? 0) > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input type="number" className="rounded-lg" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Método</Label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-lg border px-3 text-sm"
                  value={payMethodId}
                  onChange={(e) => setPayMethodId(e.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {methods?.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <Button variant="accent" onClick={() => void handlePay()}>Registrar pago</Button>
            </div>
          )}

          <ul className="space-y-2 text-sm">
            {payments?.map((p) => {
              const row = p as { id: string; amount: number; receipt_url?: string | null; payment_methods?: { name: string } | { name: string }[] | null }
              const methodName = Array.isArray(row.payment_methods)
                ? row.payment_methods[0]?.name
                : row.payment_methods?.name
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <span>
                    {formatServicePrice(Number(row.amount))} — {methodName}
                  </span>
                  {profile && (
                    <ReceiptUploadButton
                      organizationId={profile.organization_id}
                      folder="payments"
                      entityId={row.id}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  )
}
