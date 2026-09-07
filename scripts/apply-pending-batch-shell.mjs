/**
 * Apply pending batch via Supabase Management API when SUPABASE_ACCESS_TOKEN is set,
 * otherwise emit _pending-batch.json for Cursor MCP execute_sql.
 * Usage: node scripts/apply-pending-batch-shell.mjs [batchN]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const logPath = path.join(outDir, 'batch-apply-log.txt')
const envPath = path.join(__dirname, '..', '.env.local')

function loadEnv() {
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    if (!process.env[key]) process.env[key] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

function completed() {
  if (!fs.existsSync(logPath)) return new Set()
  const done = new Set()
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    const m = line.match(/^OK batch (\d+)\/76/)
    if (m) done.add(parseInt(m[1], 10))
  }
  return done
}

function loadQuery(n) {
  const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
  if (fs.existsSync(payloadPath)) {
    return JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query
  }
  const batchPath = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)
  let sql = fs.readFileSync(batchPath, 'utf8')
  if (n >= 5) {
    sql = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${sql}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
  return sql
}

function log(line) {
  fs.appendFileSync(logPath, line + '\n')
  console.log(line)
}

// Order: 5-44, 45-72, 74, 73, 76 (skip 75)
function batchOrder() {
  const order = []
  for (let n = 5; n <= 44; n++) order.push(n)
  for (let n = 45; n <= 72; n++) order.push(n)
  order.push(74, 73, 76)
  return order
}

const done = completed()
const order = batchOrder()
const requested = process.argv[2] ? parseInt(process.argv[2], 10) : null
const token = process.env.SUPABASE_ACCESS_TOKEN

async function applyQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`)
  return text
}

if (process.argv[2] === 'all' && token) {
  for (const n of order) {
    if (done.has(n)) {
      console.log(`SKIP batch ${n}/76`)
      continue
    }
    const query = loadQuery(n)
    try {
      await applyQuery(query)
      log(`OK batch ${n}/76`)
    } catch (err) {
      log(`FAIL batch ${n}/76: ${err.message}`)
      process.exit(1)
    }
  }
  const verify = await applyQuery(`SELECT 'clients' t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`)
  log('VERIFY: ' + verify)
  process.exit(0)
}

const next = requested ?? order.find((n) => !done.has(n))
if (!next) {
  console.log(JSON.stringify({ allDone: true, done: [...done] }))
  process.exit(0)
}

const query = loadQuery(next)
fs.writeFileSync(path.join(outDir, '_pending-batch.json'), JSON.stringify({ project_id: projectId, query, batch: next }))
console.log(JSON.stringify({ batch: next, queryLen: query.length, token: !!token }))

if (token && process.argv[2] !== 'prepare') {
  try {
    await applyQuery(query)
    log(`OK batch ${next}/76`)
  } catch (err) {
    log(`FAIL batch ${next}/76: ${err.message}`)
    process.exit(1)
  }
}
