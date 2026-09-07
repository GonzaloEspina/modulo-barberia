/**
 * Apply batches 5-76 using pg direct connection (DATABASE_URL) or Management API (SUPABASE_ACCESS_TOKEN).
 * Loads .env.local automatically.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const envPath = path.join(__dirname, '..', '.env.local')
const projectId = 'fqhisghfuuexfhqqdqcb'
const start = parseInt(process.argv[2] ?? '5', 10)
const end = parseInt(process.argv[3] ?? '76', 10)
const logPath = path.join(outDir, 'batch-apply-log.txt')

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

function log(line) {
  fs.appendFileSync(logPath, line + '\n')
  console.log(line)
}

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

async function applyQuery(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl) {
    const pg = await import('pg')
    const client = new pg.default.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
      await client.query(query)
    } finally {
      await client.end()
    }
    return
  }

  if (token) {
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

  throw new Error('Set DATABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local')
}

const done = completed()
for (let n = start; n <= end; n++) {
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

const verifyQ = `SELECT 'clients' t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`
const verify = await applyQuery(verifyQ)
log('VERIFY: ' + (typeof verify === 'string' ? verify : JSON.stringify(verify)))
