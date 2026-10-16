import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';

const root = fileURLToPath(new URL('../', import.meta.url));
test('Daftar 61 mitra diimpor utuh, tersedia lewat API, dan aman diimpor ulang', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eduagent-partners-'));
  const path = join(dir, 'app.sqlite');
  const rows = JSON.parse(readFileSync(join(root, 'scripts/partners-palcomtech.json')));
  assert.equal(rows.length, 61);
  assert.equal(new Set(rows.map(p => p.name)).size, 61);
  const { app, db } = createApp({ databasePath: path });
  db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run('Astra Motor', 'Manager');
  db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run('Mitra Lama', 'Direktur');
  const oldId = db.prepare('SELECT id FROM partners WHERE name=?').get('Astra Motor').id;
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  try {
    for (let run = 0; run < 2; run++) execFileSync(process.execPath, ['scripts/import-partners.js', 'scripts/partners-palcomtech.json'], { cwd: root, env: { ...process.env, DB_PATH: path } });
    assert.equal(db.prepare('SELECT count(*) AS n FROM partners').get().n, 62);
    const existing = db.prepare('SELECT * FROM partners WHERE name=?').get('Astra Motor');
    assert.equal(existing.id, oldId); assert.equal(existing.recipient, 'Manager');
    const url = `http://127.0.0.1:${server.address().port}/api`;
    const registration = await fetch(url + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch: 'Lahat', name: 'Siswa Mitra', nis: '777777', password: 'password-mitra-aman' }) });
    assert.equal(registration.status, 200);
    const response = await fetch(url + '/partners', { headers: { Cookie: registration.headers.get('set-cookie').split(';')[0] } });
    assert.equal(response.status, 200);
    const partners = await response.json();
    for (const row of rows) assert.ok(partners.some(p => p.name === row.name), row.name);
    assert.equal(partners.find(p => p.name === 'Kantor Lurah Bandar Jaya').recipient, 'Pimpinan');
    assert.ok(partners.some(p => p.name === 'Pengadilan Agama'));
    assert.ok(partners.some(p => p.name === 'Pengadilan Agama Lahat'));
  } finally { await new Promise(r => server.close(r)); db.close(); rmSync(dir, { recursive: true, force: true }); }
});
