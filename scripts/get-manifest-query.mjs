import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const index = Number(process.argv[2])
const manifest = JSON.parse(readFileSync(join(__dirname, '.import-output/_mcp-manifest.json'), 'utf8'))
const stmt = manifest.statements[index]
if (!stmt) {
  console.error(`No statement at index ${index}`)
  process.exit(1)
}
process.stdout.write(JSON.stringify({ index, label: stmt.label, query: stmt.query }))
