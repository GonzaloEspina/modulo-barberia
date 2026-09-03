/**
 * Importa datos desde AppSheet hacia Supabase (Barbatero).
 * Uso:
 *   node scripts/import-appsheet.mjs fetch
 *   node scripts/import-appsheet.mjs sql --out-dir scripts/.import-output
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-appsheet.mjs import
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const APP_ID = 'ce4a9490-cf98-48c5-9dd6-39385b5f7d8f'
const ACCESS_KEY = process.env.APPSHEET_ACCESS_KEY
const ORG_ID = 'a0000000-0000-4000-8000-000000000001'
const BARBER_ID = 'a0000000-0000-4000-8000-000000000002'
const TZ = 'America/Argentina/Buenos_Aires'

const TABLES = [
  'Clientes',
  'Servicios',
  'Membresías',
  'Membresías Activas',
  'Turnos',
  'Pagos',
  'Gastos Fijos',
  'Gastos Mensuales',
]

export function appsheetUuid(rowId) {
  const hash = createHash('sha256').update(`appsheet:${rowId}`).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function pick(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim()
  }
  return ''
}

function parseMoney(value) {
  const n = Number(String(value ?? '0').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function parseDurationMinutes(value) {
  if (!value) return 30
  const parts = String(value).split(':').map(Number)
  if (parts.length >= 2) return Math.max(parts[0] * 60 + parts[1], 5)
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 30
}

function parseUsDate(value) {
  if (!value) return null
  const m = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function parseDateTime(fecha, hora) {
  const date = parseUsDate(fecha)
  if (!date) return null
  let time = hora ? String(hora).trim() : '09:00:00'
  // AppSheet sometimes exports times as HH/MM/SS instead of HH:MM:SS
  time = time.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{1,2})$/, (_, h, m, s) =>
    `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`,
  )
  time = time.slice(0, 8)
  if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) time = '09:00:00'
  return `${date}T${time}`
}

function splitName(full) {
  const parts = String(full ?? 'Sin nombre').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: 'Sin', last: 'Nombre' }
  if (parts.length === 1) return { first: parts[0], last: '.' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function normalizePhone(raw, fallbackId) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return `0000000${fallbackId.slice(-6)}`
  if (digits.startsWith('54')) return digits
  if (digits.length === 10) return `54${digits}`
  if (digits.length === 11 && digits.startsWith('9')) return `54${digits}`
  return `54${digits}`
}

function mapAttendance(value) {
  const v = String(value ?? '').trim().toLowerCase()
  if (v === 'si' || v === 'sí') return 'attended'
  if (v === 'no') return 'no_show'
  return 'pending'
}

function mapTurnoStatus(attendance, startsLocal) {
  if (attendance === 'no_show') return 'no_show'
  if (attendance === 'attended') return 'completed'
  const nowLocal = new Date().toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T')
  return startsLocal > nowLocal.slice(0, 19) ? 'pending' : 'completed'
}

function mapMembershipStatus(value) {
  const v = String(value ?? '').trim().toLowerCase()
  if (v === 'activa') return 'active'
  if (v === 'inactiva') return 'expired'
  if (v === 'agotada') return 'exhausted'
  if (v === 'cancelada') return 'cancelled'
  return 'active'
}

function sqlStr(value) {
  if (value == null) return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlNum(value) {
  if (value == null || Number.isNaN(value)) return '0'
  return String(value)
}

async function fetchTable(tableName) {
  const encoded = encodeURIComponent(tableName)
  const res = await fetch(`https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${encoded}/Action`, {
    method: 'POST',
    headers: {
      ApplicationAccessKey: ACCESS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ Action: 'Find', Properties: { Locale: 'es-AR' } }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AppSheet ${tableName}: ${res.status} ${text}`)
  }
  return res.json()
}

export async function loadAppSheetData() {
  if (!ACCESS_KEY) {
    throw new Error('Definí APPSHEET_ACCESS_KEY para importar desde AppSheet')
  }
  const [clientes, servicios, membresias, membresiasActivas, turnos, pagos, gastosFijos, gastosMensuales] =
    await Promise.all(TABLES.map(fetchTable))

  return {
    clientes,
    servicios,
    membresias,
    membresiasActivas,
    turnos,
    pagos,
    gastosFijos,
    gastosMensuales,
  }
}

export function transformData(data, paymentMethodIds) {
  const serviceByAppsheet = new Map(
    data.servicios.map((s) => [pick(s, 'Row ID'), s]),
  )

  const clients = data.clientes.map((row) => {
    const id = appsheetUuid(pick(row, 'Row ID'))
    const { first, last } = splitName(pick(row, 'Nombre y Apellido', 'Nombre'))
    const phone = normalizePhone(pick(row, 'Teléfono', 'Telefono'), id)
    const multi = pick(row, '¿Puede sacar múltiples turnos?', 'Puede sacar múltiples turnos?')
    return {
      id,
      organization_id: ORG_ID,
      first_name: first,
      last_name: last,
      nickname: pick(row, 'Apodo') || null,
      phone_normalized: phone,
      phone_display: pick(row, 'Teléfono', 'Telefono') || null,
      email: pick(row, 'Correo') || null,
      booking_override: multi.toLowerCase().startsWith('s') ? 'allowed' : 'inherit',
      is_active: true,
    }
  })

  const services = data.servicios.map((row, index) => {
    const id = appsheetUuid(pick(row, 'Row ID'))
    return {
      id,
      organization_id: ORG_ID,
      name: pick(row, 'Servicio') || `Servicio ${index + 1}`,
      description: null,
      price: parseMoney(pick(row, 'Valor')),
      duration_minutes: parseDurationMinutes(pick(row, 'Duración', 'Duracion')),
      points_awarded: 0,
      display_order: index + 1,
      category_color: '#D97706',
      is_active: true,
    }
  })

  const membershipPlans = data.membresias.map((row, index) => {
    const id = appsheetUuid(pick(row, 'Row ID'))
    return {
      id,
      organization_id: ORG_ID,
      name: pick(row, 'Membresía', 'Membresia') || `Plan ${index + 1}`,
      description: null,
      price: parseMoney(pick(row, 'Valor')),
      appointments_included: Number(pick(row, 'Cantidad de Turnos') || 1),
      validity_months: Number(pick(row, 'Meses Activa') || 1),
      display_order: index + 1,
      is_active: true,
    }
  })

  const planNameToId = new Map(membershipPlans.map((p) => [p.name, p.id]))

  const clientMemberships = data.membresiasActivas.map((row) => {
    const id = appsheetUuid(pick(row, 'Row ID'))
    const planName = pick(row, 'Membresía', 'Membresia')
    const startsAt = parseUsDate(pick(row, 'Fecha de Inicio')) ?? '2025-01-01'
    const expiresAt = parseUsDate(pick(row, 'Vencimiento')) ?? startsAt
    const total = Number(pick(row, 'Turnos Restantes') || 0)
    return {
      id,
      organization_id: ORG_ID,
      client_id: appsheetUuid(pick(row, 'Cliente')),
      membership_plan_id: planNameToId.get(planName) ?? membershipPlans[0]?.id ?? null,
      plan_name: planName || 'Membresía',
      price_paid: parseMoney(pick(row, 'Valor')),
      appointments_total: Math.max(total, 1),
      appointments_remaining: Math.max(total, 0),
      payment_confirmed: pick(row, 'Pago Confirmado').toLowerCase().startsWith('s'),
      starts_at: startsAt,
      expires_at: expiresAt,
      status: mapMembershipStatus(pick(row, 'Estado')),
      is_active: true,
    }
  })

  const appointments = []
  const appointmentServices = []

  for (const row of data.turnos) {
    const id = appsheetUuid(pick(row, 'Row ID'))
    const clientId = appsheetUuid(pick(row, 'Cliente ID', 'Cliente'))
    const serviceAppsheetId = pick(row, 'Servicio')
    const service = serviceByAppsheet.get(serviceAppsheetId)
    const startsLocal = parseDateTime(pick(row, 'Fecha'), pick(row, 'Hora', 'Hora Virtual', 'Formato Hora'))
    if (!startsLocal) continue

    const durationMinutes = service
      ? parseDurationMinutes(pick(service, 'Duración', 'Duracion'))
      : parseDurationMinutes(pick(row, 'Fin del turno')) || 30

    const amount = parseMoney(pick(row, 'Valor'))
    const membershipAppsheetId = pick(row, 'Membresía ID', 'Membresia ID')
    const attendance = mapAttendance(pick(row, 'Asistencia'))

    appointments.push({
      id,
      organization_id: ORG_ID,
      client_id: clientId,
      barber_id: BARBER_ID,
      starts_at: startsLocal,
      duration_minutes: durationMinutes,
      subtotal: amount,
      discount_amount: 0,
      total_amount: amount,
      status: mapTurnoStatus(attendance, startsLocal),
      attendance_status: attendance,
      client_membership_id: membershipAppsheetId ? appsheetUuid(membershipAppsheetId) : null,
      membership_turns_consumed: membershipAppsheetId ? 1 : 0,
      creation_channel: 'import',
      is_overbooking: false,
      is_active: true,
    })

    appointmentServices.push({
      organization_id: ORG_ID,
      appointment_id: id,
      service_id: service ? appsheetUuid(pick(service, 'Row ID')) : null,
      service_name: service ? pick(service, 'Servicio') : 'Servicio',
      price_applied: amount,
      duration_applied: durationMinutes,
      points_applied: 0,
      sort_order: 0,
    })
  }

  const payments = []
  for (const row of data.pagos) {
    const amount = parseMoney(pick(row, 'Monto'))
    if (amount <= 0) continue
    const appointmentId = appsheetUuid(pick(row, 'Turno'))
    const appt = appointments.find((a) => a.id === appointmentId)
    if (!appt) continue
    const methodName = pick(row, 'Método de Pago', 'Metodo de Pago').toLowerCase()
    const methodId =
      methodName.includes('transf')
        ? paymentMethodIds.transferencia
        : methodName.includes('tarj')
          ? paymentMethodIds.tarjeta
          : paymentMethodIds.efectivo

    payments.push({
      organization_id: ORG_ID,
      appointment_id: appointmentId,
      client_id: appt.client_id,
      barber_id: BARBER_ID,
      amount,
      discount_applied: 0,
      payment_method_id: methodId,
      status: 'paid',
      paid_at: (() => {
        const raw = pick(row, 'Orden del Pago')
        if (!raw) return new Date().toISOString()
        const m = String(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/)
        if (m) {
          const [, mm, dd, yyyy, t] = m
          return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${t}`
        }
        return String(raw)
      })(),
      notes: pick(row, 'Notas') || null,
      is_active: true,
    })
  }

  const fixedExpenses = data.gastosFijos.map((row) => ({
    organization_id: ORG_ID,
    name: pick(row, 'Ítem', 'Item') || 'Gasto fijo',
    amount: parseMoney(pick(row, 'Monto')),
    imputation_day: 1,
    start_date: parseUsDate(pick(row, 'Desde')) ?? '2025-01-01',
    end_date: null,
    auto_generate: true,
    is_active: pick(row, 'Estado').toLowerCase() !== 'inactivo',
  }))

  const expenses = data.gastosMensuales.map((row) => ({
    organization_id: ORG_ID,
    description: pick(row, 'Ítem', 'Item') || 'Gasto',
    amount: parseMoney(pick(row, 'Monto')),
    expense_date: parseUsDate(pick(row, 'Fecha')) ?? '2025-01-01',
    expense_type: 'general',
    is_active: true,
  }))

  return {
    clients,
    services,
    membershipPlans,
    clientMemberships,
    appointments,
    appointmentServices,
    payments,
    fixedExpenses,
    expenses,
  }
}

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

function buildInsert(table, columns, rows) {
  if (!rows.length) return ''
  const values = rows
    .map((row) => `(${columns.map((c) => {
      const v = row[c]
      if (v === null || v === undefined) return 'NULL'
      if (typeof v === 'number') return sqlNum(v)
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
      return sqlStr(v)
    }).join(', ')})`)
    .join(',\n')
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values}\nON CONFLICT (id) DO NOTHING;`
}

function buildAppointmentInsert(rows) {
  if (!rows.length) return ''
  const values = rows.map((row) => `(
    ${sqlStr(row.id)}::uuid,
    ${sqlStr(row.organization_id)}::uuid,
    ${sqlStr(row.client_id)}::uuid,
    ${sqlStr(row.barber_id)}::uuid,
    (${sqlStr(row.starts_at)}::timestamp AT TIME ZONE '${TZ}'),
    (${sqlStr(row.starts_at)}::timestamp AT TIME ZONE '${TZ}') + (${row.duration_minutes} || ' minutes')::interval,
    ${row.duration_minutes},
    ${sqlStr(row.status)}::public.appointment_status,
    FALSE,
    ${sqlNum(row.subtotal)},
    ${sqlNum(row.discount_amount)},
    ${sqlNum(row.total_amount)},
    ${sqlStr(row.attendance_status)}::public.attendance_status,
    ${row.client_membership_id ? `${sqlStr(row.client_membership_id)}::uuid` : 'NULL'},
    ${row.membership_turns_consumed},
    'import'::public.creation_channel,
    TRUE
  )`).join(',\n')

  return `INSERT INTO appointments (
    id, organization_id, client_id, barber_id, starts_at, ends_at,
    total_duration_minutes, status, is_overbooking,
    subtotal, discount_amount, total_amount, attendance_status,
    client_membership_id, membership_turns_consumed, creation_channel, is_active
  ) VALUES
  ${values}
  ON CONFLICT (id) DO NOTHING;`
}

export function buildSqlBatches(transformed) {
  const batches = []

  batches.push(buildInsert('clients', [
    'id', 'organization_id', 'first_name', 'last_name', 'nickname',
    'phone_normalized', 'phone_display', 'email', 'booking_override', 'is_active',
  ], transformed.clients))

  batches.push(buildInsert('services', [
    'id', 'organization_id', 'name', 'description', 'price', 'duration_minutes',
    'points_awarded', 'display_order', 'category_color', 'is_active',
  ], transformed.services))

  batches.push(buildInsert('membership_plans', [
    'id', 'organization_id', 'name', 'description', 'price', 'appointments_included',
    'validity_months', 'display_order', 'is_active',
  ], transformed.membershipPlans))

  if (transformed.clientMemberships.length) {
    batches.push(`INSERT INTO client_memberships (
    id, organization_id, client_id, membership_plan_id, plan_name, price_paid,
    appointments_total, appointments_remaining, payment_confirmed,
    starts_at, expires_at, status, is_active
  ) VALUES\n${transformed.clientMemberships.map((r) => `(
    ${sqlStr(r.id)}::uuid,
    ${sqlStr(r.organization_id)}::uuid,
    ${sqlStr(r.client_id)}::uuid,
    ${r.membership_plan_id ? `${sqlStr(r.membership_plan_id)}::uuid` : 'NULL'},
    ${sqlStr(r.plan_name)},
    ${sqlNum(r.price_paid)},
    ${sqlNum(r.appointments_total)},
    ${sqlNum(r.appointments_remaining)},
    ${r.payment_confirmed ? 'TRUE' : 'FALSE'},
    ${sqlStr(r.starts_at)}::date,
    ${sqlStr(r.expires_at)}::date,
    ${sqlStr(r.status)}::public.client_membership_status,
    TRUE
  )`).join(',\n')}
  ON CONFLICT (id) DO NOTHING;`)
  }

  for (const part of chunk(transformed.appointments, 80)) {
    batches.push(buildAppointmentInsert(part))
  }

  for (const part of chunk(transformed.appointmentServices, 120)) {
    batches.push(buildInsert('appointment_services', [
      'organization_id', 'appointment_id', 'service_id', 'service_name',
      'price_applied', 'duration_applied', 'points_applied', 'sort_order',
    ], part))
  }

  for (const part of chunk(transformed.payments, 100)) {
    batches.push(buildInsert('payments', [
      'organization_id', 'appointment_id', 'client_id', 'barber_id', 'amount',
      'discount_applied', 'payment_method_id', 'status', 'paid_at', 'notes', 'is_active',
    ], part.map((p) => ({ ...p, paid_at: p.paid_at }))))
  }

  if (transformed.fixedExpenses.length) {
    batches.push(buildInsert('fixed_expenses', [
      'organization_id', 'name', 'amount', 'imputation_day', 'start_date',
      'end_date', 'auto_generate', 'is_active',
    ], transformed.fixedExpenses))
  }

  if (transformed.expenses.length) {
    batches.push(buildInsert('expenses', [
      'organization_id', 'description', 'amount', 'expense_date', 'expense_type', 'is_active',
    ], transformed.expenses))
  }

  return batches.filter(Boolean)
}

async function importWithSupabase(transformed) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const steps = [
    ['clients', transformed.clients],
    ['services', transformed.services],
    ['membership_plans', transformed.membershipPlans],
    ['client_memberships', transformed.clientMemberships],
    ['appointments', transformed.appointments.map((a) => ({
      ...a,
      ends_at: null,
      starts_at: undefined,
    }))],
  ]

  for (const [table, rows] of steps) {
    if (table === 'appointments') {
      for (const part of chunk(transformed.appointments, 100)) {
        const payload = part.map((row) => {
          const starts = new Date(`${row.starts_at}`)
          const ends = new Date(starts.getTime() + row.duration_minutes * 60_000)
          return {
            id: row.id,
            organization_id: row.organization_id,
            client_id: row.client_id,
            barber_id: row.barber_id,
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            total_duration_minutes: row.duration_minutes,
            status: row.status,
            is_overbooking: false,
            subtotal: row.subtotal,
            discount_amount: row.discount_amount,
            total_amount: row.total_amount,
            attendance_status: row.attendance_status,
            client_membership_id: row.client_membership_id,
            membership_turns_consumed: row.membership_turns_consumed,
            creation_channel: 'import',
            is_active: true,
          }
        })
        const { error } = await supabase.from('appointments').upsert(payload, { onConflict: 'id' })
        if (error) throw new Error(`appointments: ${error.message}`)
        console.log(`appointments +${payload.length}`)
      }
      continue
    }

    for (const part of chunk(rows, 200)) {
      const { error } = await supabase.from(table).upsert(part, { onConflict: 'id' })
      if (error) throw new Error(`${table}: ${error.message}`)
      console.log(`${table} +${part.length}`)
    }
  }

  for (const part of chunk(transformed.appointmentServices, 200)) {
    const { error } = await supabase.from('appointment_services').insert(part)
    if (error) throw new Error(`appointment_services: ${error.message}`)
    console.log(`appointment_services +${part.length}`)
  }

  for (const part of chunk(transformed.payments, 200)) {
    const { error } = await supabase.from('payments').insert(part)
    if (error) throw new Error(`payments: ${error.message}`)
    console.log(`payments +${part.length}`)
  }

  for (const part of chunk(transformed.fixedExpenses, 100)) {
    const { error } = await supabase.from('fixed_expenses').insert(part)
    if (error) throw new Error(`fixed_expenses: ${error.message}`)
  }

  for (const part of chunk(transformed.expenses, 100)) {
    const { error } = await supabase.from('expenses').insert(part)
    if (error) throw new Error(`expenses: ${error.message}`)
  }
}

async function main() {
  const mode = process.argv[2] ?? 'fetch'
  const data = await loadAppSheetData()
  console.log('AppSheet:', Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])))

  const paymentMethodIds = {
    efectivo: '28898465-fd97-455f-bfc2-7d05621e1655',
    transferencia: '2bb02e0f-d1dc-438f-ac4e-d97c63e50c90',
    tarjeta: '37d44cd9-1a92-477c-a083-8553e88a6de9',
  }

  const transformed = transformData(data, paymentMethodIds)
  console.log('Transformado:', Object.fromEntries(
    Object.entries(transformed).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
  ))

  if (mode === 'fetch') {
    const outDir = join(__dirname, '.import-output')
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'appsheet-raw.json'), JSON.stringify(data, null, 2))
    await writeFile(join(__dirname, '.import-output', 'transformed.json'), JSON.stringify(transformed, null, 2))
    console.log('Guardado en scripts/.import-output/')
    return
  }

  if (mode === 'sql') {
    const outDir = process.argv.includes('--out-dir')
      ? process.argv[process.argv.indexOf('--out-dir') + 1]
      : join(__dirname, '.import-output')
    await mkdir(outDir, { recursive: true })
    const batches = buildSqlBatches(transformed)
    for (let i = 0; i < batches.length; i++) {
      await writeFile(join(outDir, `batch-${String(i + 1).padStart(3, '0')}.sql`), batches[i])
    }
    console.log(`SQL: ${batches.length} archivos en ${outDir}`)
    return
  }

  if (mode === 'import') {
    await importWithSupabase(transformed)
    console.log('Importación completada')
    return
  }

  if (mode === 'delta-sql') {
    const existingPath = join(__dirname, '.import-output', 'existing-ids.json')
    const { readFile } = await import('node:fs/promises')
    const existing = JSON.parse(await readFile(existingPath, 'utf8'))
    const clientSet = new Set(existing.clients)
    const apptSet = new Set(existing.appointments)
    const memSet = new Set(existing.memberships ?? [])
    const serviceSet = new Set(existing.services ?? [])
    const planSet = new Set(existing.plans ?? [])

    const delta = {
      clients: transformed.clients.filter((r) => !clientSet.has(r.id)),
      services: transformed.services.filter((r) => !serviceSet.has(r.id)),
      membershipPlans: transformed.membershipPlans.filter((r) => !planSet.has(r.id)),
      clientMemberships: transformed.clientMemberships.filter((r) => !memSet.has(r.id)),
      appointments: transformed.appointments.filter((r) => !apptSet.has(r.id)),
      appointmentServices: transformed.appointmentServices.filter((r) => !apptSet.has(r.appointment_id)),
      payments: transformed.payments.filter((r) => !apptSet.has(r.appointment_id)),
      fixedExpenses: [],
      expenses: transformed.expenses.filter((r) => {
        const key = `${r.expense_date}|${r.description}|${r.amount}`
        return !(existing.expenseKeys ?? []).includes(key)
      }),
    }

    console.log('Delta:', Object.fromEntries(
      Object.entries(delta).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
    ))

    const outDir = join(__dirname, '.import-output', 'delta')
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'delta.json'), JSON.stringify({
      clients: delta.clients.length,
      appointments: delta.appointments.length,
      payments: delta.payments.length,
      memberships: delta.clientMemberships.length,
      newClientPhones: delta.clients.map((c) => `${c.first_name} ${c.last_name}`),
    }, null, 2))
    const batches = buildSqlBatches(delta)
    for (let i = 0; i < batches.length; i++) {
      await writeFile(join(outDir, `batch-${String(i + 1).padStart(3, '0')}.sql`), batches[i])
    }
    console.log(`Delta SQL: ${batches.length} archivos en ${outDir}`)
    return
  }

  throw new Error(`Modo desconocido: ${mode}`)
}

if (process.argv[1] && process.argv[1].includes('import-appsheet')) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
