/**
 * Builds MCP manifest, splitting large INSERTs into row batches.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const MAX_CHARS = 30000
const ROW_BATCH = 80
const manifest = []
const seenClientPhones = new Set()

/** Drop duplicate (organization_id, phone_normalized) rows; keep first occurrence. */
function dedupeClientInsert(sql) {
  if (!sql.includes('INSERT INTO clients')) return sql
  const suffixMatch = sql.match(/\s*(ON CONFLICT[\s\S]*);?\s*$/)
  const suffix = suffixMatch ? '\n' + suffixMatch[1].replace(/;?\s*$/, ';') : ';'
  const valuesIdx = sql.search(/\bVALUES\b/i)
  if (valuesIdx === -1) return sql
  const prefix = sql.slice(0, valuesIdx + 'VALUES'.length)
  const valuesBody = sql.slice(valuesIdx + 'VALUES'.length, suffixMatch ? sql.length - suffixMatch[0].length : sql.length).trim()
  const rows = valuesBody.split(/\),\s*\n/).map((r, i, arr) => (i < arr.length - 1 ? r + ')' : r))
  const kept = []
  for (const row of rows) {
    const phone = row.match(/, '([^']+)', '[^']*', (?:NULL|'[^']*'), 'inherit'/)?.[1]
      ?? row.match(/, '([^']+)', NULL, NULL, 'inherit'/)?.[1]
    if (phone && seenClientPhones.has(phone)) continue
    if (phone) seenClientPhones.add(phone)
    kept.push(row)
  }
  if (kept.length === 0) return ''
  return prefix + '\n' + kept.join(',\n') + suffix
}

function splitInsert(sql, label) {
  if (sql.length <= MAX_CHARS) {
    manifest.push({ label, query: sql, chars: sql.length })
    return
  }
  const disable = sql.match(/^ALTER TABLE[\s\S]*?DISABLE TRIGGER USER;\s*/)?.[0] ?? ''
  const enable = sql.match(/\s*ALTER TABLE[\s\S]*?ENABLE TRIGGER USER;\s*$/)?.[0] ?? ''
  let body = sql.slice(disable.length, sql.length - enable.length).trim()
  if (!body.endsWith(';')) body += ';'

  const valuesIdx = body.search(/\bVALUES\b/i)
  if (valuesIdx === -1) {
    manifest.push({ label, query: sql, chars: sql.length })
    return
  }
  const prefix = body.slice(0, valuesIdx + 'VALUES'.length)
  const suffixMatch = body.match(/\s*(ON CONFLICT[\s\S]*);?\s*$/)
  const suffix = suffixMatch ? '\n' + suffixMatch[1].replace(/;?\s*$/, ';') : ';'
  const valuesBody = body.slice(valuesIdx + 'VALUES'.length, suffixMatch ? body.length - suffixMatch[0].length : body.length).trim()
  const rows = valuesBody.split(/\),\s*\n/).map((r, i, arr) => (i < arr.length - 1 ? r + ')' : r))

  for (let i = 0; i < rows.length; i += ROW_BATCH) {
    const batch = rows.slice(i, i + ROW_BATCH)
    const q = disable + prefix + '\n' + batch.join(',\n') + suffix + enable
    const n = String(Math.floor(i / ROW_BATCH) + 1).padStart(2, '0')
    manifest.push({ label: `${label}/batch-${n}`, query: q, chars: q.length })
  }
}

function addFile(label, sql) {
  const stmts = sql.split(/;\s*\n(?=INSERT|ALTER)/).map((s) => s.trim()).filter(Boolean).map((s) => (s.endsWith(';') ? s : s + ';'))
  stmts.forEach((stmt, i) => {
    const stmtLabel = stmts.length > 1 ? `${label}/stmt-${i + 1}` : label
    splitInsert(stmt, stmtLabel)
  })
}

// Chunk 01 clients batches
const clientsBatchesDir = join(outDir, 'parts-chunk-01/clients-batches')
for (const f of readdirSync(clientsBatchesDir).filter((x) => x.endsWith('.sql')).sort()) {
  const q = dedupeClientInsert(readFileSync(join(clientsBatchesDir, f), 'utf8'))
  if (!q) continue
  manifest.push({ label: `chunk-01/clients/${f}`, query: q, chars: q.length })
}
for (const f of ['part-2.sql', 'part-3.sql', 'part-4.sql']) {
  const q = readFileSync(join(outDir, 'parts-chunk-01', f), 'utf8')
  manifest.push({ label: `chunk-01/${f}`, query: q, chars: q.length })
}

for (let n = 2; n <= 48; n++) {
  const nn = String(n).padStart(2, '0')
  addFile(`chunk-${nn}`, readFileSync(join(outDir, `combined-chunk-${nn}.sql`), 'utf8'))
}

writeFileSync(join(outDir, '_mcp-manifest.json'), JSON.stringify({ project_id: 'fqhisghfuuexfhqqdqcb', statements: manifest }, null, 2), 'utf8')
const max = Math.max(...manifest.map((m) => m.chars))
console.log(`Manifest: ${manifest.length} statements, max ${max} chars`)
