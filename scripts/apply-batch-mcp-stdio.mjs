/**
 * Apply batch N via local Supabase MCP server (stdio).
 * Usage: node scripts/apply-batch-mcp-stdio.mjs <N>
 * Requires SUPABASE_ACCESS_TOKEN for standalone; from Cursor use execute_sql MCP instead.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const n = parseInt(process.argv[2], 10)
const logPath = path.join(outDir, 'batch-apply-log.txt')

if (!n) {
  console.error('Usage: node apply-batch-mcp-stdio.mjs <N>')
  process.exit(1)
}

const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
let query
if (fs.existsSync(payloadPath)) {
  query = JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query
} else {
  const batchPath = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)
  query = fs.readFileSync(batchPath, 'utf8')
  if (n >= 5) {
    query = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${query}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const args = token
  ? ['-y', '@supabase/mcp-server-supabase', '--access-token', token, '--project-ref', projectId]
  : ['-y', '@supabase/mcp-server-supabase', '--project-ref', projectId]

const transport = new StdioClientTransport({ command: npx, args, env: process.env })
const client = new Client({ name: 'apply-batch', version: '1.0.0' })

try {
  await client.connect(transport)
  const result = await client.callTool({
    name: 'execute_sql',
    arguments: { project_id: projectId, query },
  })
  fs.appendFileSync(logPath, `OK batch ${n}/76\n`)
  console.log(`OK batch ${n}/76`)
  console.log(JSON.stringify(result).slice(0, 300))
} catch (err) {
  console.error(`FAIL batch ${n}/76:`, err.message ?? err)
  process.exit(1)
} finally {
  await client.close().catch(() => {})
}
