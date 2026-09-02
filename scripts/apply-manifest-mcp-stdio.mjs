/**
 * Apply manifest statements via local Supabase MCP server (stdio).
 * Uses same execute_sql as Cursor plugin. Requires SUPABASE_ACCESS_TOKEN.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const token = process.env.SUPABASE_ACCESS_TOKEN
const projectId = 'fqhisghfuuexfhqqdqcb'

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progressPath = join(outDir, '_mcp-progress.json')
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { completed: [], errors: [] }

const server = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['-y', '@supabase/mcp-server-supabase', '--access-token', token, '--project-ref', projectId],
  { stdio: ['pipe', 'pipe', 'inherit'] },
)

const transport = new StdioClientTransport({
  command: server.spawnfile,
  args: server.spawnargs.slice(1),
  env: process.env,
})

const client = new Client({ name: 'apply-manifest', version: '1.0.0' })
await client.connect(transport)

const start = progress.completed.length
for (let i = start; i < manifest.statements.length; i++) {
  const stmt = manifest.statements[i]
  try {
    await client.callTool({
      name: 'execute_sql',
      arguments: { project_id: projectId, query: stmt.query },
    })
    progress.completed.push({ index: i, label: stmt.label })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.log(`OK ${i + 1}/${manifest.statements.length} ${stmt.label}`)
  } catch (err) {
    progress.errors.push({ index: i, label: stmt.label, error: String(err) })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.error(`FAIL ${i + 1}/${manifest.statements.length} ${stmt.label}:`, err)
    process.exit(1)
  }
}

const verify = await client.callTool({
  name: 'execute_sql',
  arguments: {
    project_id: projectId,
    query: `SELECT 'clients' as t, count(*) FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001';`,
  },
})
console.log('Verification:', JSON.stringify(verify, null, 2))
await client.close()
server.kill()
