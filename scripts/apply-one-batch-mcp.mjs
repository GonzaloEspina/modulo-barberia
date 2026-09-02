/**
 * Apply one batch via Supabase MCP stdio (needs SUPABASE_ACCESS_TOKEN).
 * Usage: node scripts/apply-one-batch-mcp.mjs <N>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const n = parseInt(process.argv[2], 10)

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}
if (!n) {
  console.error('Usage: node apply-one-batch-mcp.mjs <N>')
  process.exit(1)
}

const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
const query = JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const args = ['-y', '@supabase/mcp-server-supabase', '--access-token', token, '--project-ref', projectId]
const server = spawn(npx, args, { stdio: ['pipe', 'pipe', 'inherit'], shell: process.platform === 'win32' })

const transport = new StdioClientTransport({ command: npx, args, env: process.env })
const client = new Client({ name: 'apply-one', version: '1.0.0' })
await client.connect(transport)

const result = await client.callTool({
  name: 'execute_sql',
  arguments: { project_id: projectId, query },
})
await client.close()
server.kill()
console.log(JSON.stringify({ batch: n, result }))
