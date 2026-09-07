/**
 * Mark a range of MCP import statements complete.
 * Usage: node scripts/mark-mcp-batch.mjs <startIndex> <endIndex>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const progressPath = join(__dirname, '.import-output/_mcp-progress.json')
const batchPath = join(__dirname, '.import-output/_next-mcp-batch.json')
const start = Number(process.argv[2])
const end = Number(process.argv[3])
const progress = JSON.parse(readFileSync(progressPath, 'utf8'))
const batch = JSON.parse(readFileSync(batchPath, 'utf8'))

for (let i = 0; i < batch.indices.length; i++) {
  const index = batch.indices[i]
  if (index < start || index > end) continue
  progress.completed.push({ index, label: batch.labels[i] })
}
progress.lastIndex = end
writeFileSync(progressPath, JSON.stringify(progress, null, 2))
console.log(`marked ${start}-${end} (lastIndex=${progress.lastIndex})`)
