/**
 * Loop apply batches 5-76: extracts query, calls Management API if token set,
 * otherwise prints next batch number for MCP agent apply.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '.import-output')
const logPath = path.join(outDir, 'batch-apply-log.txt')
const start = parseInt(process.argv[2] ?? '5', 10)
const end = parseInt(process.argv[3] ?? '76', 10)
const token = process.env.SUPABASE_ACCESS_TOKEN

function completed() {
  if (!fs.existsSync(logPath)) return new Set()
  const done = new Set()
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    const m = line.match(/^OK batch (\d+)\/76/)
    if (m) done.add(parseInt(m[1], 10))
  }
  return done
}

const done = completed()

if (!token) {
  for (let n = start; n <= end; n++) {
    if (done.has(n)) continue
    console.log(JSON.stringify({ next: n, skip: [...done] }))
    process.exit(0)
  }
  console.log(JSON.stringify({ allDone: true }))
  process.exit(0)
}

for (let n = start; n <= end; n++) {
  if (done.has(n)) {
    console.log(`SKIP batch ${n}/76`)
    continue
  }
  const r = spawnSync(process.execPath, [path.join(__dirname, 'apply-one-batch-api.mjs'), String(n)], {
    env: process.env,
    stdio: 'inherit',
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.log('ALL DONE')
