/**
 * Reads batch N payload and prints MCP execute_sql args as JSON to stdout.
 * Usage: node scripts/emit-batch-mcp-args.mjs <N>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const n = parseInt(process.argv[2], 10)
if (!n || n < 1 || n > 76) {
  console.error('Usage: node emit-batch-mcp-args.mjs <1-76>')
  process.exit(1)
}

const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
const batchPath = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)

let query
if (fs.existsSync(payloadPath)) {
  query = JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query
} else {
  query = fs.readFileSync(batchPath, 'utf8')
  if (n >= 5) {
    query = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${query}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
}

const args = { project_id: 'fqhisghfuuexfhqqdqcb', query, batch: n }
const outPath = path.join(outDir, `_emit-batch-${n}.json`)
fs.writeFileSync(outPath, JSON.stringify(args))
console.log(JSON.stringify({ batch: n, outPath, queryLen: query.length }))
