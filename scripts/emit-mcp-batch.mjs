/**
 * Output MCP execute_sql args JSON for batch N to stdout.
 * Usage: node scripts/emit-mcp-batch.mjs <N>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const n = parseInt(process.argv[2], 10)
if (!n) {
  console.error('Usage: node emit-mcp-batch.mjs <N>')
  process.exit(1)
}

const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
let query
if (fs.existsSync(payloadPath)) {
  query = JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query
} else {
  const batchPath = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)
  query = fs.readFileSync(batchPath, 'utf8')
  if (n >= 5) {
    query = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${query}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
}

process.stdout.write(JSON.stringify({ project_id: 'fqhisghfuuexfhqqdqcb', query, batch: n }))
