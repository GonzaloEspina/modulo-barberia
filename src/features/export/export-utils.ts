import { formatInTimeZone } from 'date-fns-tz'
import { useAppointments } from '@/features/appointments/api'
import { APP_TIMEZONE } from '@/lib/constants'
import { getClientFullName } from '@/types/client'
import { createProWorkbook, downloadWorkbook } from '@/features/export/excel-pro'

export function exportAppointmentsCsv(from: string, to: string, appointments: Awaited<ReturnType<typeof useAppointments>>['data']) {
  const header = 'Fecha,Hora,Cliente,Barbero,Estado,Total\n'
  const rows = (appointments ?? []).map((a) => {
    const client = a.client ? getClientFullName(a.client) : ''
    return [
      formatInTimeZone(a.starts_at, APP_TIMEZONE, 'yyyy-MM-dd'),
      formatInTimeZone(a.starts_at, APP_TIMEZONE, 'HH:mm'),
      client,
      a.barber?.name ?? '',
      a.status,
      a.total_amount,
    ].join(',')
  })
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `turnos-${from}-${to}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportAppointmentsExcel(from: string, to: string, appointments: Awaited<ReturnType<typeof useAppointments>>['data']) {
  const rows = (appointments ?? []).map((a) => ({
    Fecha: formatInTimeZone(a.starts_at, APP_TIMEZONE, 'yyyy-MM-dd'),
    Hora: formatInTimeZone(a.starts_at, APP_TIMEZONE, 'HH:mm'),
    Cliente: a.client ? getClientFullName(a.client) : '',
    Barbero: a.barber?.name ?? '',
    Estado: a.status,
    Total: Number(a.total_amount),
  }))
  downloadWorkbook(createProWorkbook('Turnos', rows), `turnos-${from}-${to}.xlsx`)
}

export function exportBalanceExcel(
  from: string,
  to: string,
  summary: { production: number; cash: number; expenses: number; net_profit: number },
) {
  const rows = [
    { Concepto: 'Facturación del mes', Monto: summary.production },
    { Concepto: 'Caja', Monto: summary.cash },
    { Concepto: 'Gastos', Monto: summary.expenses },
    { Concepto: 'Ganancia neta', Monto: summary.net_profit },
  ]
  downloadWorkbook(createProWorkbook('Balance', rows), `balance-${from}-${to}.xlsx`)
}

export function exportExpensesExcel(expenses: Array<Record<string, unknown>>) {
  const rows = expenses.map((e) => ({
    Fecha: e.expense_date as string,
    Descripción: e.description as string,
    Monto: Number(e.amount),
    Tipo: e.expense_type as string,
    Comprobante: (e.receipt_url as string) ?? '',
  }))
  downloadWorkbook(createProWorkbook('Gastos', rows), `gastos-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
