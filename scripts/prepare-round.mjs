/**
 * Prepare next N manifest statements for MCP batch execution.
 * Usage: node scripts/prepare-round.mjs [count]
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

const count = Number(process.argv[2] || 5)
const start = progress.lastIndex + 1
const end = Math.min(start + count, manifest.statements.length)

if (start >= manifest.statements.length) {
  console.log(JSON.stringify({ done: true, lastIndex: progress.lastIndex }))
  process.exit(0)
}

const batch = manifest.statements.slice(start, end).map((stmt, i) => ({
  index: start + i,
  label: stmt.label,
  chars: stmt.query.length,
  query: stmt.query,
}))

writeFileSync(
  join(outDir, '_mcp-round.json'),
  JSON.stringify({ project_id: manifest.project_id, batch }, null, 2),
)
console.log(JSON.stringify({ done: false, from: start, to: end - 1, count: batch.length }))
