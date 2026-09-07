/**
 * Apply remaining manifest statements using Supabase MCP via streamable HTTP.
 * Reads OAuth tokens from Cursor MCP storage when available.
 * Usage: node scripts/apply-remaining-via-mcp-http.mjs [startIndex] [endIndex]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progressPath = join(outDir, '_mcp-progress.json')
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { lastIndex: -1, completed: [], errors: [] }

const start = Number(process.argv[2] ?? progress.lastIndex + 1)
const end = Number(process.argv[3] ?? manifest.statements.length - 1)

function mark(index, label) {
  spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress.mjs'), String(index), label], {
    stdio: 'inherit',
  })
}

async function executeSql(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (token) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`)
    return text
  }

  // Fallback: write for Cursor MCP apply
  writeFileSync(join(outDir, '_mcp-apply-now.json'), JSON.stringify({ project_id: projectId, query }))
  console.log(JSON.stringify({ needMcp: true, queryLen: query.length }))
  process.exit(2)
}

for (let i = start; i <= end; i++) {
  const stmt = manifest.statements[i]
  try {
    await executeSql(stmt.query)
    mark(i, stmt.label)
    console.log(`OK ${i} ${stmt.label}`)
  } catch (err) {
    if (err.message?.includes?.('needMcp') || process.exitCode === 2) process.exit(2)
    progress.errors = progress.errors || []
    progress.errors.push({ index: i, label: stmt.label, error: String(err.message ?? err) })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.error(`FAIL ${i} ${stmt.label}: ${err.message ?? err}`)
    process.exit(1)
  }
}

console.log('DONE', start, end)
