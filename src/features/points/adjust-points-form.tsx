import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePointsMutations } from '@/features/points/api'
import { confirmAction, notifyError, notifySuccess } from '@/lib/notify'
import { cn } from '@/lib/utils'

interface AdjustPointsFormProps {
  clientId: string
  clientName?: string
  currentBalance: number
  className?: string
}

export function AdjustPointsForm({
  clientId,
  clientName,
  currentBalance,
  className,
}: AdjustPointsFormProps) {
  const { adjustPoints } = usePointsMutations()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const quantity = Number.parseInt(amount, 10)

  const apply = async (direction: 'credit' | 'debit') => {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      notifyError('Indicá una cantidad entera mayor a 0')
      return
    }
    if (direction === 'debit' && quantity > currentBalance) {
      notifyError('El cliente no tiene puntos suficientes')
      return
    }

    const verb = direction === 'credit' ? 'Sumar' : 'Restar'
    const who = clientName ? ` a ${clientName}` : ''
    if (!(await confirmAction(`¿${verb} ${quantity} puntos${who}?`))) return

    try {
      const nextBalance = await adjustPoints.mutateAsync({
        clientId,
        quantity: direction === 'credit' ? quantity : -quantity,
        reason: reason.trim() || null,
      })
      notifySuccess(`Saldo actualizado: ${nextBalance} pts`)
      setAmount('')
      setReason('')
    } catch (e) {
      notifyError((e as Error).message)
    }
  }

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-end', className)}>
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor="adjust-points-amount" className="text-xs">Cantidad</Label>
        <Input
          id="adjust-points-amount"
          type="number"
          min={1}
          step={1}
          className="h-9 rounded-lg"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Ej: 50"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor="adjust-points-reason" className="text-xs">Motivo (opcional)</Label>
        <Input
          id="adjust-points-reason"
          className="h-9 rounded-lg"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: cortesía, corrección"
        />
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <Label className="text-xs opacity-0" aria-hidden>
          Acciones
        </Label>
        <div className="grid h-9 grid-cols-2 gap-2">
          <Button
            type="button"
            variant="accent"
            className="h-9 w-full border border-transparent"
            disabled={adjustPoints.isPending}
            onClick={() => void apply('credit')}
          >
            {adjustPoints.isPending ? 'Guardando…' : 'Sumar'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full"
            disabled={adjustPoints.isPending}
            onClick={() => void apply('debit')}
          >
            Restar
          </Button>
        </div>
      </div>
    </div>
  )
}
