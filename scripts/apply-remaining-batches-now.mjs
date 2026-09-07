/**
 * Apply remaining manifest batches via Supabase MCP HTTP or Management API.
 * Usage: node scripts/apply-remaining-batches-now.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const batches = JSON.parse(readFileSync(join(outDir, '_remaining-batches.json'), 'utf8'))
const progressPath = join(outDir, '_mcp-progress.json')
const logPath = join(outDir, '_remaining-apply-log.txt')

function log(line) {
  writeFileSync(logPath, `${line}\n`, { flag: 'a' })
  console.log(line)
}

function markRange(from, to) {
  spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress-range.mjs'), String(from), String(to)], {
    stdio: 'inherit',
  })
}

async function viaManagementApi(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('no token')
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 800)}`)
  return text
}

async function viaMcpHttp(query) {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StreamableHTTPClientTransport } = await import(
    '@modelcontextprotocol/sdk/client/streamableHttp.js'
  )
  const transport = new StreamableHTTPClientTransport(new URL('https://mcp.supabase.com/mcp'))
  const client = new Client({ name: 'apply-remaining-batches', version: '1.0.0' })
  await client.connect(transport)
  try {
    const result = await client.callTool({
      name: 'execute_sql',
      arguments: { project_id: projectId, query },
    })
    if (result.isError) throw new Error(JSON.stringify(result.content).slice(0, 800))
    return result
  } finally {
    await client.close().catch(() => {})
  }
}

const start = Number(process.argv[2] ?? 0)
const end = Number(process.argv[3] ?? batches.length - 1)

for (let bi = start; bi <= end; bi++) {
  const batch = batches[bi]
  log(`APPLY batch ${bi} ${batch.from}-${batch.to} (${batch.chars}) ${batch.label}`)
  try {
    if (process.env.SUPABASE_ACCESS_TOKEN) {
      await viaManagementApi(batch.query)
    } else {
      await viaMcpHttp(batch.query)
    }
    markRange(batch.from, batch.to)
    log(`OK batch ${bi}`)
  } catch (err) {
    log(`FAIL batch ${bi}: ${err.message ?? err}`)
    process.exit(1)
  }
}

log('DONE')
