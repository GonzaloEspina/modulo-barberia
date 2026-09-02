/**
 * Apply pending batch SQL file via Supabase MCP (reads _pending-batch.json query).
 * Run from Cursor agent: node scripts/run-pending-mcp.mjs | then agent calls execute_sql
 * Or with SUPABASE_ACCESS_TOKEN: applies directly via Management API.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const pendingPath = path.join(outDir, '_pending-batch.json')
const logPath = path.join(outDir, 'batch-apply-log.txt')

if (!fs.existsSync(pendingPath)) {
  console.log('NO_PENDING')
  process.exit(0)
}

const { query, batch } = JSON.parse(fs.readFileSync(pendingPath, 'utf8'))
const token = process.env.SUPABASE_ACCESS_TOKEN

if (token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`FAIL batch ${batch}/76: ${text.slice(0, 500)}`)
    process.exit(1)
  }
  fs.appendFileSync(logPath, `OK batch ${batch}/76\n`)
  fs.unlinkSync(pendingPath)
  console.log(`OK batch ${batch}/76`)
  process.exit(0)
}

// Output for MCP apply
fs.writeFileSync(path.join(outDir, '_mcp-apply-now.json'), JSON.stringify({ project_id: projectId, query, batch }))
console.log(JSON.stringify({ mcpApply: true, batch, queryLen: query.length, file: '_mcp-apply-now.json' }))
