import { CreditCard, Settings2, Store, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PageHeader } from '@/components/design-system/layout-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  PORTAL_BOOKING_LABELS,
  useAbsenceConfig,
  useOrganizationSettings,
  usePaymentMethodsAdmin,
  usePointsConfigAdmin,
  useSettingsMutations,
  type AbsencePeriodUnit,
  type AbsenceRuleType,
  type OrganizationFormInput,
  type PaymentMethodInput,
} from '@/features/settings/api'
import { useProfile } from '@/hooks/use-profile'
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify'
import { cn } from '@/lib/utils'
import type { OrganizationSettings, PortalBookingMode } from '@/types/database'

const DEFAULT_SETTINGS: OrganizationSettings = {
  appointment_slot_interval_minutes: 15,
  overbooking_requires_reason: true,
  portal_booking_mode: 'disabled',
  default_appointment_status: 'pending',
  privacy_hide_client_names_in_conflicts: true,
  redemption_reversal_expiry_days: 30,
  membership_credit_points: true,
}

const CREDIT_MOMENT_LABELS: Record<string, string> = {
  on_create: 'Al crear el turno',
  on_confirm: 'Al confirmar el turno',
  on_complete: 'Al marcar como completado',
  on_payment: 'Al registrar el pago',
}

const PERIOD_UNIT_LABELS: Record<AbsencePeriodUnit, string> = {
  days: 'Días',
  weeks: 'Semanas',
  months: 'Meses',
}

const selectClass =
  'border-input bg-background flex h-10 w-full rounded-lg border px-3 text-sm'

type PaymentMethodRow = {
  id: string
  name: string
  discount_value: number
  discount_type: string
  auto_apply_discount: boolean
  display_order: number
  is_active: boolean
}

