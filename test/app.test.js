import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CATEGORIES } from '../public/request-options.js';
import { createApp } from '../server.js';

test('Alur siswa, draf, PDF, isolasi akun, dan validasi keamanan', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eduagent-test-'));
  const { app, db } = createApp({ databasePath: join(dir, 'test.sqlite') });
  db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run('Instansi Uji', 'Pimpinan');
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function request(path, body, cookie) {
    return fetch(url + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  try {
    assert.equal((await request('/letters')).status, 401);
    const account = { branch: 'Lahat', name: 'Siswa Uji', nis: '123456', password: 'password-kuat-2026' };
    assert.equal((await request('/register', { ...account, password: '123' })).status, 400);
    const registration = await request('/register', account); assert.equal(registration.status, 200);
    const cookie = registration.headers.get('set-cookie').split(';')[0];
    assert.match(registration.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await request('/register', account)).status, 409);
    assert.equal((await request('/login', { ...account, password: 'salah' })).status, 401);
    assert.equal((await request('/login', account)).status, 200);
    const raw = db.prepare('SELECT * FROM students WHERE nis=?').get(account.nis);
    assert.notEqual(raw.hash, account.password); assert.equal(raw.hash.length, 128);
    const letter = { request_type: 'PKL', category: 'Internet of Things', partner_id: 1, start: '2026-10-05', end: '2026-11-06', issued: '2026-09-17', participants: [{ name: account.name, program: 'Komputer Internet dan Bisnis Digital' }] };
    assert.equal((await request('/letters', { ...letter, end: '2026-01-01' }, cookie)).status, 400);
    assert.equal((await request('/letters', { ...letter, start: '2026-02-30' }, cookie)).status, 400);
    assert.equal((await request('/letters', { ...letter, partner_id: 999 }, cookie)).status, 400);
    assert.equal((await request('/letters', { ...letter, participants: [{ name: 'Orang lain', program: 'Komputer' }] }, cookie)).status, 400);
    assert.equal((await request('/letters', { ...letter, request_type: 'OTHER' }, cookie)).status, 400);
    assert.equal((await request('/letters', { ...letter, category: 'Kategori palsu' }, cookie)).status, 400);
    for (const request_type of ['PKL', 'TCS']) {
      for (const category of CATEGORIES) {
        const response = await request('/letters', { ...letter, request_type, category }, cookie);
        assert.equal(response.status, 201);
      }
    }
    const saved = await (await request('/letters', undefined, cookie)).json();
    assert.equal(saved.length, CATEGORIES.length * 2);
    assert.ok(saved.some(l => l.request_type === 'TCS' && l.category === 'Content Creator'));
    const draft = await (await request('/letters', letter, cookie)).json();
    assert.equal((await request(`/letters/${draft.id}/pdf`, undefined, cookie)).status, 400);
    const created = await request('/letters', { ...letter, number: '0294/PCT3/P/2026' }, cookie); assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.equal((await request('/letters', { ...letter, number: '0294/PCT3/P/2026' }, cookie)).status, 409);
    const pdf = await request(`/letters/${id}/pdf`, undefined, cookie);
    assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /application\/pdf/);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
    const second = await request('/register', { branch: 'Lahat', name: 'Siswa Kedua', nis: '654321', password: 'password-kuat-lain' });
    const otherCookie = second.headers.get('set-cookie').split(';')[0];
    assert.equal((await request(`/letters/${id}/pdf`, undefined, otherCookie)).status, 404);
    assert.deepEqual(await (await request('/letters', undefined, otherCookie)).json(), []);
    const forged = await fetch(url + '/api/letters', { method: 'POST', headers: { Origin: 'https://evil.example', Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(letter) });
    assert.equal(forged.status, 403);
    assert.equal((await request('/logout', {}, cookie)).status, 200);
    assert.equal((await request('/me', undefined, cookie)).status, 401);
  } finally { await new Promise(r => server.close(r)); db.close(); rmSync(dir, { recursive: true, force: true }); }
});


test('Migrasi surat lama mempertahankan data dan aman dijalankan ulang', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eduagent-migration-'));
  const databasePath = join(dir, 'legacy.sqlite');
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`CREATE TABLE students(id INTEGER PRIMARY KEY,name TEXT NOT NULL,nis TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL);
    INSERT INTO students VALUES(1,'Siswa Lama','101','salt','hash');
    CREATE TABLE partners(id INTEGER PRIMARY KEY,name TEXT NOT NULL,recipient TEXT NOT NULL);
    INSERT INTO partners VALUES(1,'Mitra Lama','Pimpinan');
    CREATE TABLE letters(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, number TEXT UNIQUE, partner_id INTEGER NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, issued TEXT NOT NULL, participants TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO letters(student_id,number,partner_id,start,end,issued,participants) VALUES(1,'LAMA/001',1,'2026-10-01','2026-11-01','2026-09-01','[]');`);
  legacy.close();
  try {
    for (let run = 0; run < 2; run++) {
      const { db } = createApp({ databasePath });
      try {
        const letter = db.prepare('SELECT * FROM letters').get();
        assert.equal(letter.number, 'LAMA/001');
        assert.equal(letter.request_type, 'PKL');
        assert.equal(letter.category, null);
        assert.equal(db.prepare('SELECT count(*) AS count FROM letters').get().count, 1);
      } finally { db.close(); }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
