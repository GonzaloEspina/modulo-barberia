import fs from 'node:fs';
import path from 'node:path';

const projectId = 'fqhisghfuuexfhqqdqcb';
const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/apply-migration-from-json.mjs <name>');
  process.exit(1);
}

const file = path.resolve('.migration-payloads', `apply-${name}.json`);
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
process.stdout.write(JSON.stringify({
  project_id: projectId,
  name: payload.name,
  query: payload.query,
}));
