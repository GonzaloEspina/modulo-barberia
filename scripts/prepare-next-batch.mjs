/**
 * Prepare next batch for MCP apply. Tracks progress in batch-apply-log.txt.
 * Usage: node scripts/prepare-next-batch.mjs
 * Writes scripts/.import-output/_next-mcp.json and prints batch number or DONE.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const logPath = path.join(outDir, 'batch-apply-log.txt')
const start = 5
const end = 76

function completedBatches() {
  if (!fs.existsSync(logPath)) return new Set()
  const lines = fs.readFileSync(logPath, 'utf8').split('\n')
  const done = new Set()
  for (const line of lines) {
    const m = line.match(/^OK batch (\d+)\/76/)
    if (m) done.add(parseInt(m[1], 10))
  }
  return done
}

function loadQuery(n) {
  const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
  if (fs.existsSync(payloadPath)) {
    return JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query
  }
  const batchPath = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)
  let sql = fs.readFileSync(batchPath, 'utf8')
  if (n >= 5) {
    sql = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${sql}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
  return sql
}

const done = completedBatches()
let next = null
for (let n = start; n <= end; n++) {
  if (!done.has(n)) {
    next = n
    break
  }
}

if (next === null) {
  console.log('DONE')
  process.exit(0)
}

const query = loadQuery(next)
const payload = { project_id: 'fqhisghfuuexfhqqdqcb', query, batch: next }
fs.writeFileSync(path.join(outDir, '_next-mcp.json'), JSON.stringify(payload))
console.log(JSON.stringify({ batch: next, queryLen: query.length }))
