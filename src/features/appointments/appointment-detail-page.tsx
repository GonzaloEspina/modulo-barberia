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
import { usePaymentMethods, usePaymentMutations, usePayments, usePaymentSummary } from '@/features/payments/api'
import { ReceiptUploadButton } from '@/components/receipt-upload-button'
import { useProfile } from '@/hooks/use-profile'
import { APP_TIMEZONE } from '@/lib/constants'
import { notifyError } from '@/lib/notify'
import { confirmAction } from '@/lib/notify'
import { validatePaymentAmount } from '@/lib/payment'
import {
  ATTENDANCE_STATUS_LABELS,
  type AppointmentStatus,
  type AttendanceStatus,
} from '@/types/appointment'
import { formatServicePrice } from '@/types/service'

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

  const [payAmount, setPayAmount] = useState('')

  const [payMethodId, setPayMethodId] = useState('')

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

  const clientName = appt.client
    ? `${appt.client.first_name} ${appt.client.last_name}`
    : 'Cliente'

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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={clientName}
        description={`${formatInTimeZone(appt.starts_at, APP_TIMEZONE, 'dd/MM/yyyy HH:mm')} · ${appt.barber?.name}`}
      />

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex flex-wrap gap-2">
            <AppointmentStatusBadge status={appt.status} />
            <Badge variant="outline">{ATTENDANCE_STATUS_LABELS[appt.attendance_status]}</Badge>
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
          <p className="font-semibold">Total: {formatServicePrice(Number(appt.total_amount))}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
              value={appt.status}
              onChange={(e) =>
                void updateStatus.mutateAsync({ id: appt.id, status: e.target.value })
              }
            >
              {(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] as AppointmentStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
              value={appt.attendance_status}
              onChange={(e) =>
                void updateStatus.mutateAsync({ id: appt.id, attendance: e.target.value })
              }
            >
              {(Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[]).map((s) => (
                <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {appt.status !== 'cancelled' && (
            <Button
              variant="outline"
              onClick={() => {
                void confirmAction('¿Cancelar turno?').then((ok) => {
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
  )
}
