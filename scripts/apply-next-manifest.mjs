/**
 * Apply all manifest statements using CallDynamicTool-equivalent fetch API.
 * Falls back to progress tracking for manual MCP apply.
 * With SUPABASE_ACCESS_TOKEN: applies all automatically.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const progressPath = join(outDir, '_mcp-progress.json')
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { completed: [], errors: [], lastIndex: -1 }

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

if (!token) {
  const next = progress.lastIndex + 1
  if (next >= manifest.statements.length) {
    console.log('ALL_DONE')
    process.exit(0)
  }
  const stmt = manifest.statements[next]
  writeFileSync(join(outDir, '_next-mcp-stmt.json'), JSON.stringify({ index: next, total: manifest.statements.length, label: stmt.label, project_id: projectId, query: stmt.query }), 'utf8')
  console.log(`NEXT ${next + 1}/${manifest.statements.length} ${stmt.label} (${stmt.chars} chars)`)
  process.exit(0)
}

for (let i = progress.lastIndex + 1; i < manifest.statements.length; i++) {
  const stmt = manifest.statements[i]
  try {
    await execSql(stmt.query)
    progress.completed.push({ index: i, label: stmt.label })
    progress.lastIndex = i
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.log(`OK ${i + 1}/${manifest.statements.length} ${stmt.label}`)
  } catch (err) {
    progress.errors.push({ index: i, label: stmt.label, error: String(err) })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.error(`FAIL ${i + 1}/${manifest.statements.length} ${stmt.label}:`, err.message)
    process.exit(1)
  }
}

const verify = await execSql(`
SELECT 'clients' as t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';
`)
console.log('Verification:', verify)
