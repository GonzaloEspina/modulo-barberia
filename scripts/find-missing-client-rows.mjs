import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const out = join(dirname(fileURLToPath(import.meta.url)), '.import-output')
const missing = JSON.parse(fs.readFileSync(join(out, '_missing-clients.json'), 'utf8'))
const m = JSON.parse(fs.readFileSync(join(out, '_mcp-manifest.json'), 'utf8'))

const stubs = []
for (const id of missing) {
  let found = false
  for (const s of m.statements) {
    if (!/INSERT INTO clients/i.test(s.query)) continue
    if (!s.query.toLowerCase().includes(id)) continue
    const idx = s.query.toLowerCase().indexOf(id)
    const start = s.query.lastIndexOf('(', idx)
    const end = s.query.indexOf(')', idx)
    const row = s.query.slice(start, end + 1)
    console.log(id, 'in', s.label)
    console.log(row)
    stubs.push(row)
    found = true
    break
  }
  if (!found) {
    console.log(id, 'NOT in any client INSERT — creating stub')
    stubs.push(
      `('${id}', 'a0000000-0000-4000-8000-000000000001', 'Importado', 'Sin ficha', NULL, '0000000${id.slice(-6)}', NULL, NULL, 'inherit', TRUE)`,
    )
  }
}

const sql = `INSERT INTO clients (id, organization_id, first_name, last_name, nickname, phone_normalized, phone_display, email, booking_override, is_active) VALUES
${stubs.join(',\n')}
ON CONFLICT (id) DO NOTHING;`
fs.writeFileSync(join(out, '_orphan-clients.sql'), sql)
console.log('Wrote _orphan-clients.sql', sql.length, 'chars')
