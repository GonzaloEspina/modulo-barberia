/**
 * Apply batches 5-76 via Supabase HTTP MCP (https://mcp.supabase.com/mcp).
 * Uses @modelcontextprotocol/sdk StreamableHTTPClientTransport.
 * Requires prior OAuth via Cursor mcp_auth or SUPABASE_ACCESS_TOKEN for Management API fallback.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const start = parseInt(process.argv[2] ?? '5', 10)
const end = parseInt(process.argv[3] ?? '76', 10)
const logPath = path.join(outDir, 'batch-apply-log.txt')

function log(line) {
  fs.appendFileSync(logPath, line + '\n')
  console.log(line)
}

function completed() {
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

async function applyViaManagementApi(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('No auth')
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`)
  return text
}

async function applyViaMcpHttp(client, query) {
  const result = await client.callTool({
    name: 'execute_sql',
    arguments: { project_id: projectId, query },
  })
  if (result.isError) throw new Error(JSON.stringify(result.content).slice(0, 500))
  return result
}

const done = completed()
let client = null

try {
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    console.log('Using Management API')
    for (let n = start; n <= end; n++) {
      if (done.has(n)) {
        console.log(`SKIP batch ${n}/76`)
        continue
      }
      await applyViaManagementApi(loadQuery(n))
      log(`OK batch ${n}/76`)
    }
  } else {
    const transport = new StreamableHTTPClientTransport(new URL('https://mcp.supabase.com/mcp'))
    client = new Client({ name: 'apply-batches', version: '1.0.0' })
    await client.connect(transport)
    console.log('Connected to Supabase MCP HTTP')

    for (let n = start; n <= end; n++) {
      if (done.has(n)) {
        console.log(`SKIP batch ${n}/76`)
        continue
      }
      await applyViaMcpHttp(client, loadQuery(n))
      log(`OK batch ${n}/76`)
    }
  }

  const verifyQ = `SELECT 'clients' t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`

  const verify = process.env.SUPABASE_ACCESS_TOKEN
    ? await applyViaManagementApi(verifyQ)
    : await applyViaMcpHttp(client, verifyQ)
  log('VERIFY: ' + JSON.stringify(verify))
} catch (err) {
  console.error('FAIL:', err.message)
  process.exit(1)
} finally {
  if (client) await client.close()
}
