import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const start = parseInt(process.argv[2] || '1', 10)
const end = parseInt(process.argv[3] || '76', 10)

for (let n = start; n <= end; n++) {
  const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
  const p = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
  const invokePath = path.join(outDir, '_invoke.json')
  fs.writeFileSync(invokePath, JSON.stringify({ project_id: p.project_id, query: p.query, batch: n }))
  console.log(`PREPARED batch-${String(n).padStart(3, '0')} len=${p.query.length}`)
}
