/**
 * Write one combined batch query to _mcp-args.json for MCP execute_sql.
 * Usage: node scripts/emit-combined-batch.mjs <batchIndex>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const combined = JSON.parse(readFileSync(join(outDir, '_mcp-combined.json'), 'utf8'))
const bi = Number(process.argv[2] ?? 0)
const batch = combined.batches[bi]
if (!batch) {
  console.error(`No batch at index ${bi}`)
  process.exit(1)
}
writeFileSync(
  join(outDir, '_mcp-args.json'),
  JSON.stringify({ project_id: combined.project_id, query: batch.query }),
)
console.log(JSON.stringify({ batchIndex: bi, chunk: batch.chunk, from: batch.fromIndex, to: batch.toIndex, chars: batch.chars }))
