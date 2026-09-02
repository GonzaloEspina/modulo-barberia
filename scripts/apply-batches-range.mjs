/**
 * Apply batches start-end via Supabase Management API (same as MCP execute_sql).
 * Set SUPABASE_ACCESS_TOKEN. Logs OK batch N/76.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

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

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required for automated apply')
  process.exit(1)
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
  if (!res.ok) {
    throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`)
  }
}

for (let n = start; n <= end; n++) {
  spawnSync(process.execPath, [path.join(__dirname, 'emit-batch-mcp-args.mjs'), String(n)], {
    stdio: 'inherit',
  })
  const emitPath = path.join(outDir, `_emit-batch-${n}.json`)
  const { query } = JSON.parse(fs.readFileSync(emitPath, 'utf8'))
  try {
    await applyQuery(query)
    log(`OK batch ${n}/76`)
  } catch (err) {
    log(`FAIL batch ${n}/76: ${err.message}`)
    process.exit(1)
  }
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
log('VERIFY: ' + (await verifyRes.text()))
