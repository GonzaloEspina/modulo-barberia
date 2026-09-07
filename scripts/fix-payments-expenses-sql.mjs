import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '.import-output')
const m = JSON.parse(readFileSync(join(out, '_mcp-manifest.json'), 'utf8'))

function fixPaidAt(query) {
  return query.replace(
    /'(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})'/g,
    (_, mm, dd, yyyy, t) =>
      `('${yyyy}-${mm}-${dd}T${t}'::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')`,
  )
}

function stripBadOnConflict(query) {
  // INSERT without id column cannot use ON CONFLICT (id)
  if (/INSERT INTO (payments|expenses|fixed_expenses)/i.test(query) && !/\(id,/i.test(query)) {
    return query.replace(/\s*ON CONFLICT \(id\) DO NOTHING;?\s*$/i, ';')
  }
  return query
}

for (const i of [261, 264, 267]) {
  let q = m.statements[i].query
  q = fixPaidAt(q)
  q = stripBadOnConflict(q)
  m.statements[i].query = q
  m.statements[i].chars = q.length
  writeFileSync(join(out, `_stmt-${i}-fixed.sql`), q)
  console.log(i, m.statements[i].label, 'len', q.length, 'slash dates', (q.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length)
}

writeFileSync(join(out, '_mcp-manifest.json'), JSON.stringify(m))
console.log('manifest updated')
console.log('---264---\n', m.statements[264].query)
console.log('---267---\n', m.statements[267].query)
console.log('---261 head---\n', m.statements[261].query.slice(0, 600))
