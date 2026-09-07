/**
 * Extract query from batch payload to plain SQL file for MCP apply.
 * Usage: node scripts/extract-batch-query.mjs <N>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const n = parseInt(process.argv[2], 10)
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.import-output')
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
const out = path.join(outDir, `_query-${n}.sql`)
fs.writeFileSync(out, query)
console.log(out, query.length)
