/**
 * Read SQL or MCP JSON and print {project_id, query} for agent MCP apply.
 * Usage: node scripts/emit-mcp-args.mjs <sqlFile|jsonFile>
 */
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) {
  console.error('Usage: node emit-mcp-args.mjs <file>')
  process.exit(1)
}

let project_id = 'fqhisghfuuexfhqqdqcb'
let query
if (path.endsWith('.json')) {
  const j = JSON.parse(readFileSync(path, 'utf8'))
  project_id = j.project_id ?? project_id
  query = j.query
} else {
  query = readFileSync(path, 'utf8')
}

process.stdout.write(JSON.stringify({ project_id, query }))
