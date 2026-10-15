import { readFileSync } from 'node:fs';
import { createApp } from '../server.js';
const path = process.argv[2];
if (!path) { console.error('Penggunaan: npm run partners:import -- /path/mitra.json'); process.exit(1); }
const rows = JSON.parse(readFileSync(path, 'utf8'));
if (!Array.isArray(rows) || !rows.length || rows.some(p => typeof p.name !== 'string' || !p.name.trim() || p.name.length > 150 || typeof p.recipient !== 'string' || !p.recipient.trim() || p.recipient.length > 150)) throw new Error('Data harus berupa array {name, recipient}, masing-masing 1–150 karakter.');
const { db } = createApp();
db.exec('BEGIN');
try {
  for (const p of rows) if (!db.prepare('SELECT id FROM partners WHERE name=?').get(p.name.trim())) db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run(p.name.trim(), p.recipient.trim());
  db.exec('COMMIT'); console.log('Impor mitra selesai. Data lama tetap dipertahankan.');
} catch (e) { db.exec('ROLLBACK'); throw e; } finally { db.close(); }
