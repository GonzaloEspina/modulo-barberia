/** Output JSON args for MCP execute_sql for batch N */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const n = parseInt(process.argv[2], 10)
if (!n) {
  console.error('Usage: node get-mcp-batch-args.mjs <N>')
  process.exit(1)
}

const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
let query
if (fs.existsSync(payloadPath)) {
  query = JSON.parse(fs.readFileSync(payloadPath, 'utf8')).query
} else {
  const sqlPath = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)
  query = fs.readFileSync(sqlPath, 'utf8')
  if (n >= 5) {
    query = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${query}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
  }
}

process.stdout.write(JSON.stringify({ project_id: projectId, query }))
