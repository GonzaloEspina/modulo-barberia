import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const n = parseInt(process.argv[2], 10);
const payloadPath = path.join(__dirname, '.import-output', `_batch-${String(n).padStart(3, '0')}.payload.json`);
const p = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
process.stdout.write(p.query);
