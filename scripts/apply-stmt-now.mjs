/**
 * Apply one manifest index by printing a single-line JSON for the agent,
 * OR if SUPABASE_ACCESS_TOKEN is set, execute directly.
 * Also supports --file mode: node scripts/apply-stmt-file.mjs <sqlFile> <index> <label>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN

const index = Number(process.argv[2])
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const stmt = manifest.statements[index]
if (!stmt) {
  console.error('missing', index)
  process.exit(1)
}

const payload = { project_id: projectId, query: stmt.query, index, label: stmt.label }
writeFileSync(join(outDir, '_mcp-apply-now.json'), JSON.stringify(payload))

if (!token) {
  console.log(JSON.stringify({ needMcp: true, index, label: stmt.label, chars: stmt.query.length }))
  process.exit(0)
}

const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: stmt.query }),
})
const text = await res.text()
if (!res.ok) {
  console.error(`FAIL ${index}: ${res.status} ${text.slice(0, 800)}`)
  process.exit(1)
}
spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress.mjs'), String(index), stmt.label], {
  stdio: 'inherit',
})
console.log(`OK ${index} ${stmt.label}`)
