import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ExpenseCard } from '@/components/design-system/expense-card'
import { PageHeader, SectionHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notifySuccess } from '@/lib/notify'
import { getSupabaseClient } from '@/lib/supabase'
import { useProfile } from '@/hooks/use-profile'
import { formatServicePrice } from '@/types/service'
import { exportExpensesExcel } from '@/features/export/export-utils'
import { ReceiptUploadButton } from '@/components/receipt-upload-button'

export function ExpensesPage() {
  const { data: profile } = useProfile()
  const qc = useQueryClient()
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [fixedName, setFixedName] = useState('')
  const [fixedAmount, setFixedAmount] = useState('')
  const [fixedDay, setFixedDay] = useState('1')
  const [lastExpenseId, setLastExpenseId] = useState<string | null>(null)

  const { data: expenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('expenses')
        .select('*')
        .is('deleted_at', null)
        .order('expense_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: fixedExpenses } = useQuery({
    queryKey: ['fixed-expenses'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('fixed_expenses')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().from('expenses').insert({
        organization_id: profile!.organization_id,
        description: desc,
        amount: Number(amount),
        expense_date: date,
      }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] })
      setDesc('')
      setAmount('')
    },
  })

  const createFixed = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseClient().from('fixed_expenses').insert({
        organization_id: profile!.organization_id,
        name: fixedName.trim(),
        amount: Number(fixedAmount),
        imputation_day: Number(fixedDay),
        start_date: new Date().toISOString().slice(0, 10),
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fixed-expenses'] })
      setFixedName('')
      setFixedAmount('')
    },
  })

  const generateFixed = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('generate_fixed_expenses')
      if (error) throw error
      return data as number
    },
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: ['expenses'] })
      notifySuccess(`Generados ${n} gastos fijos`)
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos"
        description="Registro de gastos puntuales y fijos"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportExpensesExcel(expenses ?? [])}>
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={() => void generateFixed.mutateAsync()}>
              Generar fijos del mes
            </Button>
          </div>
        }
      />

      <Card className="rounded-xl">
        <CardHeader><CardTitle>Gasto puntual</CardTitle></CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <Input className="rounded-lg" placeholder="Descripción" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Input className="rounded-lg" type="number" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input className="rounded-lg" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button variant="accent" onClick={() => void create.mutateAsync().then((id) => setLastExpenseId(id))}>Agregar</Button>
        </CardContent>
      </Card>

      {lastExpenseId && profile && (
        <Card className="rounded-xl">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <span>Gasto registrado. Podés adjuntar el comprobante:</span>
            <ReceiptUploadButton
              organizationId={profile.organization_id}
              folder="expenses"
              entityId={lastExpenseId}
              onUploaded={() => {
                void qc.invalidateQueries({ queryKey: ['expenses'] })
                setLastExpenseId(null)
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl">
        <CardHeader><CardTitle>Gastos fijos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            {fixedExpenses?.map((f) => (
              <div key={f.id as string} className="hover-surface flex justify-between rounded-lg border p-3 text-sm">
                <span>{f.name as string} (día {f.imputation_day as number})</span>
                <span>{formatServicePrice(Number(f.amount))}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Input className="rounded-lg" placeholder="Nombre" value={fixedName} onChange={(e) => setFixedName(e.target.value)} />
            <Input className="rounded-lg" type="number" placeholder="Monto" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
            <div className="space-y-1">
              <Label className="text-xs">Día del mes</Label>
              <Input className="rounded-lg" type="number" min={1} max={28} value={fixedDay} onChange={(e) => setFixedDay(e.target.value)} />
            </div>
            <Button variant="outline" className="self-end" onClick={() => void createFixed.mutateAsync()}>
              Agregar fijo
            </Button>
          </div>
        </CardContent>
      </Card>

      <section>
        <SectionHeader title="Historial" />
        <div className="grid gap-2">
          {expenses?.map((e) => (
            <div key={e.id as string} className="space-y-2">
              <ExpenseCard
                description={e.description as string}
                amount={Number(e.amount)}
                date={e.expense_date as string}
                type={e.expense_type === 'from_fixed' ? 'fixed' : 'general'}
              />
              {profile && (
                <div className="flex justify-end px-1">
                  <ReceiptUploadButton
                    organizationId={profile.organization_id}
                    folder="expenses"
                    entityId={e.id as string}
                    onUploaded={() => void qc.invalidateQueries({ queryKey: ['expenses'] })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
