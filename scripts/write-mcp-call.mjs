import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const n = parseInt(process.argv[2], 10)
if (!n || n < 1 || n > 76) {
  console.error('Usage: node write-mcp-call.mjs <1-76>')
  process.exit(1)
}

const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
const p = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
const out = { project_id: p.project_id, query: p.query, batch: n }
fs.writeFileSync(path.join(outDir, '_mcp-call.json'), JSON.stringify(out))
console.log(JSON.stringify({ batch: n, queryLen: p.query.length }))
