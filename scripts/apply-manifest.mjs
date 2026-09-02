/**
 * Apply all manifest statements via Supabase Management API (same as MCP execute_sql).
 * Requires SUPABASE_ACCESS_TOKEN. Tracks progress in _mcp-progress.json.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const token = process.env.SUPABASE_ACCESS_TOKEN
const progressPath = join(outDir, '_mcp-progress.json')

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required for batch apply script')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { completed: [], errors: [] }

const start = progress.completed.length
const projectId = manifest.project_id

for (let i = start; i < manifest.statements.length; i++) {
  const stmt = manifest.statements[i]
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: stmt.query }),
  })
  const body = await res.text()
  if (!res.ok) {
    progress.errors.push({ index: i, label: stmt.label, status: res.status, body })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.error(`FAIL ${i + 1}/${manifest.statements.length} ${stmt.label}: ${res.status} ${body}`)
    process.exit(1)
  }
  progress.completed.push({ index: i, label: stmt.label })
  writeFileSync(progressPath, JSON.stringify(progress, null, 2))
  console.log(`OK ${i + 1}/${manifest.statements.length} ${stmt.label}`)
}

const verifyQuery = `
SELECT 'clients' as t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';
`
const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: verifyQuery }),
})
console.log('Verification:', await res.text())
