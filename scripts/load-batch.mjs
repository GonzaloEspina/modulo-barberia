import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const batch = parseInt(process.argv[2], 10)
if (!batch || batch < 1 || batch > 76) {
  console.error('Usage: node scripts/load-batch.mjs <1-76>')
  process.exit(1)
}

const payloadPath = path.join(outDir, `_batch-${String(batch).padStart(3, '0')}.payload.json`)
const p = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
process.stdout.write(JSON.stringify({ project_id: p.project_id, query: p.query }))
