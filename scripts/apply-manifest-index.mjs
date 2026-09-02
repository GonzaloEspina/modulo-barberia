/**
 * Apply one manifest statement by index using Supabase Management API.
 * Usage: SUPABASE_ACCESS_TOKEN=... node scripts/apply-manifest-index.mjs <index>
 * Or: node scripts/apply-manifest-index.mjs <index> --dry-run
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = process.env.SUPABASE_PROJECT_ID || 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const index = Number(process.argv[2])
const dryRun = process.argv.includes('--dry-run')

const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const stmt = manifest.statements[index]
if (!stmt) {
  console.error('No statement at index', index)
  process.exit(1)
}

if (dryRun) {
  console.log(JSON.stringify({ index, label: stmt.label, chars: stmt.query.length }))
  process.exit(0)
}

if (!token) {
  writeFileSync(
    join(outDir, '_next-apply.json'),
    JSON.stringify({ index, label: stmt.label, project_id: projectId, query: stmt.query }),
  )
  console.log(`WROTE _next-apply.json index=${index} ${stmt.label}`)
  process.exit(0)
}

const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: stmt.query }),
})
const body = await res.text()
if (!res.ok) {
  console.error(`FAIL ${index} ${stmt.label}: ${res.status} ${body}`)
  process.exit(1)
}
console.log(`OK ${index} ${stmt.label}`)
