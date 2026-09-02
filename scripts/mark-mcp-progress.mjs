import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const progressPath = join(__dirname, '.import-output/_mcp-progress.json')
const index = Number(process.argv[2])
const label = process.argv[3] ?? ''
const progress = JSON.parse(readFileSync(progressPath, 'utf8'))
progress.lastIndex = index
progress.completed.push({ index, label })
writeFileSync(progressPath, JSON.stringify(progress, null, 2))
console.log(`marked ${index}`)
