/**
 * Helper: reads chunk N SQL and writes UTF-8 JSON args for MCP execute_sql.
 * Usage: node apply-chunk-mcp-helper.mjs 1
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const n = String(process.argv[2] ?? '1').padStart(2, '0')
const outDir = join(__dirname, '.import-output')
const query = readFileSync(join(outDir, `combined-chunk-${n}.sql`), 'utf8')
const payload = { project_id: 'fqhisghfuuexfhqqdqcb', query }
writeFileSync(join(outDir, '_current-mcp-args.json'), JSON.stringify(payload), 'utf8')
console.log(`chunk ${n}: ${query.length} chars`)
