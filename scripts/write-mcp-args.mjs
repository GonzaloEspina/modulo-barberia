import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const n = parseInt(process.argv[2], 10)
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.import-output')
const payloadPath = path.join(outDir, `_batch-${String(n).padStart(3, '0')}.payload.json`)
const j = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
const out = path.join(outDir, `_mcp-args-${n}.json`)
fs.writeFileSync(out, JSON.stringify({ project_id: j.project_id || 'fqhisghfuuexfhqqdqcb', query: j.query }))
console.log(out, j.query.length)
