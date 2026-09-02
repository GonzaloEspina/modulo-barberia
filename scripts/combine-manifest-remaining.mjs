/**
 * Combine remaining manifest statements into MCP-sized SQL batches.
 * Usage: node scripts/combine-manifest-remaining.mjs [maxCharsPerBatch]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const maxChars = Number(process.argv[2] || 400000)
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progress = existsSync(join(outDir, '_mcp-progress.json'))
  ? JSON.parse(readFileSync(join(outDir, '_mcp-progress.json'), 'utf8'))
  : { lastIndex: -1 }

const start = progress.lastIndex + 1
const batches = []
let current = { from: start, to: start - 1, query: '', chars: 0 }

for (let i = start; i < manifest.statements.length; i++) {
  const stmt = manifest.statements[i]
  const piece = `-- index ${i}: ${stmt.label}\n${stmt.query}\n`
  if (current.chars > 0 && current.chars + piece.length > maxChars) {
    batches.push(current)
    current = { from: i, to: i - 1, query: '', chars: 0 }
  }
  current.query += piece
  current.chars += piece.length
  current.to = i
}
if (current.chars > 0) batches.push(current)

batches.forEach((b, n) => {
  writeFileSync(join(outDir, `_combined-batch-${n + 1}.sql`), b.query)
  writeFileSync(
    join(outDir, `_combined-batch-${n + 1}.json`),
    JSON.stringify({ batch: n + 1, from: b.from, to: b.to, chars: b.chars, project_id: 'fqhisghfuuexfhqqdqcb' }),
  )
})

writeFileSync(join(outDir, '_combined-batches-meta.json'), JSON.stringify({ start, totalBatches: batches.length, batches: batches.map((b, n) => ({ batch: n + 1, from: b.from, to: b.to, chars: b.chars })) }, null, 2))
console.log(JSON.stringify({ start, totalBatches: batches.length, batches: batches.map((b, n) => ({ batch: n + 1, from: b.from, to: b.to, chars: b.chars })) }))
