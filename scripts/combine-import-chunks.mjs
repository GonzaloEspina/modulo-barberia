import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const files = (await readdir(outDir)).filter((f) => f.startsWith('batch-')).sort()

const chunks = []
let current = []
let currentSize = 0
const maxSize = 90_000

for (const file of files) {
  const sql = await readFile(join(outDir, file), 'utf8')
  const wrapped = file >= 'batch-005.sql'
    ? `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${sql}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`
    : sql

  if (current.length > 0 && currentSize + wrapped.length > maxSize) {
    chunks.push(current.join('\n'))
    current = []
    currentSize = 0
  }

  current.push(wrapped)
  currentSize += wrapped.length
}

if (current.length) chunks.push(current.join('\n'))

for (let i = 0; i < chunks.length; i++) {
  const name = `combined-chunk-${String(i + 1).padStart(2, '0')}.sql`
  await writeFile(join(outDir, name), chunks[i])
  console.log(name, Math.round(chunks[i].length / 1024), 'KB')
}

console.log(`Created ${chunks.length} combined chunks`)
