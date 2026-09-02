/**
 * Apply import batches 5-76 via Supabase Management API (same as MCP execute_sql).
 * Requires SUPABASE_ACCESS_TOKEN, or run through Cursor MCP manually.
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

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}

const log = (line) => {
  fs.appendFileSync(logPath, line + '\n')
  console.log(line)
}

for (let n = start; n <= end; n++) {
  const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
  const p = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: p.query }),
  })
  if (!res.ok) {
    const text = await res.text()
    log(`FAIL batch ${n}/76: ${res.status} ${text.slice(0, 200)}`)
    process.exit(1)
  }
  log(`OK batch ${n}/76`)
}

const verifyRes = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `SELECT 'clients' t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`,
  }),
})
const verify = await verifyRes.text()
log('VERIFY: ' + verify)
