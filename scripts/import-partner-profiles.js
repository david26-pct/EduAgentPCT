import { BRANCHES } from '../public/branches.js';
import { readFileSync } from 'node:fs';
import { createApp } from '../server.js';
import { CATEGORIES, REQUEST_TYPES } from '../public/request-options.js';
const path = process.argv[2];
if (!path) throw Error('Penggunaan: node scripts/import-partner-profiles.js /path/profil-mitra-terverifikasi.json');
const rows = JSON.parse(readFileSync(path, 'utf8'));
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
if (!Array.isArray(rows) || !rows.length || rows.some(p => (p.branch !== undefined && !BRANCHES.includes(p.branch)) || !text(p.name,150) || !Array.isArray(p.categories) || !p.categories.length || p.categories.some(c => !CATEGORIES.includes(c)) || !Array.isArray(p.request_types) || !p.request_types.length || p.request_types.some(t => !Object.hasOwn(REQUEST_TYPES,t)) || !Array.isArray(p.skills) || p.skills.length > 20 || p.skills.some(s => !text(s,60)) || !text(p.location,100) || !text(p.description,1000) || !['open','unknown','closed'].includes(p.acceptance) || typeof p.verified !== 'boolean')) throw Error('Profil mitra tidak valid. Lihat format di README.');
const { db } = createApp();
db.exec('BEGIN');
try {
  for (const { name, branch = 'Lahat', ...profile } of rows) {
    const partner = db.prepare('SELECT id FROM partners WHERE name=? AND branch=?').get(name.trim(), branch);
    if (!partner) throw Error(`Nama mitra belum terdaftar: ${name}`);
    db.prepare('INSERT INTO partner_profiles VALUES(?,?) ON CONFLICT(partner_id) DO UPDATE SET data=excluded.data').run(partner.id, JSON.stringify({ ...profile, skills: [...new Set(profile.skills.map(s => s.trim().toLocaleLowerCase('id')))] }));
  }
  db.exec('COMMIT'); console.log('Profil mitra diperbarui. Hanya profil terverifikasi dipakai untuk pencocokan.');
} catch (e) { db.exec('ROLLBACK'); throw e; } finally { db.close(); }
