/**
 * Apply remaining manifest statements via direct Postgres (DATABASE_URL).
 * Equivalent to execute_sql MCP. Loads .env.local, uses lastIndex+1, marks progress.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const envPath = join(__dirname, '..', '.env.local')

function loadEnv() {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    if (!process.env[key]) process.env[key] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

loadEnv()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL required in .env.local')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progressPath = join(outDir, '_mcp-progress.json')
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { completed: [], errors: [], lastIndex: -1 }

function mark(index, label) {
  spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress.mjs'), String(index), label], {
    stdio: 'inherit',
  })
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
await client.connect()

const start = progress.lastIndex + 1
for (let i = start; i < manifest.statements.length; i++) {
  const stmt = manifest.statements[i]
  try {
    await client.query(stmt.query)
    mark(i, stmt.label)
    console.log(`OK ${i}/${manifest.statements.length - 1} ${stmt.label}`)
  } catch (err) {
    progress.errors = progress.errors || []
    progress.errors.push({ index: i, label: stmt.label, error: String(err.message ?? err) })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.error(`FAIL ${i} ${stmt.label}:`, err.message ?? err)
    await client.end()
    process.exit(1)
  }
}

const verify = await client.query(`
SELECT 'clients' as t, count(*)::text as c FROM clients WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'appointments', count(*)::text FROM appointments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'payments', count(*)::text FROM payments WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'expenses', count(*)::text FROM expenses WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'client_memberships', count(*)::text FROM client_memberships WHERE organization_id = 'a0000000-0000-4000-8000-000000000001'
`)
console.log('Verification:', JSON.stringify(verify.rows))
await client.end()
