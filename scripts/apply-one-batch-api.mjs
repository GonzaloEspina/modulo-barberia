/**
 * Apply one batch via Supabase Management API using query from payload file.
 * Reads query from disk; agent passes token via env for automation.
 * Usage: SUPABASE_ACCESS_TOKEN=... node scripts/apply-one-batch-api.mjs <N>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const n = parseInt(process.argv[2], 10)
const logPath = path.join(outDir, 'batch-apply-log.txt')

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}
if (!n) {
  console.error('Usage: node apply-one-batch-api.mjs <N>')
  process.exit(1)
}

function loadQuery(batch) {
  const payloadPath = path.join(outDir, `_batch-${String(batch).padStart(3, '0')}.payload.json`)
  if (fs.existsSync(payloadPath)) {
    return JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query
  }
  const batchPath = path.join(outDir, `batch-${String(batch).padStart(3, '0')}.sql`)
  let sql = fs.readFileSync(batchPath, 'utf8')
  if (batch >= 5) {
    sql = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${sql}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
  return sql
}

const query = loadQuery(n)
const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
})
const text = await res.text()
if (!res.ok) {
  console.error(`FAIL batch ${n}/76: ${res.status} ${text.slice(0, 500)}`)
  process.exit(1)
}
fs.appendFileSync(logPath, `OK batch ${n}/76\n`)
console.log(`OK batch ${n}/76`)
