import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = join(__dirname, '.import-output/_mcp-manifest.json')
const m = JSON.parse(readFileSync(path, 'utf8'))
const q = m.statements[267].query
const count = (q.match(/'variable'/g) || []).length
m.statements[267].query = q.replaceAll("'variable'", "'general'")
m.statements[267].chars = m.statements[267].query.length
writeFileSync(path, JSON.stringify(m))
console.log(JSON.stringify({ replacements: count, chars: m.statements[267].chars }))
