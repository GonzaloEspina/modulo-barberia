import fs from 'node:fs';
import path from 'node:path';

const projectId = process.argv[2] || 'fqhisghfuuexfhqqdqcb';
const name = process.argv[3];
if (!name) {
  console.error('Usage: node scripts/read-apply-args.mjs [project_id] <migration_name>');
  process.exit(1);
}

const jsonPath = path.resolve('.migration-payloads', `apply-${name}.json`);
const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
process.stdout.write(JSON.stringify({
  project_id: projectId,
  name: payload.name,
  query: payload.query,
}));
