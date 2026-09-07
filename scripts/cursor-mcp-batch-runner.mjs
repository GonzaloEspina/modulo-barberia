/**
 * Outputs next batch MCP args for Cursor agent execute_sql loop.
 * Usage: node scripts/cursor-mcp-batch-runner.mjs [batchN]
 * Order: 001, 005..076 (skips 002-004 assumed done)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const logPath = path.join(outDir, 'batch-apply-log.txt')
const projectId = 'fqhisghfuuexfhqqdqcb'

const ORDER = [1, ...Array.from({ length: 72 }, (_, i) => i + 5)]

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

const done = completed()
const explicit = process.argv[2] ? parseInt(process.argv[2], 10) : null
const n = explicit ?? ORDER.find((b) => !done.has(b))

if (!n) {
  console.log(JSON.stringify({ finished: true, completed: [...done].sort((a, b) => a - b) }))
  process.exit(0)
}

const query = loadQuery(n)
const out = { project_id: projectId, query, batch: n }
fs.writeFileSync(path.join(outDir, '_mcp-call.json'), JSON.stringify(out))
console.log(JSON.stringify({ batch: n, queryLen: query.length, completed: [...done].sort((a, b) => a - b) }))
