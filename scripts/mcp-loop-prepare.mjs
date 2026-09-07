/**
 * Automated MCP import loop using Cursor's plugin-supabase via dynamic tool bridge.
 * Reads manifest statements from lastIndex+1, writes each query to _mcp-args.json,
 * prints progress for agent CallDynamicTool execute_sql, then marks progress.
 *
 * This script prepares batches; the agent must call execute_sql for each PREPARE line.
 * For fully unattended import, set SUPABASE_ACCESS_TOKEN and use apply-remaining-manifest.mjs
 *
 * Usage: node scripts/mcp-loop-prepare.mjs [count]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progressPath = join(outDir, '_mcp-progress.json')
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { lastIndex: -1, completed: [], errors: [] }

const count = Number(process.argv[2] ?? 1)
const start = progress.lastIndex + 1
const end = Math.min(start + count, manifest.statements.length)

if (start >= manifest.statements.length) {
  console.log(JSON.stringify({ done: true, lastIndex: progress.lastIndex }))
  process.exit(0)
}

const items = []
for (let i = start; i < end; i++) {
  const stmt = manifest.statements[i]
  writeFileSync(
    join(outDir, '_mcp-args.json'),
    JSON.stringify({ project_id: 'fqhisghfuuexfhqqdqcb', query: stmt.query }),
  )
  items.push({ index: i, label: stmt.label, queryLen: stmt.query.length })
  console.log(`PREPARE ${i} ${stmt.label} (${stmt.query.length} chars)`)
}

writeFileSync(join(outDir, '_mcp-loop-batch.json'), JSON.stringify({ items }), 'utf8')
console.log(JSON.stringify({ done: false, from: start, to: end - 1, count: items.length }))
