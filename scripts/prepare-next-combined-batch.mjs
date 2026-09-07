/**
 * Prepare next combined batch from progress.lastIndex+1.
 * Writes _mcp-args.json and prints {batchIndex, fromIndex, toIndex, queryLen}.
 * Agent calls execute_sql then: node scripts/mark-mcp-batch-progress.mjs <from> <to>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const combined = JSON.parse(readFileSync(join(outDir, '_mcp-combined.json'), 'utf8'))
const progressPath = join(outDir, '_mcp-progress.json')
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { lastIndex: -1 }

const next = progress.lastIndex + 1
const batch = combined.batches.find((b) => b.fromIndex <= next && b.toIndex >= next)
if (!batch) {
  console.log(JSON.stringify({ done: true, lastIndex: progress.lastIndex }))
  process.exit(0)
}

const bi = combined.batches.indexOf(batch)
writeFileSync(
  join(outDir, '_mcp-args.json'),
  JSON.stringify({ project_id: combined.project_id, query: batch.query }),
)
writeFileSync(
  join(outDir, '_mcp-batch-meta.json'),
  JSON.stringify({ batchIndex: bi, chunk: batch.chunk, fromIndex: batch.fromIndex, toIndex: batch.toIndex }),
)
console.log(
  JSON.stringify({
    done: false,
    batchIndex: bi,
    chunk: batch.chunk,
    fromIndex: batch.fromIndex,
    toIndex: batch.toIndex,
    queryLen: batch.query.length,
    nextIndex: next,
  }),
)
