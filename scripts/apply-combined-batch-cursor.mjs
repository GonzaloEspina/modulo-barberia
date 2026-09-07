/**
 * Apply all combined manifest batches (17-268) via Cursor MCP execute_sql.
 * Writes _mcp-apply-now.json for each pending batch; agent calls execute_sql then:
 *   node scripts/apply-combined-batch-cursor.mjs mark <batchN>
 *
 * Usage:
 *   node scripts/apply-combined-batch-cursor.mjs next     # prepare next batch
 *   node scripts/apply-combined-batch-cursor.mjs mark 1   # mark batch 1 done
 *   node scripts/apply-combined-batch-cursor.mjs status
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const meta = JSON.parse(readFileSync(join(outDir, '_combined-batches-meta.json'), 'utf8'))
const progressPath = join(outDir, '_combined-batch-progress.json')
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { lastBatch: 0 }

const cmd = process.argv[2] || 'next'

if (cmd === 'status') {
  console.log(JSON.stringify({ lastBatch: progress.lastBatch, totalBatches: meta.totalBatches, next: progress.lastBatch + 1 }))
  process.exit(0)
}

if (cmd === 'mark') {
  const n = Number(process.argv[3])
  const batch = meta.batches.find((b) => b.batch === n)
  if (!batch) {
    console.error('Unknown batch', n)
    process.exit(1)
  }
  for (let i = batch.from; i <= batch.to; i++) {
    const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
    const label = manifest.statements[i]?.label ?? ''
    spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress.mjs'), String(i), label], { stdio: 'inherit' })
  }
  progress.lastBatch = n
  writeFileSync(progressPath, JSON.stringify(progress, null, 2))
  console.log(JSON.stringify({ markedBatch: n, from: batch.from, to: batch.to }))
  process.exit(0)
}

if (cmd === 'next') {
  const n = progress.lastBatch + 1
  if (n > meta.totalBatches) {
    console.log(JSON.stringify({ done: true, lastBatch: progress.lastBatch }))
    process.exit(0)
  }
  const batch = meta.batches.find((b) => b.batch === n)
  const query = readFileSync(join(outDir, `_combined-batch-${n}.sql`), 'utf8')
  writeFileSync(join(outDir, '_mcp-apply-now.json'), JSON.stringify({ project_id: projectId, query, batch: n, from: batch.from, to: batch.to }))
  console.log(JSON.stringify({ batch: n, from: batch.from, to: batch.to, queryLen: query.length, file: `_combined-batch-${n}.sql` }))
  process.exit(0)
}

console.error('Unknown command', cmd)
process.exit(1)
