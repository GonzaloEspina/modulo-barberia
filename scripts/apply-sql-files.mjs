/**
 * Lee archivos .sql y los imprime con marcadores para aplicación vía MCP.
 * Uso: node scripts/apply-sql-files.mjs scripts/.import-output/client-part-01.sql
 */
import fs from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node apply-sql-files.mjs <sql-file>')
  process.exit(1)
}
const query = fs.readFileSync(file, 'utf8')
process.stdout.write(JSON.stringify({ project_id: 'fqhisghfuuexfhqqdqcb', query }))
