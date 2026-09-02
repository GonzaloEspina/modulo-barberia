/**
 * Apply batches start-end using Supabase MCP execute_sql via @modelcontextprotocol/sdk.
 * Auth: set SUPABASE_ACCESS_TOKEN or run `supabase login` first.
 * Usage: node scripts/apply-batches-mcp.mjs [start] [end]
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

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required. Get one from https://supabase.com/dashboard/account/tokens')
  process.exit(1)
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

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const server = spawn(npx, ['-y', '@supabase/mcp-server-supabase', '--access-token', token, '--project-ref', projectId], {
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
})

const transport = new StdioClientTransport({
  command: server.spawnfile ?? npx,
  args: server.spawnargs?.slice(1) ?? ['-y', '@supabase/mcp-server-supabase', '--access-token', token, '--project-ref', projectId],
  env: process.env,
})

const client = new Client({ name: 'apply-batches', version: '1.0.0' })
await client.connect(transport)

for (let n = start; n <= end; n++) {
  const query = loadQuery(n)
  try {
    await client.callTool({
      name: 'execute_sql',
      arguments: { project_id: projectId, query },
    })
    log(`OK batch ${n}/76`)
  } catch (err) {
    log(`FAIL batch ${n}/76: ${err.message ?? err}`)
    await client.close()
    server.kill()
    process.exit(1)
  }
}

const verify = await client.callTool({
  name: 'execute_sql',
  arguments: {
    project_id: projectId,
    query: `SELECT 'clients' t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`,
  },
})
log('VERIFY: ' + JSON.stringify(verify))

await client.close()
server.kill()
