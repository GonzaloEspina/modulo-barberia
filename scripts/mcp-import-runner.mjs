#!/usr/bin/env node
/**
 * Prepares MCP execute_sql args for a batch (1-76).
 * Usage: node scripts/mcp-import-runner.mjs <batchNumber>
 * Writes scripts/.import-output/_invoke.json with { project_id, query, batch }
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const n = parseInt(process.argv[2], 10)
if (!n || n < 1 || n > 76) {
  console.error('Usage: node scripts/mcp-import-runner.mjs <1-76>')
  process.exit(1)
}

const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
const p = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
const invoke = { project_id: p.project_id, query: p.query, batch: n }
const invokePath = path.join(outDir, '_invoke.json')
fs.writeFileSync(invokePath, JSON.stringify(invoke))
console.log(JSON.stringify({ batch: n, queryLen: p.query.length, invokePath }))
