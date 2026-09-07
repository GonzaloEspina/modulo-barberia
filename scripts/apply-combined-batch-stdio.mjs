/**
 * Apply combined manifest batch N via Supabase MCP stdio.
 * Usage: node scripts/apply-combined-batch-stdio.mjs <N>
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

if (!n) {
  console.error('Usage: node apply-combined-batch-stdio.mjs <N>')
  process.exit(1)
}

const sqlPath = path.join(outDir, `_combined-batch-${n}.sql`)
const metaPath = path.join(outDir, '_combined-batches-meta.json')
if (!fs.existsSync(sqlPath)) {
  console.error(`Missing ${sqlPath}`)
  process.exit(1)
}

const query = fs.readFileSync(sqlPath, 'utf8')
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
const batchMeta = meta.batches.find((b) => b.batch === n)
if (!batchMeta) {
  console.error(`Batch ${n} not in meta`)
  process.exit(1)
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const args = token
  ? ['-y', '@supabase/mcp-server-supabase', '--access-token', token, '--project-ref', projectId]
  : ['-y', '@supabase/mcp-server-supabase', '--project-ref', projectId]

const transport = new StdioClientTransport({ command: npx, args, env: process.env })
const client = new Client({ name: 'apply-combined-batch', version: '1.0.0' })

try {
  await client.connect(transport)
  const result = await client.callTool({
    name: 'execute_sql',
    arguments: { project_id: projectId, query },
  })
  console.log(JSON.stringify({ ok: true, batch: n, from: batchMeta.from, to: batchMeta.to, queryLen: query.length, result: result?.content?.[0]?.text?.slice?.(0, 200) }))
} catch (err) {
  console.error(JSON.stringify({ ok: false, batch: n, from: batchMeta.from, to: batchMeta.to, error: String(err.message ?? err) }))
  process.exit(1)
} finally {
  await client.close().catch(() => {})
}
