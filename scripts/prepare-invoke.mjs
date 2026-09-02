import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const batch = parseInt(process.argv[2], 10)
const payloadPath = path.join(outDir, `_batch-${String(batch).padStart(3, '0')}.payload.json`)
const p = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
const invoke = { project_id: p.project_id, query: p.query }
fs.writeFileSync(path.join(outDir, '_invoke.json'), JSON.stringify(invoke))
console.log(JSON.stringify({ batch, project_id: p.project_id, queryLen: p.query.length }))
