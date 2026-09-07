import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))

const clientInserts = new Set()
const apptClientIds = new Set()

for (const stmt of manifest.statements) {
  if (stmt.query.includes('INSERT INTO clients')) {
    for (const m of stmt.query.matchAll(/\('([0-9a-f-]{36})'/g)) clientInserts.add(m[1])
  }
  if (stmt.query.includes('INSERT INTO appointments')) {
    const rows = stmt.query.split(/\),\s*\(/)
    for (const row of rows) {
      const uuids = [...row.matchAll(/'([0-9a-f-]{36})'::uuid/g)].map((x) => x[1])
      if (uuids.length >= 3) apptClientIds.add(uuids[2])
    }
  }
}

const missing = [...apptClientIds].filter((id) => !clientInserts.has(id))
console.log(JSON.stringify({
  clientInserts: clientInserts.size,
  apptClientIds: apptClientIds.size,
  missingCount: missing.length,
  missing: missing.slice(0, 20),
}, null, 2))
