import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '.import-output')
const re = /(\d{4}-\d{2}-\d{2}T\d{2})\/(\d{2})\/(\d{2})/g

function fix(text) {
  return text.replace(re, '$1:$2:$3')
}

// Fix manifest
const manifestPath = join(out, '_mcp-manifest.json')
const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
let fixed = 0
for (const s of m.statements) {
  const next = fix(s.query)
  if (next !== s.query) {
    s.query = next
    s.chars = next.length
    fixed++
  }
}
writeFileSync(manifestPath, JSON.stringify(m))
console.log('manifest stmts fixed:', fixed)

// Fix all sql/json artifacts with slash times
let filesFixed = 0
for (const name of readdirSync(out)) {
  if (!/\.(sql|json)$/.test(name)) continue
  if (name === '_mcp-manifest.json') continue
  const path = join(out, name)
  const raw = readFileSync(path, 'utf8')
  if (!re.test(raw)) continue
  re.lastIndex = 0
  writeFileSync(path, fix(raw))
  filesFixed++
}
console.log('files fixed:', filesFixed)

const p = JSON.parse(readFileSync(join(out, '_mcp-progress.json'), 'utf8'))
const completed = new Set(p.completed.map((x) => x.index))
const missing = []
for (let i = 0; i <= p.lastIndex; i++) {
  if (!completed.has(i)) missing.push(i)
}
console.log('lastIndex', p.lastIndex, 'completed unique', completed.size, 'gaps before last', missing.length)
console.log('gaps sample', missing.slice(0, 20))

const types = {}
for (let i = p.lastIndex + 1; i < m.statements.length; i++) {
  const q = m.statements[i].query
  let t = 'other'
  if (/INSERT INTO appointments/i.test(q)) t = 'appointments'
  else if (/INSERT INTO payments/i.test(q)) t = 'payments'
  else if (/INSERT INTO expenses/i.test(q)) t = 'expenses'
  else if (/INSERT INTO appointment_services/i.test(q)) t = 'appointment_services'
  else if (/DISABLE TRIGGER|ENABLE TRIGGER/i.test(q)) t = 'triggers'
  else if (q.length < 80) t = 'small'
  types[t] = (types[t] || 0) + 1
}
console.log('remaining types', types)
console.log('42 has 01:01?', m.statements[42].query.includes('2025-12-20T01:01:00'))
console.log('42 still slash?', /(\d{4}-\d{2}-\d{2}T\d{2})\/(\d{2})\/(\d{2})/.test(m.statements[42].query))
