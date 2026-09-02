/**
 * Apply batches 5-76 by reading payload SQL and invoking Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN in environment.
 * Logs OK batch N/76 to batch-apply-log.txt
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const start = parseInt(process.argv[2] ?? '5', 10)
const end = parseInt(process.argv[3] ?? '76', 10)
const logPath = path.join(outDir, 'batch-apply-log.txt')

function log(line) {
  fs.appendFileSync(logPath, line + '\n')
  console.log(line)
}

function completedBatches() {
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

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}

const done = completedBatches()
for (let n = start; n <= end; n++) {
  if (done.has(n)) {
    console.log(`SKIP batch ${n}/76 (already done)`)
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

const verifyText = await applyQuery(`SELECT 'clients' t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`)
log('VERIFY: ' + verifyText)
