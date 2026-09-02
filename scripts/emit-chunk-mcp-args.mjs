/**
 * Applies one chunk via MCP by printing JSON args to stdout.
 * Parent agent reads stdout and calls execute_sql.
 * Usage: node emit-chunk-mcp-args.mjs 1
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const n = String(process.argv[2] ?? '1').padStart(2, '0')
const outDir = join(__dirname, '.import-output')
const query = readFileSync(join(outDir, `combined-chunk-${n}.sql`), 'utf8')
process.stdout.write(JSON.stringify({ project_id: 'fqhisghfuuexfhqqdqcb', query }))
