/**
 * Prepare next N manifest statements for MCP execute_sql (writes _mcp-pending.json).
 * Usage: node scripts/apply-manifest-mcp-batch.mjs [count]
 * Agent calls execute_sql for each entry, then: node scripts/mark-mcp-progress.mjs <index> "<label>"
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const count = Number(process.argv[2] || 1)
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progress = existsSync(join(outDir, '_mcp-progress.json'))
  ? JSON.parse(readFileSync(join(outDir, '_mcp-progress.json'), 'utf8'))
  : { lastIndex: -1, completed: [], errors: [] }

const start = progress.lastIndex + 1
const batch = []
for (let i = start; i < Math.min(start + count, manifest.statements.length); i++) {
  const stmt = manifest.statements[i]
  batch.push({ index: i, label: stmt.label, query: stmt.query })
}

writeFileSync(join(outDir, '_mcp-pending.json'), JSON.stringify({ project_id: 'fqhisghfuuexfhqqdqcb', batch }, null, 0))
console.log(JSON.stringify({ from: start, to: start + batch.length - 1, count: batch.length, done: batch.length === 0 }))
