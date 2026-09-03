import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DateTimePicker } from '@/components/design-system/date-picker'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile } from '@/hooks/use-profile'
import { useRewardMutations, useRewardsAdmin } from '@/features/points/rewards-api'
import { confirmAction } from '@/lib/notify'

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export function RewardsAdminPanel() {
  const { data: profile } = useProfile()
  const { data: rewards } = useRewardsAdmin()
  const { saveReward, deleteReward } = useRewardMutations(profile?.organization_id)

  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [points, setPoints] = useState('100')
  const [stock, setStock] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [maxPerClient, setMaxPerClient] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setPoints('100')
    setStock('')
    setStartsAt('')
    setEndsAt('')
    setMaxPerClient('')
    setEditingId(null)
  }

  const closeForm = () => {
    setFormOpen(false)
    resetForm()
  }

  const buildInput = () => ({
    name: name.trim(),
    description: null,
    points_required: Number(points) || 1,
    reward_type: 'custom_benefit',
    stock: stock.trim() === '' ? null : Number(stock),
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    max_per_client: maxPerClient.trim() === '' ? null : Number(maxPerClient),
    is_active: true,
  })

  const handleSave = async () => {
    if (!name.trim()) return
    await saveReward.mutateAsync({ id: editingId ?? undefined, input: buildInput() })
    closeForm()
  }

  const startEdit = (r: Record<string, unknown>) => {
    setEditingId(r.id as string)
    setName(r.name as string)
    setPoints(String(r.points_required))
    setStock(r.stock == null ? '' : String(r.stock))
    setStartsAt(toDatetimeLocal(r.starts_at as string))
    setEndsAt(toDatetimeLocal(r.ends_at as string))
    setMaxPerClient(r.max_per_client == null ? '' : String(r.max_per_client))
    setFormOpen(true)
  }

  return (
    <Card className="min-w-0 gap-0 overflow-hidden rounded-xl py-0">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="text-sm font-medium">Catálogo de premios</p>
        {!formOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetForm()
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Nuevo premio
          </Button>
        )}
      </div>

      {rewards?.length ? (
        <div className="divide-y">
          {rewards.map((r) => (
            <div
              key={r.id as string}
              className="hover-surface flex items-center gap-2 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{r.name as string}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {r.points_required as number} pts
                  {r.stock != null && ` · stock ${r.stock as number}`}
                  {r.max_per_client != null && ` · máx ${r.max_per_client as number}/cliente`}
                  {!r.is_active && ' · inactivo'}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${r.name as string}`}
                onClick={() => startEdit(r as Record<string, unknown>)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
                aria-label={`Eliminar ${r.name as string}`}
                onClick={() => {
                  void confirmAction('¿Eliminar premio?').then((ok) => {
                    if (ok) void deleteReward.mutateAsync(r.id as string)
                  })
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground px-3 py-3 text-sm">Todavía no hay premios en el catálogo.</p>
      )}

      {formOpen && (
        <div className="grid gap-2 border-t p-3">
          <p className="text-sm font-medium">{editingId ? 'Editar premio' : 'Nuevo premio'}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <Input type="number" placeholder="Puntos" value={points} onChange={(e) => setPoints(e.target.value)} />
            <Input type="number" placeholder="Stock (opcional)" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Vigencia desde</Label>
              <DateTimePicker value={startsAt} onChange={setStartsAt} />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Vigencia hasta</Label>
              <DateTimePicker value={endsAt} onChange={setEndsAt} />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Máx. canjes por cliente</Label>
              <Input type="number" placeholder="Opcional" value={maxPerClient} onChange={(e) => setMaxPerClient(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="accent" size="sm" onClick={() => void handleSave()}>
              {editingId ? 'Guardar' : 'Agregar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={closeForm}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
