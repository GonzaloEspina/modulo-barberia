/**
 * Mark progress for each index in a range using manifest labels.
 * Usage: node scripts/mark-mcp-batch-progress.mjs <fromIndex> <toIndex>
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(join(__dirname, '.import-output/_mcp-manifest.json'), 'utf8'))
const from = Number(process.argv[2])
const to = Number(process.argv[3])

for (let i = from; i <= to; i++) {
  const label = manifest.statements[i]?.label ?? `stmt-${i}`
  spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress.mjs'), String(i), label], {
    stdio: 'inherit',
  })
}
console.log(`marked ${from}-${to}`)
