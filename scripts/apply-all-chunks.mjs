/**
 * Applies all combined-chunk-*.sql files via Supabase Management API.
 * Uses same endpoint as MCP execute_sql. Requires SUPABASE_ACCESS_TOKEN.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const outDir = join(__dirname, '.import-output')

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}

const files = readdirSync(outDir)
  .filter((f) => /^combined-chunk-\d+\.sql$/.test(f))
  .sort()

for (let i = 0; i < files.length; i++) {
  const file = files[i]
  const n = i + 1
  const query = readFileSync(join(outDir, file), 'utf8')
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) {
    console.error(`FAIL chunk ${n}/48 (${file}): ${res.status} ${body}`)
    process.exit(1)
  }
  console.log(`OK chunk ${n}/48`)
}

const verifyQuery = `
SELECT 'clients' as t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';
`
const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: verifyQuery }),
})
const counts = await res.json()
console.log('Verification:', JSON.stringify(counts, null, 2))
