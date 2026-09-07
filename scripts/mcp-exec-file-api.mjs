/**
 * Execute one prepared MCP args file via Supabase Management API.
 * Usage: SUPABASE_ACCESS_TOKEN=... node scripts/mcp-exec-file-api.mjs [argsFile]
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = process.argv[2] ?? join(__dirname, '.import-output/_mcp-args.json')
const { project_id, query } = JSON.parse(readFileSync(path, 'utf8'))
const token = process.env.SUPABASE_ACCESS_TOKEN

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}

const res = await fetch(`https://api.supabase.com/v1/projects/${project_id}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const body = await res.text()
if (!res.ok) {
  console.error(`FAIL ${res.status}: ${body.slice(0, 500)}`)
  process.exit(1)
}
console.log('OK', body.slice(0, 200))
