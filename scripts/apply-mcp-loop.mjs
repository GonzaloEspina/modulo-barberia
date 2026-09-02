/**
 * Apply manifest statements via Supabase MCP (parent agent calls execute_sql).
 * Prints one statement per invocation; parent marks progress after success.
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
  : { completed: [], errors: [], lastIndex: -1 }

const batchSize = Number(process.argv[2] || 1)
const start = progress.lastIndex + 1
const end = Math.min(start + batchSize, manifest.statements.length)

if (start >= manifest.statements.length) {
  console.log(JSON.stringify({ done: true, total: manifest.statements.length }))
  process.exit(0)
}

const batch = manifest.statements.slice(start, end).map((stmt, i) => ({
  index: start + i,
  label: stmt.label,
  chars: stmt.chars,
  query: stmt.query,
}))

writeFileSync(join(outDir, '_mcp-batch.json'), JSON.stringify({ project_id: 'fqhisghfuuexfhqqdqcb', batch }), 'utf8')
console.log(JSON.stringify({ done: false, from: start, to: end - 1, total: manifest.statements.length, count: batch.length }))
