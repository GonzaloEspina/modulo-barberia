import { PageHeader } from '@/components/design-system/layout-primitives'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBarbers } from '@/features/barbers/api'
import {
  useScheduleExceptionMutations,
  useScheduleExceptions,
} from '@/features/schedules/exceptions-api'
import { useProfile } from '@/hooks/use-profile'
import { notifyError, confirmAction } from '@/lib/notify'
import type { ScheduleException, ScheduleExceptionInput } from '@/types/schedule'
import { formatTimeRange, getDayLabel } from '@/types/schedule'

const emptyForm = (): ScheduleExceptionInput => ({
  exception_type: 'block',
  scope: 'organization',
  barber_id: null,
  start_date: '',
  end_date: '',
  start_time: null,
  end_time: null,
  reason: '',
  is_active: true,
})

function ExceptionSummary({ item }: { item: ScheduleException }) {
  const scopeLabel = item.scope === 'organization' ? 'Toda la barbería' : 'Barbero específico'
  const timeLabel =
    item.start_time && item.end_time
      ? formatTimeRange(item.start_time, item.end_time)
      : 'Día completo'

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{item.reason || 'Sin motivo'}</p>
        <Badge variant={item.exception_type === 'block' ? 'destructive' : 'outline'}>
          {item.exception_type === 'block' ? 'Bloqueo' : 'Habilitación'}
        </Badge>
        {!item.is_active && <Badge variant="secondary">Inactivo</Badge>}
      </div>
      <p className="text-muted-foreground text-sm">
        {item.start_date}
        {item.end_date !== item.start_date ? ` → ${item.end_date}` : ''} · {timeLabel} · {scopeLabel}
      </p>
    </div>
  )
}

export function ScheduleExceptionsPage() {
  const { data: profile } = useProfile()
  const { data: exceptions, isLoading } = useScheduleExceptions()
  const { data: barbers } = useBarbers(false)
  const { createException, updateException, deleteException } = useScheduleExceptionMutations(
    profile?.organization_id,
  )

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ScheduleException | null>(null)
  const [form, setForm] = useState<ScheduleExceptionInput>(emptyForm())
  const [fullDay, setFullDay] = useState(true)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFullDay(true)
    setShowForm(true)
  }

  const openEdit = (item: ScheduleException) => {
    setEditing(item)
    setForm({
      exception_type: item.exception_type,
      scope: item.scope,
      barber_id: item.barber_id,
      start_date: item.start_date,
      end_date: item.end_date,
      start_time: item.start_time,
      end_time: item.end_time,
      reason: item.reason ?? '',
      is_active: item.is_active,
    })
    setFullDay(!item.start_time && !item.end_time)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date) {
      notifyError('Completá las fechas')
      return
    }

    const payload: ScheduleExceptionInput = {
      ...form,
      start_time: fullDay ? null : form.start_time ?? '09:00:00',
      end_time: fullDay ? null : form.end_time ?? '18:00:00',
    }

    try {
      if (editing) {
        await updateException.mutateAsync({ id: editing.id, input: payload })
      } else {
        await createException.mutateAsync(payload)
      }
      setShowForm(false)
      setEditing(null)
    } catch (err) {
      notifyError((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Excepciones de agenda"
        description="Bloqueos o habilitaciones especiales por fecha (feriados, cierres, aperturas)."
        actions={
          <Button variant="accent" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nueva excepción
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Editar excepción' : 'Nueva excepción'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  value={form.exception_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      exception_type: e.target.value as ScheduleExceptionInput['exception_type'],
                    }))
                  }
                >
                  <option value="block">Bloqueo</option>
                  <option value="allow">Habilitación especial</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Alcance</Label>
                <select
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  value={form.scope}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      scope: e.target.value as ScheduleExceptionInput['scope'],
                      barber_id: e.target.value === 'organization' ? null : prev.barber_id,
                    }))
                  }
                >
                  <option value="organization">Toda la barbería</option>
                  <option value="barber">Barbero específico</option>
                </select>
              </div>
            </div>

            {form.scope === 'barber' && (
              <div className="space-y-2">
                <Label>Barbero</Label>
                <select
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  value={form.barber_id ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, barber_id: e.target.value || null }))
                  }
                >
                  <option value="">Seleccionar…</option>
                  {barbers?.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={fullDay}
                onChange={(e) => setFullDay(e.target.checked)}
              />
              Afecta el día completo
            </label>

            {!fullDay && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Desde hora</Label>
                  <Input
                    type="time"
                    value={(form.start_time ?? '09:00:00').slice(0, 5)}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, start_time: `${e.target.value}:00` }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hasta hora</Label>
                  <Input
                    type="time"
                    value={(form.end_time ?? '18:00:00').slice(0, 5)}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, end_time: `${e.target.value}:00` }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                rows={2}
                value={form.reason ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              Activa
            </label>

            <div className="flex gap-2">
              <Button variant="accent" onClick={() => void handleSubmit()}>
                {editing ? 'Guardar cambios' : 'Crear excepción'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Cargando excepciones…</p>}

      <div className="grid gap-3">
        {exceptions?.map((item) => (
          <Card key={item.id} className="hover-surface">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <ExceptionSummary item={item} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deleteException.isPending}
                  onClick={() => {
                    void confirmAction('¿Eliminar esta excepción?').then((ok) => {
                      if (!ok) return
                      void deleteException.mutateAsync(item.id)
                    })
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && exceptions?.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No hay excepciones configuradas.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referencia días ISO</CardTitle>
          <CardDescription>
            {getDayLabel(1)} = 1 … {getDayLabel(7)} = 7 (convención del sistema).
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
