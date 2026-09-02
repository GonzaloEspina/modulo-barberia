import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '.import-output')
const from = Number(process.argv[2])
const to = Number(process.argv[3])
const manifest = JSON.parse(readFileSync(join(outDir, '_mcp-manifest.json'), 'utf8'))

for (let i = from; i <= to; i++) {
  const label = manifest.statements[i]?.label ?? ''
  spawnSync(process.execPath, [join(__dirname, 'mark-mcp-progress.mjs'), String(i), label], { stdio: 'inherit' })
}
console.log(`marked ${from}-${to}`)
