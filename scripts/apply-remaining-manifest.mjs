/**
 * Apply remaining manifest statements via Supabase Management API.
 * Same endpoint as MCP execute_sql. Requires SUPABASE_ACCESS_TOKEN.
 * Uses lastIndex+1 and mark-mcp-progress format.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const progressPath = join(outDir, '_mcp-progress.json')
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { completed: [], errors: [], lastIndex: -1 }

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}

async function execSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${body}`)
  return body
}

function mark(index, label) {
  spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress.mjs'), String(index), label], {
    stdio: 'inherit',
  })
}

for (let i = progress.lastIndex + 1; i < manifest.statements.length; i++) {
  const stmt = manifest.statements[i]
  try {
    await execSql(stmt.query)
    mark(i, stmt.label)
    console.log(`OK ${i + 1}/${manifest.statements.length} ${stmt.label}`)
  } catch (err) {
    progress.errors = progress.errors || []
    progress.errors.push({ index: i, label: stmt.label, error: String(err) })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.error(`FAIL ${i + 1}/${manifest.statements.length} ${stmt.label}:`, err.message)
    process.exit(1)
  }
}

const verify = await execSql(`
SELECT 'clients' as t, count(*)::text as c FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'services', count(*)::text FROM services WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*)::text FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*)::text FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'membership_plans', count(*)::text FROM membership_plans WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'client_memberships', count(*)::text FROM client_memberships WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';
`)
console.log('Verification:', verify)
