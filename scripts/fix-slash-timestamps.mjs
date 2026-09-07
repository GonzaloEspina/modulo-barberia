import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = join(__dirname, '.import-output/_mcp-manifest.json')
const m = JSON.parse(readFileSync(path, 'utf8'))
const re = /'(\d{4}-\d{2}-\d{2}T\d{2})\/(\d{2})\/(\d{2})'/g
let total = 0
const byIndex = []
for (let i = 0; i < m.statements.length; i++) {
  const q = m.statements[i].query
  const matches = [...q.matchAll(re)]
  if (matches.length) {
    byIndex.push({
      i,
      label: m.statements[i].label,
      count: matches.length,
      samples: matches.slice(0, 3).map((x) => x[0]),
    })
    m.statements[i].query = q.replace(re, "'$1:$2:$3'")
    m.statements[i].chars = m.statements[i].query.length
    total += matches.length
  }
}
writeFileSync(path, JSON.stringify(m))
console.log(JSON.stringify({ totalFixed: total, statements: byIndex }, null, 2))
