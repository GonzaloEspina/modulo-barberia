import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.import-output')
const payloadPath = path.join(outDir, '_batch-076.payload.json')
const j = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
j.query = j.query.replace(/'variable'/g, "'general'")
fs.writeFileSync(payloadPath, JSON.stringify(j))
console.log('fixed batch 76 payload')
