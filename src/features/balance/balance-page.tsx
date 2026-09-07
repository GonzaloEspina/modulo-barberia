import { useQuery } from '@tanstack/react-query'
import { addDays, eachDayOfInterval, endOfMonth, endOfYear, parseISO, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DatePicker } from '@/components/design-system/date-picker'
import { FilterBar } from '@/components/design-system/filter-bar'
import { BoxOfficeBar, EmptyState, PageHeader, SectionHeader } from '@/components/design-system/layout-primitives'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useBarbers } from '@/features/barbers/api'
import { exportBalanceExcel } from '@/features/export/export-utils'
import { usePaymentMethodsAdmin } from '@/features/settings/api'
import { useServices } from '@/features/services/api'
import { APP_TIMEZONE } from '@/lib/constants'
import { getSupabaseClient } from '@/lib/supabase'
import { isAdminRole, useProfile } from '@/hooks/use-profile'
import { formatServicePrice } from '@/types/service'
import { BarChart3 } from 'lucide-react'

interface BalanceFilters {
  from: string
  to: string
  barberId: string
  serviceId: string
  paymentMethodId: string
}

interface BalanceSummary {
  production: number
  cash: number
  expenses: number
  net_profit: number
}

interface DailyBalancePoint {
  date: string
  label: string
  production: number
  cash: number
  expenses: number
}

type DatePreset = 'today' | 'week' | 'month' | 'year'

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
}

function presetRange(preset: DatePreset): Pick<BalanceFilters, 'from' | 'to'> {
  const now = new Date()
  const today = todayIso()
  const zoned = toZonedTime(now, APP_TIMEZONE)

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'week':
      return {
        from: formatInTimeZone(startOfWeek(zoned, { weekStartsOn: 1 }), APP_TIMEZONE, 'yyyy-MM-dd'),
        to: today,
      }
    case 'month':
      return {
        from: formatInTimeZone(startOfMonth(zoned), APP_TIMEZONE, 'yyyy-MM-dd'),
        to: formatInTimeZone(endOfMonth(zoned), APP_TIMEZONE, 'yyyy-MM-dd'),
      }
    case 'year':
      return {
        from: formatInTimeZone(startOfYear(zoned), APP_TIMEZONE, 'yyyy-MM-dd'),
        to: formatInTimeZone(endOfYear(zoned), APP_TIMEZONE, 'yyyy-MM-dd'),
      }
  }
}

function defaultFilters(): BalanceFilters {
  const { from, to } = presetRange('month')
  return { from, to, barberId: '', serviceId: '', paymentMethodId: '' }
}

function formatDayLabel(date: string) {
  return formatInTimeZone(parseISO(`${date}T12:00:00`), APP_TIMEZONE, 'dd/MM')
}

function dayKeyFromTimestamp(value: string) {
  return formatInTimeZone(new Date(value), APP_TIMEZONE, 'yyyy-MM-dd')
}

