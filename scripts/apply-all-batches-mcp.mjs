/**
 * Helper for MCP batch import: reads progress, prepares next batch args.
 * Parent agent calls execute_sql with _mcp-call.json contents, then marks progress.
 *
 * Usage:
 *   node scripts/apply-all-batches-mcp.mjs prepare [N]  # prepare batch N or next
 *   node scripts/apply-all-batches-mcp.mjs mark N       # mark batch N complete
 *   node scripts/apply-all-batches-mcp.mjs status       # show progress
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const progressPath = path.join(__dirname, 'import-progress.txt')
const projectId = 'fqhisghfuuexfhqqdqcb'

function readProgress() {
  if (!fs.existsSync(progressPath)) return 0
  return parseInt(fs.readFileSync(progressPath, 'utf8').trim() || '0', 10) || 0
}

function loadBatch(n) {
  const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
  if (fs.existsSync(payloadPath)) {
    return JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
  }
  const sqlPath = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)
  let query = fs.readFileSync(sqlPath, 'utf8')
  if (n >= 5) {
    query = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${query}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
  return { project_id: projectId, query, batch: n }
}

const cmd = process.argv[2] || 'prepare'

if (cmd === 'status') {
  const done = readProgress()
  console.log(JSON.stringify({ lastCompleted: done, next: done + 1, total: 76, finished: done >= 76 }))
  process.exit(0)
}

if (cmd === 'mark') {
  const n = parseInt(process.argv[3], 10)
  if (!n) {
    console.error('Usage: apply-all-batches-mcp.mjs mark <N>')
    process.exit(1)
  }
  fs.writeFileSync(progressPath, String(n))
  console.log(JSON.stringify({ marked: n }))
  process.exit(0)
}

if (cmd === 'prepare') {
  const explicit = process.argv[3] ? parseInt(process.argv[3], 10) : null
  const n = explicit ?? readProgress() + 1
  if (n < 1 || n > 76) {
    console.log(JSON.stringify({ done: true, lastCompleted: readProgress() }))
    process.exit(0)
  }
  const p = loadBatch(n)
  fs.writeFileSync(path.join(outDir, '_mcp-call.json'), JSON.stringify({ project_id: p.project_id, query: p.query, batch: n }))
  console.log(JSON.stringify({ batch: n, queryLen: p.query.length, file: 'batch-' + String(n).padStart(3, '0') + '.sql' }))
  process.exit(0)
}

console.error('Unknown command:', cmd)
process.exit(1)
