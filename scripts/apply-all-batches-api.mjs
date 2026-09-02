/**
 * Apply all batch payloads via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN in environment.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const progressPath = path.join(__dirname, 'import-progress.txt')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN

function readProgress() {
  if (!fs.existsSync(progressPath)) return 0
  return parseInt(fs.readFileSync(progressPath, 'utf8').trim() || '0', 10) || 0
}

function loadBatch(n) {
  const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
  return JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
}

async function execSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 500)}`)
  return body
}

if (!token) {
  console.log(JSON.stringify({ ok: false, reason: 'SUPABASE_ACCESS_TOKEN not set', next: readProgress() + 1 }))
  process.exit(1)
}

const start = parseInt(process.argv[2] || String(readProgress() + 1), 10)
const end = parseInt(process.argv[3] || '76', 10)

for (let n = start; n <= end; n++) {
  const p = loadBatch(n)
  try {
    await execSql(p.query)
    fs.writeFileSync(progressPath, String(n))
    console.log(`OK batch ${n}/76`)
  } catch (err) {
    console.error(`FAIL batch ${n}/76: ${err.message}`)
    process.exit(1)
  }
}

const verify = await execSql(`
SELECT 'clients' as t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'services', count(*) FROM services WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';
`)
console.log('VERIFY:', verify)
