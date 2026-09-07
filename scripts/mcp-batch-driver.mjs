/**
 * Apply all pending batches via Supabase MCP execute_sql (Cursor plugin OAuth).
 * Reads query from payload files; prints progress to stdout and batch-apply-log.txt.
 *
 * This script is meant to be driven by the agent calling execute_sql per batch.
 * It outputs one batch at a time as JSON on stdout for agent consumption.
 *
 * Usage:
 *   node scripts/mcp-batch-driver.mjs next     # next pending batch args
 *   node scripts/mcp-batch-driver.mjs mark N   # mark batch N OK
 *   node scripts/mcp-batch-driver.mjs list     # pending batches
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const logPath = path.join(outDir, 'batch-apply-log.txt')
const start = 5
const end = 76

function completed() {
  if (!fs.existsSync(logPath)) return new Set()
  const done = new Set()
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
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

const cmd = process.argv[2] ?? 'next'
const done = completed()

if (cmd === 'list') {
  const pending = []
  for (let n = start; n <= end; n++) if (!done.has(n)) pending.push(n)
  console.log(JSON.stringify({ done: [...done], pending, count: pending.length }))
  process.exit(0)
}

if (cmd === 'mark') {
  const n = parseInt(process.argv[3], 10)
  if (!n) {
    console.error('Usage: mcp-batch-driver.mjs mark <N>')
    process.exit(1)
  }
  fs.appendFileSync(logPath, `OK batch ${n}/76\n`)
  console.log(`OK batch ${n}/76`)
  process.exit(0)
}

if (cmd === 'next') {
  for (let n = start; n <= end; n++) {
    if (done.has(n)) continue
    const query = loadQuery(n)
    const out = path.join(outDir, '_mcp-apply-now.json')
    fs.writeFileSync(out, JSON.stringify({ batch: n, project_id: projectId, query }))
    console.log(JSON.stringify({ batch: n, total: end, queryLen: query.length, file: out }))
    process.exit(0)
  }
  console.log(JSON.stringify({ allDone: true, done: [...done] }))
  process.exit(0)
}

console.error('Unknown command:', cmd)
process.exit(1)
