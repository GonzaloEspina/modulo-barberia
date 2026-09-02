import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const start = parseInt(process.argv[2] ?? '5', 10)
const end = parseInt(process.argv[3] ?? '76', 10)
const chunkSize = parseInt(process.argv[4] ?? '5', 10)

const chunks = []
for (let i = start; i <= end; i += chunkSize) {
  const lo = i
  const hi = Math.min(end, i + chunkSize - 1)
  const parts = []
  for (let n = lo; n <= hi; n++) {
    const file = path.join(outDir, `batch-${String(n).padStart(3, '0')}.sql`)
    let sql = fs.readFileSync(file, 'utf8')
    if (n >= 5) {
      sql = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${sql}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
    }
    parts.push(sql)
  }
  const query = parts.join('\n')
  const out = path.join(outDir, `_chunk-${String(lo).padStart(3, '0')}-${String(hi).padStart(3, '0')}.json`)
  fs.writeFileSync(out, JSON.stringify({ project_id: 'fqhisghfuuexfhqqdqcb', query, batches: `${lo}-${hi}` }))
  chunks.push({ lo, hi, out, len: query.length })
  console.log(JSON.stringify({ lo, hi, len: query.length, out }))
}
