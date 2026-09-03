import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useBarberServiceMutations,
  useBarberServices,
} from '@/features/barbers/barber-services-api'
import { useServices } from '@/features/services/api'
import { resolveEffectiveGeneralService } from '@/lib/effective-service'
import { notifyError, confirmAction } from '@/lib/notify'
import type { BarberRecord } from '@/types/barber'
import type { BarberServiceRecord } from '@/types/service'
import { formatServiceDuration, formatServicePrice } from '@/types/service'

interface BarberServicesPanelProps {
  barber: BarberRecord
  organizationId: string
}

interface OverrideDraft {
  is_enabled: boolean
  has_override: boolean
  price_override: string
  duration_override: string
  points_override: string
}

function emptyDraft(): OverrideDraft {
  return {
    is_enabled: true,
    has_override: false,
    price_override: '',
    duration_override: '',
    points_override: '',
  }
}

function draftFromRecord(record: BarberServiceRecord | undefined): OverrideDraft {
  if (!record) return emptyDraft()
  const hasOverride =
    record.price_override != null ||
    record.duration_override != null ||
    record.points_override != null ||
    record.is_enabled === false

  return {
    is_enabled: record.is_enabled,
    has_override: hasOverride,
    price_override: record.price_override?.toString() ?? '',
    duration_override: record.duration_override?.toString() ?? '',
    points_override: record.points_override?.toString() ?? '',
  }
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

export function BarberServicesPanel({ barber, organizationId }: BarberServicesPanelProps) {
  const { data: services } = useServices('', true)
  const { data: barberServices, isLoading } = useBarberServices(barber.id)
  const mutations = useBarberServiceMutations(barber.id, organizationId)

  const overridesByServiceId = useMemo(() => {
    const map = new Map<string, BarberServiceRecord>()
    barberServices
      ?.filter((row) => !row.is_exclusive && row.service_id)
      .forEach((row) => map.set(row.service_id!, row))
    return map
  }, [barberServices])

  const exclusiveServices = useMemo(
    () => barberServices?.filter((row) => row.is_exclusive) ?? [],
    [barberServices],
  )

  const [drafts, setDrafts] = useState<Record<string, OverrideDraft>>({})
  const [showExclusiveForm, setShowExclusiveForm] = useState(false)
  const [exclusiveForm, setExclusiveForm] = useState({
    name: '',
    price: '',
    duration: '30',
    points: '0',
    is_enabled: true,
  })
  const [editingExclusiveId, setEditingExclusiveId] = useState<string | null>(null)

  const getDraft = (serviceId: string, record?: BarberServiceRecord) =>
    drafts[serviceId] ?? draftFromRecord(record)

  const updateDraft = (serviceId: string, patch: Partial<OverrideDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [serviceId]: { ...getDraft(serviceId, overridesByServiceId.get(serviceId)), ...patch },
    }))
  }

  const saveOverride = async (serviceId: string) => {
    const draft = getDraft(serviceId, overridesByServiceId.get(serviceId))

    if (!draft.has_override && overridesByServiceId.has(serviceId)) {
      await mutations.removeOverride.mutateAsync(serviceId)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[serviceId]
        return next
      })
      return
    }

    if (!draft.has_override) return

    await mutations.upsertOverride.mutateAsync({
      service_id: serviceId,
      is_enabled: draft.is_enabled,
      price_override: parseOptionalNumber(draft.price_override),
      duration_override: parseOptionalInt(draft.duration_override),
      points_override: parseOptionalInt(draft.points_override),
    })
  }

  const saveExclusive = async () => {
    const input = {
      exclusive_name: exclusiveForm.name,
      exclusive_price: Number(exclusiveForm.price),
      exclusive_duration: Number.parseInt(exclusiveForm.duration, 10),
      exclusive_points: Number.parseInt(exclusiveForm.points, 10) || 0,
      is_enabled: exclusiveForm.is_enabled,
    }

    if (!input.exclusive_name.trim()) {
      notifyError('El nombre es obligatorio')
      return
    }

    try {
      if (editingExclusiveId) {
        await mutations.updateExclusive.mutateAsync({ id: editingExclusiveId, input })
      } else {
        await mutations.createExclusive.mutateAsync(input)
      }
      setShowExclusiveForm(false)
      setEditingExclusiveId(null)
      setExclusiveForm({ name: '', price: '', duration: '30', points: '0', is_enabled: true })
    } catch (err) {
      notifyError((err as Error).message)
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Cargando servicios del barbero…</p>
  }

  return (
    <Card className="min-w-0 gap-0 overflow-hidden rounded-xl py-0">
      <div className="border-b px-3 py-2.5">
        <p className="text-sm font-medium">Servicios generales</p>
        <p className="text-muted-foreground text-xs">
          {barber.use_general_services
            ? 'Ofrece el catálogo activo. Podés personalizar precio, duración o puntos.'
            : 'No hereda el catálogo: habilitá servicios con valores propios.'}
        </p>
      </div>

      {services?.length ? (
        <div className="divide-y">
          {services.map((service) => {
            const override = overridesByServiceId.get(service.id)
            const draft = getDraft(service.id, override)
            const effective = resolveEffectiveGeneralService({
              barber,
              service,
              override: override ?? null,
            })
            const effectiveLabel = effective.is_available
              ? `${formatServicePrice(effective.price)} · ${formatServiceDuration(effective.duration_minutes)} · ${effective.points_awarded} pts`
              : 'No disponible'
            const generalLabel = `${formatServicePrice(service.price)} · ${formatServiceDuration(service.duration_minutes)} · ${service.points_awarded} pts`

            return (
              <div key={service.id} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{service.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {generalLabel}
                      {override && ` · efectivo ${effectiveLabel}`}
                    </p>
                  </div>
                  {override && (
                    <Badge variant="outline" className="shrink-0">
                      Personalizado
                    </Badge>
                  )}
                  <label className="flex shrink-0 items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      className="size-3.5"
                      checked={draft.has_override}
                      onChange={(e) => {
                        const checked = e.target.checked
                        updateDraft(service.id, { has_override: checked })
                        if (!checked && overridesByServiceId.has(service.id)) {
                          void mutations.removeOverride.mutateAsync(service.id)
                            .then(() => {
                              setDrafts((prev) => {
                                const next = { ...prev }
                                delete next[service.id]
                                return next
                              })
                            })
                            .catch((err) => notifyError((err as Error).message))
                        }
                      }}
                    />
                    Ajustar
                  </label>
                </div>

                {draft.has_override && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-xs sm:col-span-3">
                      <input
                        type="checkbox"
                        className="size-3.5"
                        checked={draft.is_enabled}
                        onChange={(e) => updateDraft(service.id, { is_enabled: e.target.checked })}
                      />
                      Habilitado para este barbero
                    </label>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8"
                        placeholder={service.price.toString()}
                        value={draft.price_override}
                        onChange={(e) => updateDraft(service.id, { price_override: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Duración (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        className="h-8"
                        placeholder={service.duration_minutes.toString()}
                        value={draft.duration_override}
                        onChange={(e) =>
                          updateDraft(service.id, { duration_override: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Puntos</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8"
                        placeholder={service.points_awarded.toString()}
                        value={draft.points_override}
                        onChange={(e) => updateDraft(service.id, { points_override: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mutations.upsertOverride.isPending || mutations.removeOverride.isPending}
                        onClick={() => void saveOverride(service.id).catch((err) => notifyError((err as Error).message))}
                      >
                        Guardar ajuste
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-muted-foreground px-3 py-3 text-sm">No hay servicios en el catálogo.</p>
      )}

      <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Servicios exclusivos</p>
          <p className="text-muted-foreground text-xs">Solo visibles para este barbero.</p>
        </div>
        {!showExclusiveForm && (
          <Button size="sm" variant="outline" onClick={() => setShowExclusiveForm(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Agregar
          </Button>
        )}
      </div>

      {exclusiveServices.length > 0 && (
        <div className="divide-y border-t">
          {exclusiveServices.map((exclusive) => (
            <div key={exclusive.id} className="hover-surface flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{exclusive.exclusive_name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {formatServicePrice(exclusive.exclusive_price ?? 0)} ·{' '}
                  {formatServiceDuration(exclusive.exclusive_duration ?? 0)} ·{' '}
                  {exclusive.exclusive_points ?? 0} pts
                  {!exclusive.is_enabled && ' · deshabilitado'}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Editar ${exclusive.exclusive_name}`}
                onClick={() => {
                  setEditingExclusiveId(exclusive.id)
                  setShowExclusiveForm(true)
                  setExclusiveForm({
                    name: exclusive.exclusive_name ?? '',
                    price: String(exclusive.exclusive_price ?? ''),
                    duration: String(exclusive.exclusive_duration ?? ''),
                    points: String(exclusive.exclusive_points ?? 0),
                    is_enabled: exclusive.is_enabled,
                  })
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive"
                aria-label={`Eliminar ${exclusive.exclusive_name}`}
                disabled={mutations.deleteExclusive.isPending}
                onClick={() => {
                  void confirmAction(`¿Eliminar ${exclusive.exclusive_name}?`).then((ok) => {
                    if (!ok) return
                    void mutations.deleteExclusive.mutateAsync(exclusive.id)
                  })
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showExclusiveForm && (
        <div className="grid gap-2 border-t p-3">
          <p className="text-sm font-medium">{editingExclusiveId ? 'Editar exclusivo' : 'Nuevo exclusivo'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Nombre</Label>
              <Input
                className="h-8"
                value={exclusiveForm.name}
                onChange={(e) => setExclusiveForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio ($)</Label>
              <Input
                type="number"
                min={0}
                className="h-8"
                value={exclusiveForm.price}
                onChange={(e) => setExclusiveForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duración (min)</Label>
              <Input
                type="number"
                min={1}
                className="h-8"
                value={exclusiveForm.duration}
                onChange={(e) => setExclusiveForm((prev) => ({ ...prev, duration: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Puntos</Label>
              <Input
                type="number"
                min={0}
                className="h-8"
                value={exclusiveForm.points}
                onChange={(e) => setExclusiveForm((prev) => ({ ...prev, points: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="size-3.5"
                checked={exclusiveForm.is_enabled}
                onChange={(e) =>
                  setExclusiveForm((prev) => ({ ...prev, is_enabled: e.target.checked }))
                }
              />
              Habilitado
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="accent"
              disabled={mutations.createExclusive.isPending || mutations.updateExclusive.isPending}
              onClick={() => void saveExclusive()}
            >
              {editingExclusiveId ? 'Actualizar' : 'Crear'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowExclusiveForm(false)
                setEditingExclusiveId(null)
                setExclusiveForm({ name: '', price: '', duration: '30', points: '0', is_enabled: true })
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {exclusiveServices.length === 0 && !showExclusiveForm && (
        <p className="text-muted-foreground px-3 py-3 text-sm">Sin servicios exclusivos.</p>
      )}
    </Card>
  )
}
