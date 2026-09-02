/**
 * Mark batch N as OK in batch-apply-log.txt
 * Usage: node scripts/mark-batch-ok.mjs <N>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const n = parseInt(process.argv[2], 10)
if (!n) {
  console.error('Usage: node mark-batch-ok.mjs <N>')
  process.exit(1)
}

const logPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.import-output', 'batch-apply-log.txt')
fs.appendFileSync(logPath, `OK batch ${n}/76\n`)
console.log(`OK batch ${n}/76`)
