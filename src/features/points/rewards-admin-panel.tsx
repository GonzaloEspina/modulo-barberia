import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    resetForm()
  }

  const startEdit = (r: Record<string, unknown>) => {
    setEditingId(r.id as string)
    setName(r.name as string)
    setPoints(String(r.points_required))
    setStock(r.stock == null ? '' : String(r.stock))
    setStartsAt(toDatetimeLocal(r.starts_at as string))
    setEndsAt(toDatetimeLocal(r.ends_at as string))
    setMaxPerClient(r.max_per_client == null ? '' : String(r.max_per_client))
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Catálogo de premios</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {rewards?.map((r) => (
          <div key={r.id as string} className="hover-surface flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <span>
              {r.name as string} · {r.points_required as number} pts
              {r.stock != null && <span className="text-muted-foreground"> · stock {r.stock as number}</span>}
              {r.max_per_client != null && <span className="text-muted-foreground"> · máx {r.max_per_client as number}/cliente</span>}
              {!r.is_active && <span className="text-muted-foreground"> · inactivo</span>}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => startEdit(r as Record<string, unknown>)}>Editar</Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  void confirmAction('¿Eliminar premio?').then((ok) => {
                    if (ok) void deleteReward.mutateAsync(r.id as string)
                  })
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ))}

        <div className="grid gap-3 border-t pt-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <Input type="number" placeholder="Puntos" value={points} onChange={(e) => setPoints(e.target.value)} />
            <Input type="number" placeholder="Stock (opcional)" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Vigencia desde</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vigencia hasta</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Máx. canjes por cliente</Label>
              <Input type="number" placeholder="Opcional" value={maxPerClient} onChange={(e) => setMaxPerClient(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void handleSave()}>
              {editingId ? 'Actualizar' : 'Agregar'}
            </Button>
            {editingId && <Button variant="ghost" onClick={resetForm}>Cancelar</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
