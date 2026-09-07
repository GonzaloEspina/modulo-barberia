/**
 * Apply combined manifest batches [startBatch..endBatch] via Supabase MCP stdio.
 * Marks per-statement progress after each successful batch.
 * Usage: node scripts/apply-mcp-combined-range.mjs <startBatch> [endBatch]
 * Requires SUPABASE_ACCESS_TOKEN.
 */
import { readFileSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN
const combined = JSON.parse(readFileSync(join(outDir, '_mcp-combined.json'), 'utf8'))
const startBatch = Number(process.argv[2] ?? 0)
const endBatch = Number(process.argv[3] ?? combined.batches.length - 1)
const logPath = join(outDir, 'mcp-combined-apply-log.txt')

function log(line) {
  appendFileSync(logPath, `${line}\n`)
  console.log(line)
}

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const args = ['-y', '@supabase/mcp-server-supabase', '--access-token', token, '--project-ref', projectId]
const transport = new StdioClientTransport({ command: npx, args, env: process.env })
const client = new Client({ name: 'apply-mcp-combined-range', version: '1.0.0' })

await client.connect(transport)

try {
  for (let bi = startBatch; bi <= endBatch; bi++) {
    const batch = combined.batches[bi]
    if (!batch) {
      log(`SKIP missing batch ${bi}`)
      continue
    }
    log(`APPLY batch ${bi} ${batch.chunk} indices ${batch.fromIndex}-${batch.toIndex} (${batch.chars} chars)`)
    const result = await client.callTool({
      name: 'execute_sql',
      arguments: { project_id: projectId, query: batch.query },
    })
    const text = JSON.stringify(result)
    if (result.isError) {
      log(`FAIL batch ${bi}: ${text.slice(0, 500)}`)
      process.exit(1)
    }
    log(`OK batch ${bi}`)
    spawnSync(process.execPath, [
      join(__dirname, 'mark-mcp-batch-progress.mjs'),
      String(batch.fromIndex),
      String(batch.toIndex),
    ], { stdio: 'inherit' })
  }

  const verifySql = `SELECT 'clients' as t, count(*)::text as c FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'services', count(*)::text FROM services WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*)::text FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*)::text FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'membership_plans', count(*)::text FROM membership_plans WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'client_memberships', count(*)::text FROM client_memberships WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`

  const verify = await client.callTool({
    name: 'execute_sql',
    arguments: { project_id: projectId, query: verifySql },
  })
  log(`VERIFY: ${JSON.stringify(verify)}`)
} finally {
  await client.close().catch(() => {})
}
