/**
 * Apply SQL from file via Supabase Management API or emit for Cursor MCP.
 * Usage: node scripts/apply-sql-file.mjs <sqlFile> [--mark-index N] [--label "text"]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const sqlFile = process.argv[2]
const markIdx = process.argv.includes('--mark-index')
  ? Number(process.argv[process.argv.indexOf('--mark-index') + 1])
  : null
const labelIdx = process.argv.indexOf('--label')
const label = labelIdx >= 0 ? process.argv[labelIdx + 1] : null

if (!sqlFile) {
  console.error('Usage: node apply-sql-file.mjs <sqlFile> [--mark-index N] [--label text]')
  process.exit(1)
}

const query = readFileSync(sqlFile, 'utf8')
const token = process.env.SUPABASE_ACCESS_TOKEN

if (token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`FAIL: ${res.status} ${text.slice(0, 500)}`)
    process.exit(1)
  }
  if (markIdx != null && label) {
    spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress.mjs'), String(markIdx), label], {
      stdio: 'inherit',
    })
  }
  console.log(JSON.stringify({ ok: true, queryLen: query.length, markIdx, label }))
  process.exit(0)
}

writeFileSync(join(outDir, '_mcp-apply-now.json'), JSON.stringify({ project_id: projectId, query }))
console.log(JSON.stringify({ needMcp: true, sqlFile, queryLen: query.length, markIdx, label }))
process.exit(2)
