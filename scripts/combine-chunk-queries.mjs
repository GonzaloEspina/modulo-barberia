/**
 * Combine manifest statements from startIndex into chunk-level SQL batches.
 * chunk-02 partial (after DISABLE): INSERT batches + ENABLE
 * chunk-03+: DISABLE + INSERT batches + ENABLE
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const startIndex = Number(process.argv[2] ?? 13)

const byChunk = new Map()
for (let i = startIndex; i < manifest.statements.length; i++) {
  const stmt = manifest.statements[i]
  const chunk = stmt.label.split('/')[0]
  if (!byChunk.has(chunk)) byChunk.set(chunk, [])
  byChunk.get(chunk).push({ index: i, label: stmt.label, query: stmt.query })
}

const batches = []
for (const [chunk, stmts] of byChunk) {
  const indices = stmts.map((s) => s.index)
  const labels = stmts.map((s) => s.label)
  const query = stmts.map((s) => s.query).join('\n')
  batches.push({
    chunk,
    fromIndex: indices[0],
    toIndex: indices[indices.length - 1],
    labels,
    indices,
    chars: query.length,
    query,
  })
}

writeFileSync(join(outDir, '_mcp-combined.json'), JSON.stringify({ project_id: manifest.project_id, batches }, null, 2))
console.log(JSON.stringify({ batchCount: batches.length, totalChars: batches.reduce((a, b) => a + b.chars, 0) }))
