#!/usr/bin/env node
/**
 * Execute manifest statements via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN (same auth the MCP plugin uses).
 * Usage: node scripts/execute-manifest-range.mjs <startIndex> <endIndex>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectId = 'fqhisghfuuexfhqqdqcb'
const accessToken = process.env.SUPABASE_ACCESS_TOKEN
const start = Number(process.argv[2] ?? 17)
const end = Number(process.argv[3] ?? 268)
const progressPath = join(__dirname, '.import-output/_mcp-progress.json')
const manifest = JSON.parse(readFileSync(join(__dirname, '.import-output/_mcp-manifest.json'), 'utf8'))

if (!accessToken) {
  console.error('SUPABASE_ACCESS_TOKEN is required')
  process.exit(1)
}

const progress = JSON.parse(readFileSync(progressPath, 'utf8'))

async function executeSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${res.status} ${text}`)
  }
  return text
}

for (let i = start; i <= end; i++) {
  const stmt = manifest.statements[i]
  if (!stmt) {
    console.error(`Missing statement at index ${i}`)
    process.exit(1)
  }
  process.stdout.write(`[${i}/${end}] ${stmt.label} ... `)
  try {
    await executeSql(stmt.query)
    progress.lastIndex = i
    progress.completed.push({ index: i, label: stmt.label })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.log('OK')
  } catch (err) {
    progress.errors.push({ index: i, label: stmt.label, error: String(err.message ?? err) })
    writeFileSync(progressPath, JSON.stringify(progress, null, 2))
    console.log('FAIL')
    console.error(`Stopped at index ${i} (${stmt.label}): ${err.message ?? err}`)
    process.exit(1)
  }
}

console.log(`Done. lastIndex=${end}`)
