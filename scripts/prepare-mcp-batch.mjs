/**
 * Execute one combined batch via Supabase MCP (parent calls execute_sql).
 * Usage: node scripts/prepare-mcp-batch.mjs <batchIndex>
 * Writes scripts/.import-output/_mcp-args.json and prints metadata.
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
  console.error(`No batch ${bi}`)
  process.exit(1)
}
writeFileSync(
  join(outDir, '_mcp-args.json'),
  JSON.stringify({ project_id: combined.project_id, query: batch.query }),
)
writeFileSync(join(outDir, '_mcp-batch-meta.json'), JSON.stringify({
  batchIndex: bi,
  chunk: batch.chunk,
  fromIndex: batch.fromIndex,
  toIndex: batch.toIndex,
  chars: batch.chars,
}))
console.log(JSON.stringify({ batchIndex: bi, chunk: batch.chunk, from: batch.fromIndex, to: batch.toIndex, chars: batch.chars }))
