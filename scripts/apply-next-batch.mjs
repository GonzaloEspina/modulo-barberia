/**
 * Pack consecutive manifest statements into one MCP execute_sql payload.
 * Usage: node scripts/apply-next-batch.mjs [maxChars=45000]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const maxChars = Number(process.argv[2] || 45000)
const progressPath = join(outDir, '_mcp-progress.json')
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))
const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, 'utf8'))
  : { completed: [], errors: [], lastIndex: -1 }

const start = progress.lastIndex + 1
if (start >= manifest.statements.length) {
  console.log('ALL_DONE')
  process.exit(0)
}

const parts = []
const indices = []
const labels = []
let chars = 0

for (let i = start; i < manifest.statements.length; i++) {
  const stmt = manifest.statements[i]
  const q = stmt.query.trim().replace(/;$/, '')
  const nextLen = q.length + 2
  if (parts.length > 0 && chars + nextLen > maxChars) break
  parts.push(q)
  indices.push(i)
  labels.push(stmt.label)
  chars += nextLen
  // Prefer ending on ENABLE TRIGGER (chunk boundary) when batch already has content
  if (parts.length >= 1 && /ENABLE TRIGGER USER/i.test(stmt.query) && chars > maxChars * 0.35) {
    break
  }
}

const query = parts.map((q) => (q.endsWith(';') ? q : q + ';')).join('\n')
const payload = {
  project_id: projectId,
  startIndex: indices[0],
  endIndex: indices[indices.length - 1],
  count: indices.length,
  total: manifest.statements.length,
  labels,
  indices,
  chars: query.length,
  query,
}
writeFileSync(join(outDir, '_next-mcp-batch.json'), JSON.stringify(payload), 'utf8')
writeFileSync(join(outDir, '_next-mcp-batch.sql'), query, 'utf8')
console.log(
  `BATCH ${payload.startIndex}-${payload.endIndex} (${payload.count} stmts, ${payload.chars} chars) → ${payload.endIndex + 1}/${payload.total}`,
)
