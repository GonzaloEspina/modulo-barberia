/**
 * Split a large appointments INSERT into N smaller INSERTs.
 * Usage: node scripts/split-sql-insert.mjs <in.sql> <out-prefix> [rowsPerFile=15]
 */
import fs from 'fs'

const [,, inPath, outPrefix, rowsPer = '15'] = process.argv
const sql = fs.readFileSync(inPath, 'utf8')
const headerMatch = sql.match(/^(INSERT INTO[\s\S]*?VALUES)\s*/i)
if (!headerMatch) {
  console.error('No INSERT header')
  process.exit(1)
}
const header = headerMatch[1]
const body = sql.slice(headerMatch[0].length).replace(/\s*ON CONFLICT[\s\S]*$/i, '')
// Split on ),( boundaries between value tuples
const parts = []
let depth = 0
let start = 0
for (let i = 0; i < body.length; i++) {
  const c = body[i]
  if (c === '(') depth++
  else if (c === ')') {
    depth--
    if (depth === 0) {
      // look ahead for comma
      let j = i + 1
      while (j < body.length && /\s/.test(body[j])) j++
      parts.push(body.slice(start, i + 1).trim())
      if (body[j] === ',') {
        start = j + 1
        i = j
      } else {
        start = body.length
        break
      }
    }
  }
}
const n = Number(rowsPer)
let file = 0
const files = []
for (let i = 0; i < parts.length; i += n) {
  const chunk = parts.slice(i, i + n)
  const out = `${header}\n${chunk.join(',\n')}\nON CONFLICT (id) DO NOTHING;`
  const path = `${outPrefix}-${String(++file).padStart(2, '0')}.sql`
  fs.writeFileSync(path, out)
  files.push(path)
}
console.log(JSON.stringify({ rows: parts.length, files: files.length, paths: files }))
