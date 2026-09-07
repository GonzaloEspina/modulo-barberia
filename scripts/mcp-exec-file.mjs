/**
 * Print MCP execute_sql args JSON from a prepared args file.
 * Usage: node scripts/mcp-exec-file.mjs [path]
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const path = process.argv[2] ?? join(__dirname, '.import-output/_mcp-args.json')
const args = JSON.parse(readFileSync(path, 'utf8'))
process.stdout.write(JSON.stringify(args))
