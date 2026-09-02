import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const projectId = process.env.SUPABASE_PROJECT_ID ?? 'fqhisghfuuexfhqqdqcb'
const accessToken = process.env.SUPABASE_ACCESS_TOKEN

if (!accessToken) {
  console.error('Set SUPABASE_ACCESS_TOKEN to run apply-import-batches.mjs')
  process.exit(1)
}

const files = (await readdir(outDir))
  .filter((f) => f.startsWith('batch-') && f.endsWith('.sql'))
  .sort()

for (const file of files) {
  const query = await readFile(join(outDir, file), 'utf8')
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`FAILED ${file}: ${res.status} ${text}`)
    process.exit(1)
  }
  console.log(`OK ${file}`)
}

console.log(`Applied ${files.length} batches`)
