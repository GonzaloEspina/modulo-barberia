/**
 * Print one manifest statement as JSON for MCP execute_sql.
 * Usage: node get-manifest-stmt.mjs [index]
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(join(__dirname, '.import-output/_mcp-manifest.json'), 'utf8'))
const idx = Number(process.argv[2] ?? 0)
const stmt = manifest.statements[idx]
if (!stmt) {
  console.error(`No statement at index ${idx}`)
  process.exit(1)
}
process.stdout.write(JSON.stringify({ index: idx, total: manifest.statements.length, label: stmt.label, project_id: manifest.project_id, query: stmt.query }))
