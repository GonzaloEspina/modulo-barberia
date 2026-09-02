import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '.import-output');
const n = parseInt(process.argv[2], 10);
if (!n || n < 1 || n > 76) {
  console.error('Usage: node get-batch-query.mjs <1-76>');
  process.exit(1);
}
const file = path.join(dir, `batch-${String(n).padStart(3, '0')}.sql`);
let sql = fs.readFileSync(file, 'utf8');
if (n >= 5) {
  sql = `ALTER TABLE public.appointments DISABLE TRIGGER USER;\n${sql}\nALTER TABLE public.appointments ENABLE TRIGGER USER;`;
}
process.stdout.write(sql);
