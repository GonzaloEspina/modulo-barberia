import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { FilterBar } from '@/components/design-system/filter-bar'
import { MetricCard } from '@/components/design-system/metric-card'
import { PageHeader, SectionHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useBarbers } from '@/features/barbers/api'
import { exportBalanceExcel } from '@/features/export/export-utils'
import { usePaymentMethodsAdmin } from '@/features/settings/api'
import { useServices } from '@/features/services/api'
import { getSupabaseClient } from '@/lib/supabase'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { formatServicePrice } from '@/types/service'
import { CircleDollarSign, Receipt, TrendingUp, Wallet } from 'lucide-react'

export function BalancePage() {
  const { data: profile } = useProfile()
  const { data: barbers } = useBarbers(false)
  const { data: services } = useServices('', true)
  const { data: paymentMethods } = usePaymentMethodsAdmin()
  const isAdmin = profile && isAdminRole(profile)

  const [from, setFrom] = useState('2026-01-01')
  const [to, setTo] = useState('2026-12-31')
  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')

  useEffect(() => {
    if (!isAdmin && profile?.barber_id) {
      setBarberId(profile.barber_id)
    }
  }, [isAdmin, profile?.barber_id])

  const effectiveBarberId = isAdmin ? (barberId || null) : (profile?.barber_id ?? null)

  const { data, isLoading } = useQuery({
    queryKey: ['balance', from, to, effectiveBarberId, serviceId, paymentMethodId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_balance_summary', {
        p_from: from,
        p_to: to,
        p_barber_id: effectiveBarberId,
        p_service_id: serviceId || null,
        p_payment_method_id: paymentMethodId || null,
      })
      if (error) throw error
      return (data as Array<{ production: number; cash: number; expenses: number; net_profit: number }>)[0]
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance"
        description="KPIs y resultados del período"
        actions={
          data ? (
            <Button
              variant="outline"
              onClick={() => exportBalanceExcel(from, to, {
                production: Number(data.production ?? 0),
                cash: Number(data.cash ?? 0),
                expenses: Number(data.expenses ?? 0),
                net_profit: Number(data.net_profit ?? 0),
              })}
            >
              Exportar Excel
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <div><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {isAdmin && (
          <div>
            <Label>Barbero</Label>
            <select
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              value={barberId}
              onChange={(e) => setBarberId(e.target.value)}
            >
              <option value="">Todos</option>
              {barbers?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label>Servicio</Label>
          <select
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Todos</option>
            {services?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Método de pago</Label>
          <select
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
          >
            <option value="">Todos</option>
            {paymentMethods?.map((m) => (
              <option key={m.id as string} value={m.id as string}>{m.name as string}</option>
            ))}
          </select>
        </div>
      </FilterBar>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Facturación del mes" value={formatServicePrice(Number(data?.production ?? 0))} icon={TrendingUp} />
          <MetricCard label="Cobrado" value={formatServicePrice(Number(data?.cash ?? 0))} icon={Wallet} />
          <MetricCard label="Gastos" value={formatServicePrice(Number(data?.expenses ?? 0))} icon={Receipt} />
          <MetricCard label="Ganancia neta" value={formatServicePrice(Number(data?.net_profit ?? 0))} icon={CircleDollarSign} />
        </div>
      )}

      {!isLoading && data && (
        <section>
          <SectionHeader title="Distribución del período" />
          <ChartContainer
            className="min-h-[280px] w-full rounded-xl border bg-card p-4"
            config={{
              production: { label: 'Facturación del mes', color: 'var(--chart-1)' },
              cash: { label: 'Cobrado', color: 'var(--chart-2)' },
              expenses: { label: 'Gastos', color: 'var(--chart-5)' },
              net_profit: { label: 'Ganancia', color: 'var(--chart-3)' },
            }}
          >
            <BarChart
              data={[
                {
                  name: 'Período',
                  production: Number(data.production ?? 0),
                  cash: Number(data.cash ?? 0),
                  expenses: Number(data.expenses ?? 0),
                  net_profit: Number(data.net_profit ?? 0),
                },
              ]}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="production" fill="var(--color-production)" radius={4} />
              <Bar dataKey="cash" fill="var(--color-cash)" radius={4} />
              <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
              <Bar dataKey="net_profit" fill="var(--color-net_profit)" radius={4} />
            </BarChart>
          </ChartContainer>
        </section>
      )}
    </div>
  )
}
