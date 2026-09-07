/**
 * Apply batches 5-76 via Supabase MCP stdio using Cursor OAuth token from env.
 * Falls back to writing pending batch for agent MCP apply.
 *
 * Usage: node scripts/apply-all-mcp-batches.mjs [start] [end]
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
const start = parseInt(process.argv[2] ?? '5', 10)
const end = parseInt(process.argv[3] ?? '76', 10)
const logPath = path.join(outDir, 'batch-apply-log.txt')

function log(line) {
  fs.appendFileSync(logPath, line + '\n')
  console.log(line)
}

function completedBatches() {
  if (!fs.existsSync(logPath)) return new Set()
  const done = new Set()
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    const m = line.match(/^OK batch (\d+)\/76/)
    if (m) done.add(parseInt(m[1], 10))
  }
  return done
}

function loadQuery(n) {
  const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
  if (fs.existsSync(payloadPath)) {
    return JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query
  }
  const batchPath = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)
  let sql = fs.readFileSync(batchPath, 'utf8')
  if (n >= 5) {
    sql = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${sql}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
  return sql
}

async function createClient() {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const args = ['-y', '@supabase/mcp-server-supabase', '--access-token', token, '--project-ref', projectId]
  const transport = new StdioClientTransport({ command: npx, args, env: process.env })
  const client = new Client({ name: 'apply-all', version: '1.0.0' })
  await client.connect(transport)
  return client
}

async function applyQuery(client, query) {
  const result = await client.callTool({
    name: 'execute_sql',
    arguments: { project_id: projectId, query },
  })
  const text = JSON.stringify(result)
  if (result.isError) throw new Error(text.slice(0, 500))
  return text
}

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required for automated MCP stdio apply')
  process.exit(1)
}

const done = completedBatches()
const client = await createClient()

try {
  for (let n = start; n <= end; n++) {
    if (done.has(n)) {
      console.log(`SKIP batch ${n}/76`)
      continue
    }
    const query = loadQuery(n)
    try {
      await applyQuery(client, query)
      log(`OK batch ${n}/76`)
    } catch (err) {
      log(`FAIL batch ${n}/76: ${err.message}`)
      process.exit(1)
    }
  }

  const verify = await applyQuery(client, `SELECT 'clients' t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`)
  log('VERIFY: ' + verify)
} finally {
  await client.close()
}