async function fetchBalanceDaily(
  filters: BalanceFilters,
  barberId: string | null,
): Promise<DailyBalancePoint[]> {
  const supabase = getSupabaseClient()
  const { from, to, serviceId, paymentMethodId } = filters
  const endExclusive = formatInTimeZone(addDays(parseISO(`${to}T12:00:00`), 1), APP_TIMEZONE, 'yyyy-MM-dd')

  let paymentsQuery = supabase
    .from('payments')
    .select('amount, paid_at')
    .is('deleted_at', null)
    .neq('status', 'refunded')
    .gte('paid_at', `${from}T00:00:00`)
    .lt('paid_at', `${endExclusive}T00:00:00`)

  if (barberId) paymentsQuery = paymentsQuery.eq('barber_id', barberId)
  if (paymentMethodId) paymentsQuery = paymentsQuery.eq('payment_method_id', paymentMethodId)

  let expensesQuery = supabase
    .from('expenses')
    .select('amount, expense_date')
    .is('deleted_at', null)
    .gte('expense_date', from)
    .lte('expense_date', to)

  if (barberId) expensesQuery = expensesQuery.or(`barber_id.eq.${barberId},barber_id.is.null`)

  let appointmentsQuery = serviceId
    ? supabase
        .from('appointments')
        .select('starts_at, total_amount, status, appointment_services!inner(service_id)')
        .eq('appointment_services.service_id', serviceId)
    : supabase
        .from('appointments')
        .select('starts_at, total_amount, status')

  appointmentsQuery = appointmentsQuery
    .neq('status', 'cancelled')
    .gte('starts_at', `${from}T00:00:00`)
    .lt('starts_at', `${endExclusive}T00:00:00`)

  if (barberId) appointmentsQuery = appointmentsQuery.eq('barber_id', barberId)

  const [paymentsResult, expensesResult, appointmentsResult, membershipsResult] = await Promise.all([
    paymentsQuery,
    expensesQuery,
    appointmentsQuery,
    !barberId && !serviceId && !paymentMethodId
      ? supabase
          .from('client_memberships')
          .select('price_paid, purchased_at, payment_confirmed')
          .is('deleted_at', null)
          .neq('status', 'cancelled')
          .gte('purchased_at', `${from}T00:00:00`)
          .lt('purchased_at', `${endExclusive}T00:00:00`)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (paymentsResult.error) throw paymentsResult.error
  if (expensesResult.error) throw expensesResult.error
  if (appointmentsResult.error) throw appointmentsResult.error
  if (membershipsResult.error) throw membershipsResult.error

  const buckets = new Map<string, DailyBalancePoint>()

  for (const day of eachDayOfInterval({ start: parseISO(`${from}T12:00:00`), end: parseISO(`${to}T12:00:00`) })) {
    const date = formatInTimeZone(day, APP_TIMEZONE, 'yyyy-MM-dd')
    buckets.set(date, { date, label: formatDayLabel(date), production: 0, cash: 0, expenses: 0 })
  }

  for (const payment of paymentsResult.data ?? []) {
    const date = dayKeyFromTimestamp(payment.paid_at as string)
    const bucket = buckets.get(date)
    if (bucket) bucket.cash += Number(payment.amount ?? 0)
  }

  for (const expense of expensesResult.data ?? []) {
    const date = expense.expense_date as string
    const bucket = buckets.get(date)
    if (bucket) bucket.expenses += Number(expense.amount ?? 0)
  }

  for (const appointment of appointmentsResult.data ?? []) {
    const row = appointment as { starts_at: string; total_amount: number }
    const date = dayKeyFromTimestamp(row.starts_at)
    const bucket = buckets.get(date)
    if (bucket) bucket.production += Number(row.total_amount ?? 0)
  }

  for (const membership of membershipsResult.data ?? []) {
    const row = membership as { purchased_at: string; price_paid: number; payment_confirmed: boolean }
    const date = dayKeyFromTimestamp(row.purchased_at)
    const bucket = buckets.get(date)
    if (!bucket) continue
    const amount = Number(row.price_paid ?? 0)
    bucket.production += amount
    if (row.payment_confirmed) bucket.cash += amount
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function hasDailyChartData(points: DailyBalancePoint[]) {
  return points.some((point) => point.production > 0 || point.cash > 0 || point.expenses > 0)
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoy',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
}

export function BalancePage() {
  const { data: profile } = useProfile()
  const { data: barbers } = useBarbers(false)
  const { data: services } = useServices('', true)
  const { data: paymentMethods } = usePaymentMethodsAdmin()
  const isAdmin = profile && isAdminRole(profile)

  const [appliedFilters, setAppliedFilters] = useState(defaultFilters)
  const [draftFilters, setDraftFilters] = useState(defaultFilters)

  useEffect(() => {
    if (!isAdmin && profile?.barber_id) {
      setDraftFilters((current) => ({ ...current, barberId: profile.barber_id! }))
      setAppliedFilters((current) => ({ ...current, barberId: profile.barber_id! }))
    }
  }, [isAdmin, profile?.barber_id])

  const effectiveBarberId = isAdmin ? (appliedFilters.barberId || null) : (profile?.barber_id ?? null)

  const { data, isLoading } = useQuery({
    queryKey: [
      'balance',
      appliedFilters.from,
      appliedFilters.to,
      effectiveBarberId,
      appliedFilters.serviceId,
      appliedFilters.paymentMethodId,
    ],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('get_balance_summary', {
        p_from: appliedFilters.from,
        p_to: appliedFilters.to,
        p_barber_id: effectiveBarberId,
        p_service_id: appliedFilters.serviceId || null,
        p_payment_method_id: appliedFilters.paymentMethodId || null,
      })
      if (error) throw error
      return (data as BalanceSummary[])[0]
    },
  })

  const { data: dailyBreakdown, isLoading: loadingDaily } = useQuery({
    queryKey: [
      'balance-daily',
      appliedFilters.from,
      appliedFilters.to,
      effectiveBarberId,
      appliedFilters.serviceId,
      appliedFilters.paymentMethodId,
    ],
    queryFn: () => fetchBalanceDaily(appliedFilters, effectiveBarberId),
  })

  const production = Number(data?.production ?? 0)
  const cash = Number(data?.cash ?? 0)
  const expenses = Number(data?.expenses ?? 0)
  const pendingBalance = production - cash
  const cashResult = cash - expenses

  const chartData = useMemo(() => dailyBreakdown ?? [], [dailyBreakdown])
  const hasDailyData = hasDailyChartData(chartData)
  const hasSummaryData = production > 0 || cash > 0 || expenses > 0
  const summaryChartData = useMemo(
    () => [{ label: 'Período', production, cash, expenses }],
    [production, cash, expenses],
  )

  const updateDraft = (patch: Partial<BalanceFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }))
  }

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters })
  }

  const clearFilters = () => {
    const next = defaultFilters()
    if (!isAdmin && profile?.barber_id) {
      next.barberId = profile.barber_id
    }
    setDraftFilters(next)
    setAppliedFilters(next)
  }

  const applyPreset = (preset: DatePreset) => {
    const range = presetRange(preset)
    const next = { ...draftFilters, ...range }
    setDraftFilters(next)
    setAppliedFilters(next)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance"
        description="KPIs y resultados del período"
        actions={
          data ? (
            <Button
              variant="outline"
              onClick={() => exportBalanceExcel(appliedFilters.from, appliedFilters.to, {
                production,
                cash,
                expenses,
                net_profit: cashResult,
              })}
            >
              Exportar Excel
            </Button>
          ) : undefined
        }
      />

      <FilterBar className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="balance-from">Desde</Label>
          <DatePicker
            id="balance-from"
            value={draftFilters.from}
            onChange={(from) => updateDraft({ from })}
          />
        </div>
        <div>
          <Label htmlFor="balance-to">Hasta</Label>
          <DatePicker
            id="balance-to"
            value={draftFilters.to}
            onChange={(to) => updateDraft({ to })}
          />
        </div>
        {isAdmin && (
          <div>
            <Label htmlFor="balance-barber">Barbero</Label>
            <select
              id="balance-barber"
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              value={draftFilters.barberId}
              onChange={(e) => updateDraft({ barberId: e.target.value })}
            >
              <option value="">Todos</option>
              {barbers?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="balance-service">Servicio</Label>
          <select
            id="balance-service"
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            value={draftFilters.serviceId}
            onChange={(e) => updateDraft({ serviceId: e.target.value })}
          >
            <option value="">Todos</option>
            {services?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="balance-payment-method">Método de pago</Label>
          <select
            id="balance-payment-method"
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            value={draftFilters.paymentMethodId}
            onChange={(e) => updateDraft({ paymentMethodId: e.target.value })}
          >
            <option value="">Todos</option>
            {paymentMethods?.map((m) => (
              <option key={m.id as string} value={m.id as string}>{m.name as string}</option>
            ))}
          </select>
        </div>

        <div className="col-span-full flex flex-wrap gap-2">
          {(Object.keys(PRESET_LABELS) as DatePreset[]).map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyPreset(preset)}
            >
              {PRESET_LABELS[preset]}
            </Button>
          ))}
        </div>

        <div className="col-span-full flex flex-wrap gap-2">
          <Button type="button" onClick={applyFilters}>Aplicar</Button>
          <Button type="button" variant="outline" onClick={clearFilters}>Limpiar</Button>
        </div>
      </FilterBar>

      {isLoading ? (
        <Skeleton className="h-28 rounded-sm" />
      ) : (
        <BoxOfficeBar
          left={{ label: 'Producción', value: formatServicePrice(production) }}
          right={{ label: 'Caja', value: formatServicePrice(cash) }}
          note={`Pendiente ${formatServicePrice(pendingBalance)} · Gastos ${formatServicePrice(expenses)} · Resultado ${formatServicePrice(cashResult)}`}
        />
      )}

      {!isLoading && (
        <section>
          <SectionHeader title="Distribución diaria" />
          {loadingDaily ? (
            <Skeleton className="h-[280px] rounded-xl" />
          ) : hasDailyData ? (
            <ChartContainer
              className="aspect-auto min-h-[280px] w-full rounded-xl border bg-card p-4"
              config={{
                production: { label: 'Producción', color: 'var(--chart-1)' },
                cash: { label: 'Cobrado', color: 'var(--chart-2)' },
                expenses: { label: 'Gastos', color: 'var(--chart-5)' },
              }}
            >
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="production" fill="var(--color-production)" radius={4} />
                <Bar dataKey="cash" fill="var(--color-cash)" radius={4} />
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : hasSummaryData ? (
            <ChartContainer
              className="aspect-auto min-h-[280px] w-full rounded-xl border bg-card p-4"
              config={{
                production: { label: 'Producción', color: 'var(--chart-1)' },
                cash: { label: 'Cobrado', color: 'var(--chart-2)' },
                expenses: { label: 'Gastos', color: 'var(--chart-5)' },
              }}
            >
              <BarChart data={summaryChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="production" fill="var(--color-production)" radius={4} />
                <Bar dataKey="cash" fill="var(--color-cash)" radius={4} />
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="Sin movimientos diarios"
              description="No hay cobros, producción ni gastos en el rango seleccionado."
            />
          )}
        </section>
      )}
    </div>
  )
}
