/**
 * Aplica chunks SQL generados por combine-import-chunks.mjs
 * Requiere: SUPABASE_ACCESS_TOKEN (token personal de supabase.com/dashboard/account/tokens)
 */
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectId = process.env.SUPABASE_PROJECT_ID ?? 'fqhisghfuuexfhqqdqcb'
const token = process.env.SUPABASE_ACCESS_TOKEN

if (!token) {
  console.error('Definí SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const outDir = join(__dirname, '.import-output')
const files = (await readdir(outDir))
  .filter((f) => f.startsWith('combined-chunk-') && f.endsWith('.sql'))
  .sort()

for (const file of files) {
  const query = await readFile(join(outDir, file), 'utf8')
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) {
    console.error(`FAIL ${file}: ${res.status} ${body}`)
    process.exit(1)
  }
  console.log(`OK ${file}`)
}

console.log(`Applied ${files.length} chunks`)