function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('rounded-xl', className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function SettingToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function toPaymentMethodRow(m: Record<string, unknown>): PaymentMethodRow {
  return {
    id: m.id as string,
    name: m.name as string,
    discount_value: Number(m.discount_value ?? 0),
    discount_type: m.discount_type as string,
    auto_apply_discount: Boolean(m.auto_apply_discount),
    display_order: Number(m.display_order ?? 0),
    is_active: Boolean(m.is_active),
  }
}

function buildPaymentPayload(row: PaymentMethodRow): PaymentMethodInput {
  const discount = row.discount_value
  return {
    name: row.name.trim(),
    discount_type: discount > 0 ? 'percentage' : 'none',
    discount_value: discount,
    auto_apply_discount: row.auto_apply_discount,
    display_order: row.display_order,
    is_active: row.is_active,
  }
}

function PaymentMethodItem({
  method,
  onSave,
  onDelete,
  isSaving,
}: {
  method: PaymentMethodRow
  onSave: (id: string, input: PaymentMethodInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
  isSaving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(method.name)
  const [discount, setDiscount] = useState(
    method.discount_value > 0 ? String(method.discount_value) : '',
  )

  useEffect(() => {
    setName(method.name)
    setDiscount(method.discount_value > 0 ? String(method.discount_value) : '')
  }, [method])

  const cancel = () => {
    setName(method.name)
    setDiscount(method.discount_value > 0 ? String(method.discount_value) : '')
    setEditing(false)
  }

  const save = async () => {
    if (!name.trim()) return
    const discountValue = discount.trim() === '' ? 0 : Number(discount)
    await onSave(method.id, {
      ...buildPaymentPayload(method),
      name: name.trim(),
      discount_type: discountValue > 0 ? 'percentage' : 'none',
      discount_value: discountValue,
    })
    setEditing(false)
  }

  const remove = async () => {
    if (!(await confirmAction(`¿Eliminar el método "${method.name}"?`))) return
    await onDelete(method.id)
  }

  if (editing) {
    return (
      <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_120px_auto_auto] sm:items-center">
        <Input className="rounded-lg" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
        <Input
          className="rounded-lg"
          type="number"
          min={0}
          max={100}
          placeholder="Descuento %"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
        <Button variant="outline" size="sm" disabled={isSaving} onClick={() => void save()}>
          Guardar
        </Button>
        <Button variant="ghost" size="sm" onClick={cancel}>
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium">{method.name}</p>
        {method.discount_value > 0 && (
          <p className="text-muted-foreground text-xs">{method.discount_value}% de descuento</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={method.is_active ? 'outline' : 'secondary'}>
          {method.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove()}>
          Eliminar
        </Button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { data: profile } = useProfile()
  const orgId = profile?.organization_id
  const { data: org, isLoading: loadingOrg } = useOrganizationSettings(orgId)
  const { data: pointsConfig } = usePointsConfigAdmin()
  const { data: absenceConfig } = useAbsenceConfig()
  const { data: paymentMethods } = usePaymentMethodsAdmin()
  const {
    updateOrganization,
    updatePointsConfig,
    updateAbsenceConfig,
    savePaymentMethod,
    deletePaymentMethod,
  } = useSettingsMutations(orgId)

  const [form, setForm] = useState<OrganizationFormInput | null>(null)
  const [pointsEnabled, setPointsEnabled] = useState(true)
  const [creditMoment, setCreditMoment] = useState('on_complete')
  const [expirationMonths, setExpirationMonths] = useState(12)
  const [thresholdCount, setThresholdCount] = useState(3)
  const [ruleType, setRuleType] = useState<AbsenceRuleType>('within_period')
  const [periodValue, setPeriodValue] = useState(3)
  const [periodUnit, setPeriodUnit] = useState<AbsencePeriodUnit>('months')
  const [newMethodName, setNewMethodName] = useState('')
  const [newMethodDiscount, setNewMethodDiscount] = useState('')

  useEffect(() => {
    if (!org) return
    setForm({
      name: org.name,
      phone: org.phone ?? '',
      address: org.address ?? '',
      settings: { ...DEFAULT_SETTINGS, ...org.settings },
    })
  }, [org])

  useEffect(() => {
    if (pointsConfig) {
      setPointsEnabled(Boolean(pointsConfig.enabled))
      setCreditMoment(pointsConfig.credit_moment as string)
      setExpirationMonths(Number(pointsConfig.expiration_value ?? 12))
    }
  }, [pointsConfig])

  useEffect(() => {
    if (absenceConfig) {
      setThresholdCount(Number(absenceConfig.threshold_count ?? 3))
      setRuleType((absenceConfig.rule_type as AbsenceRuleType) ?? 'within_period')
      setPeriodValue(Number(absenceConfig.period_value ?? 3))
      setPeriodUnit((absenceConfig.period_unit as AbsencePeriodUnit) ?? 'months')
    }
  }, [absenceConfig])

  if (loadingOrg || !form) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  const setSetting = <K extends keyof OrganizationSettings>(key: K, value: OrganizationSettings[K]) => {
    setForm((prev) => prev && ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }))
  }

  const saveAll = async () => {
    try {
      await updateOrganization.mutateAsync(form)
      await updatePointsConfig.mutateAsync({
        enabled: pointsEnabled,
        expiration_type: 'months',
        expiration_value: expirationMonths,
        credit_moment: creditMoment,
        require_payment_for_credit: false,
      })
      await updateAbsenceConfig.mutateAsync({
        threshold_count: thresholdCount,
        rule_type: ruleType,
        period_value: periodValue,
        period_unit: periodUnit,
        is_active: true,
      })
      notifySuccess('Configuración guardada')
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  const addPaymentMethod = async () => {
    if (!newMethodName.trim()) return
    const discountValue = newMethodDiscount.trim() === '' ? 0 : Number(newMethodDiscount)
    try {
      await savePaymentMethod.mutateAsync({
        input: {
          name: newMethodName.trim(),
          discount_type: discountValue > 0 ? 'percentage' : 'none',
          discount_value: discountValue,
          auto_apply_discount: true,
          display_order: (paymentMethods?.length ?? 0) + 1,
          is_active: true,
        },
      })
      setNewMethodName('')
      setNewMethodDiscount('')
      notifySuccess('Método de pago agregado')
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  const paymentRows = (paymentMethods ?? []).map((m) => toPaymentMethodRow(m as Record<string, unknown>))
  const isSaving = updateOrganization.isPending || updatePointsConfig.isPending || updateAbsenceConfig.isPending

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Configuración"
        description="Datos y reglas de la barbería"
        actions={
          <Button variant="accent" disabled={isSaving} onClick={() => void saveAll()}>
            Guardar cambios
          </Button>
        }
      />

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          <TabsTrigger value="general" className="gap-1.5 rounded-lg">
            <Store className="size-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="turnos" className="gap-1.5 rounded-lg">
            <Settings2 className="size-4" />
            Turnos
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5 rounded-lg">
            <Users className="size-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="pagos" className="gap-1.5 rounded-lg">
            <CreditCard className="size-4" />
            Pagos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <SettingsSection title="Datos generales">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nombre</Label>
                <Input
                  className="rounded-lg"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  className="rounded-lg"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Dirección</Label>
                <Input
                  className="rounded-lg"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="turnos" className="space-y-4">
          <SettingsSection
            title="Turnos y calendario"
            description="Los horarios disponibles se calculan según la duración de los servicios elegidos"
          >
            <div className="space-y-2 sm:max-w-xs">
              <Label>Estado inicial del turno</Label>
              <select
                className={selectClass}
                value={form.settings.default_appointment_status}
                onChange={(e) => setSetting('default_appointment_status', e.target.value)}
              >
                <option value="pending">Pendiente</option>
              </select>
            </div>

            <Separator />

            <div className="space-y-3">
              <SettingToggle
                label="Exigir motivo en sobreturnos"
                checked={form.settings.overbooking_requires_reason}
                onCheckedChange={(v) => setSetting('overbooking_requires_reason', v)}
              />
              <SettingToggle
                label="Ocultar nombres en conflictos de horario"
                description="Los barberos no verán el nombre del otro cliente al detectar solapamientos."
                checked={form.settings.privacy_hide_client_names_in_conflicts}
                onCheckedChange={(v) => setSetting('privacy_hide_client_names_in_conflicts', v)}
              />
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <SettingsSection
            title="Portal cliente"
            description="Acceso con teléfono y política de reservas online"
          >
            <div className="space-y-2">
              <Label>Modo de reservas</Label>
              <select
                className={selectClass}
                value={form.settings.portal_booking_mode}
                onChange={(e) => setSetting('portal_booking_mode', e.target.value as PortalBookingMode)}
              >
                {(Object.keys(PORTAL_BOOKING_LABELS) as PortalBookingMode[]).map((mode) => (
                  <option key={mode} value={mode}>{PORTAL_BOOKING_LABELS[mode]}</option>
                ))}
              </select>
            </div>
            <p className="text-muted-foreground text-xs">
              Los clientes ingresan en /portal con el teléfono registrado. Configurá quién puede reservar turnos online.
            </p>
          </SettingsSection>

          <SettingsSection
            title="Membresías"
            description="Qué pasa cuando un cliente paga un turno con su plan activo"
          >
            <SettingToggle
              label="Sumar puntos aunque pague con membresía"
              description="Si está desactivado, los turnos cobrados con el plan no generan puntos de fidelidad."
              checked={form.settings.membership_credit_points}
              onCheckedChange={(v) => setSetting('membership_credit_points', v)}
            />
          </SettingsSection>

          <SettingsSection
            title="Programa de puntos"
            description="Cómo los clientes acumulan puntos y qué pasa al cancelar un canje"
          >
            <SettingToggle
              label="Programa de puntos activo"
              description="Desactivalo si no querés acumular ni canjear puntos en la barbería."
              checked={pointsEnabled}
              onCheckedChange={setPointsEnabled}
            />

            {pointsEnabled && (
              <>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>¿Cuándo se suman los puntos?</Label>
                    <select
                      className={selectClass}
                      value={creditMoment}
                      onChange={(e) => setCreditMoment(e.target.value)}
                    >
                      {Object.entries(CREDIT_MOMENT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimiento de puntos (meses)</Label>
                    <Input
                      className="rounded-lg"
                      type="number"
                      min={1}
                      value={expirationMonths}
                      onChange={(e) => setExpirationMonths(Number(e.target.value))}
                    />
                    <p className="text-muted-foreground text-xs">
                      Los puntos ganados expiran después de este tiempo si no se usan.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Días de validez al cancelar un canje</Label>
                  <Input
                    className="rounded-lg sm:max-w-xs"
                    type="number"
                    min={1}
                    max={365}
                    value={form.settings.redemption_reversal_expiry_days}
                    onChange={(e) => setSetting('redemption_reversal_expiry_days', Number(e.target.value))}
                  />
                  <p className="text-muted-foreground text-xs">
                    Si cancelás un canje, los puntos devueltos vencen a los tantos días.
                  </p>
                </div>
              </>
            )}
          </SettingsSection>

          <SettingsSection
            title="Inasistencias"
            description="Cuándo marcar a un cliente como faltoso recurrente"
          >
            <div className="space-y-2">
              <Label>Tipo de regla</Label>
              <select
                className={selectClass}
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as AbsenceRuleType)}
              >
                <option value="consecutive">Faltas consecutivas (una tras otra)</option>
                <option value="within_period">Faltas dentro de un período</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cantidad de faltas</Label>
                <Input
                  className="rounded-lg"
                  type="number"
                  min={1}
                  value={thresholdCount}
                  onChange={(e) => setThresholdCount(Number(e.target.value))}
                />
              </div>
              {ruleType === 'within_period' && (
                <>
                  <div className="space-y-2">
                    <Label>Período a revisar</Label>
                    <Input
                      className="rounded-lg"
                      type="number"
                      min={1}
                      value={periodValue}
                      onChange={(e) => setPeriodValue(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 sm:max-w-xs">
                    <Label>Unidad del período</Label>
                    <select
                      className={selectClass}
                      value={periodUnit}
                      onChange={(e) => setPeriodUnit(e.target.value as AbsencePeriodUnit)}
                    >
                      {(Object.keys(PERIOD_UNIT_LABELS) as AbsencePeriodUnit[]).map((unit) => (
                        <option key={unit} value={unit}>{PERIOD_UNIT_LABELS[unit]}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <p className="text-muted-foreground rounded-lg bg-muted/50 p-3 text-xs">
              {ruleType === 'consecutive'
                ? `Se alertará cuando un cliente acumule ${thresholdCount} inasistencias seguidas.`
                : `Se alertará cuando un cliente tenga ${thresholdCount} inasistencias en los últimos ${periodValue} ${PERIOD_UNIT_LABELS[periodUnit].toLowerCase()}.`}
            </p>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4">
          <SettingsSection title="Métodos de pago">
            <div className="space-y-2">
              {paymentRows.map((m) => (
                <PaymentMethodItem
                  key={m.id}
                  method={m}
                  isSaving={savePaymentMethod.isPending}
                  onSave={async (id, input) => {
                    await savePaymentMethod.mutateAsync({ id, input })
                    notifySuccess('Método actualizado')
                  }}
                  onDelete={async (id) => {
                    await deletePaymentMethod.mutateAsync(id)
                    notifySuccess('Método eliminado')
                  }}
                />
              ))}
              {paymentRows.length === 0 && (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  No hay métodos de pago configurados.
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Agregar método</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-center">
                <Input
                  className="rounded-lg"
                  placeholder="Nombre del método"
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                />
                <Input
                  className="rounded-lg"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Descuento %"
                  value={newMethodDiscount}
                  onChange={(e) => setNewMethodDiscount(e.target.value)}
                />
                <Button variant="accent" onClick={() => void addPaymentMethod()}>
                  Agregar
                </Button>
              </div>
            </div>
          </SettingsSection>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pb-4 sm:hidden">
        <Button variant="accent" className="w-full" disabled={isSaving} onClick={() => void saveAll()}>
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
