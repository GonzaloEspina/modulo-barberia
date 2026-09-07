/**
 * Apply one batch N via Supabase MCP execute_sql by reading payload and printing args path.
 * Agent should CallDynamicTool execute_sql with contents of the written args file.
 * Usage: node scripts/apply-batch-mcp-step.mjs <N>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const n = parseInt(process.argv[2], 10)
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.import-output')
const projectId = 'fqhisghfuuexfhqqdqcb'
const logPath = path.join(outDir, 'batch-apply-log.txt')

if (!n) {
  console.error('Usage: node apply-batch-mcp-step.mjs <N>')
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

const argsPath = path.join(outDir, '_mcp-step-args.json')
fs.writeFileSync(argsPath, JSON.stringify({ project_id: projectId, query, batch: n }))
console.log(JSON.stringify({ batch: n, argsPath, queryLen: query.length }))
