import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '.import-output');
const start = parseInt(process.argv[2] || '1', 10);
const end = parseInt(process.argv[3] || '76', 10);
const projectId = 'fqhisghfuuexfhqqdqcb';

for (let n = start; n <= end; n++) {
  const file = path.join(dir, `batch-${String(n).padStart(3, '0')}.sql`);
  let sql = fs.readFileSync(file, 'utf8');
  if (n >= 5) {
    sql = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${sql}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`;
  }
  const out = path.join(dir, `_batch-${String(n).padStart(3, '0')}.payload.json`);
  fs.writeFileSync(out, JSON.stringify({ project_id: projectId, query: sql, batch: n }));
  console.log(`prepared batch-${String(n).padStart(3, '0')} (${sql.length} chars)`);
}
