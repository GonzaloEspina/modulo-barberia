import fs from 'node:fs';
import path from 'node:path';

const projectId = 'fqhisghfuuexfhqqdqcb';
const payloadDir = path.resolve('.migration-payloads');
const name = process.argv[2];

if (!name) {
  console.error('Usage: node scripts/apply-migration-payload.mjs <migration_name>');
  process.exit(1);
}

const payloadPath = path.join(payloadDir, `${name}.json`);
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const outPath = path.join(payloadDir, 'next-apply.json');
fs.writeFileSync(
  outPath,
  JSON.stringify({ project_id: projectId, name: payload.name, query: payload.query })
);
console.log(`Wrote ${outPath} (${payload.query.length} chars)`);
