import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import PDFDocument from 'pdfkit';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export function createApp({ databasePath = process.env.DB_PATH || resolve(root, 'data/app.sqlite'), secure = process.env.NODE_ENV === 'production' } = {}) {
  mkdirSync(resolve(databasePath, '..'), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY, name TEXT NOT NULL, nis TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS partners(id INTEGER PRIMARY KEY, name TEXT NOT NULL, recipient TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS letters(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), number TEXT UNIQUE, partner_id INTEGER NOT NULL REFERENCES partners(id), start TEXT NOT NULL, end TEXT NOT NULL, issued TEXT NOT NULL, participants TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);`);
  const app = express();
  app.disable('x-powered-by');
  // The deployment proxy overwrites forwarded headers and connects over loopback.
  if (process.env.TRUST_LOCAL_PROXY === '1') app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 150 }));
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Asal permintaan tidak diizinkan.' });
    next();
  });
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 20 });
  const digest = value => createHash('sha256').update(value).digest('hex');
  const publicStudent = row => ({ id: row.id, name: row.name, nis: row.nis });
  const text = (value, max = 150) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\x00-\x1f]/.test(value);
  function session(req, res, student) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), student.id, Date.now() + 7 * 86400000);
    res.cookie('session', token, { httpOnly: true, secure, sameSite: 'strict', maxAge: 7 * 86400000, path: '/' });
    res.json(publicStudent(student));
  }
  app.post('/api/register', authLimit, (req, res) => {
    const { name, nis, password } = req.body;
    if (!text(name, 100) || !/^\d{3,30}$/.test(nis || '') || typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Isi nama, NIS 3–30 angka, dan password 10–128 karakter.' });
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    try {
      const result = db.prepare('INSERT INTO students(name,nis,salt,hash) VALUES(?,?,?,?)').run(name.trim(), nis, salt, hash);
      session(req, res, { id: Number(result.lastInsertRowid), name: name.trim(), nis });
    } catch (error) {
      if (String(error).includes('UNIQUE')) return res.status(409).json({ error: 'NIS sudah terdaftar.' });
      throw error;
    }
  });
  app.post('/api/login', authLimit, (req, res) => {
    const { name, nis, password } = req.body;
    if (!text(name, 100) || typeof nis !== 'string' || typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Lengkapi nama, NIS, dan password.' });
    const student = db.prepare('SELECT * FROM students WHERE nis=?').get(nis);
    const hash = scryptSync(password, student?.salt || 'dummy-salt', 64);
    if (!student || student.name.toLocaleLowerCase('id') !== name.trim().toLocaleLowerCase('id') || !timingSafeEqual(hash, Buffer.from(student.hash, 'hex'))) return res.status(401).json({ error: 'Nama, NIS, atau password tidak sesuai.' });
    session(req, res, student);
  });
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api', (req, res, next) => {
    const token = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('session='))?.slice(8);
    req.student = token && db.prepare('SELECT students.* FROM sessions JOIN students ON students.id=sessions.student_id WHERE token=? AND expires>?').get(digest(token), Date.now());
    req.sessionToken = token;
    if (!req.student) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    next();
  });
  app.get('/api/me', (req, res) => res.json(publicStudent(req.student)));
  app.post('/api/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(digest(req.sessionToken));
    res.clearCookie('session', { path: '/', secure, httpOnly: true, sameSite: 'strict' }).json({ ok: true });
  });
  app.get('/api/partners', (req, res) => res.json(db.prepare('SELECT * FROM partners ORDER BY name').all()));
  app.get('/api/letters', (req, res) => res.json(db.prepare('SELECT letters.*, partners.name AS partner_name FROM letters JOIN partners ON partners.id=letters.partner_id WHERE student_id=? ORDER BY letters.id DESC').all(req.student.id).map(l => ({ ...l, participants: JSON.parse(l.participants) }))));
  app.post('/api/letters', (req, res) => {
    const { number, partner_id, start, end, issued, participants } = req.body;
    const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
    if ((number && !text(number, 80)) || !date(start) || !date(end) || !date(issued) || start > end || !Array.isArray(participants) || participants.length < 1 || participants.length > 10 || participants.some(p => !text(p.name, 100) || !text(p.program, 150))) return res.status(400).json({ error: 'Periksa nomor surat, tanggal, dan data peserta (maksimal 10 siswa).' });
    if (!participants.some(p => p.name.trim().toLocaleLowerCase('id') === req.student.name.toLocaleLowerCase('id'))) return res.status(400).json({ error: 'Nama pemilik akun wajib tercantum dalam peserta.' });
    if (!db.prepare('SELECT id FROM partners WHERE id=?').get(partner_id)) return res.status(400).json({ error: 'Pilih mitra resmi dari daftar.' });
    try {
      const result = db.prepare('INSERT INTO letters(student_id,number,partner_id,start,end,issued,participants) VALUES(?,?,?,?,?,?,?)').run(req.student.id, number?.trim() || null, partner_id, start, end, issued, JSON.stringify(participants.map(p => ({ name: p.name.trim(), program: p.program.trim() }))));
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (error) {
      if (String(error).includes('UNIQUE')) return res.status(409).json({ error: 'Nomor surat sudah digunakan. Konfirmasikan kepada akademik.' });
      throw error;
    }
  });
  app.get('/api/letters/:id/pdf', (req, res) => {
    const l = db.prepare('SELECT letters.*, partners.name AS partner_name, partners.recipient FROM letters JOIN partners ON partners.id=letters.partner_id WHERE letters.id=? AND student_id=?').get(req.params.id, req.student.id);
    if (!l) return res.status(404).json({ error: 'Surat tidak ditemukan.' });
    if (!l.number) return res.status(400).json({ error: 'Draf belum memiliki nomor dari akademik. Buat surat lengkap setelah nomor diperoleh.' });
    const date = value => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
    res.type('pdf').attachment(`Surat-PKL-${l.id}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 52, bufferPages: true });
    doc.pipe(res);
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0d4265').text('PalComTech Lahat');
    doc.font('Helvetica').fontSize(9).fillColor('#222').text('Jl. Kolonel M. Nuh No.02 – Kota Lahat').text('Telp. (0731) 3200778').text('www.palcomtech.ac.id | palcomtech.lahat@palcomtech.ac.id');
    doc.moveDown(.7).moveTo(52, doc.y).lineTo(543, doc.y).strokeColor('#0d4265').lineWidth(2).stroke();
    doc.moveDown(1).fontSize(11).text(`Nomor: ${l.number}`).text('Perihal: Permohonan Praktek Kerja Lapangan').moveDown();
    doc.text('Kepada Yth,').text(l.recipient).text(l.partner_name).text('Di Tempat').moveDown();
    doc.text('Dengan hormat,').moveDown(.5);
    doc.text('Kami mengharapkan kesediaan Bapak/Ibu untuk memberikan izin kepada siswa Lembaga Pendidikan Komputer dan Internet PalComTech Lahat untuk dapat menjalankan Praktek Kerja Lapangan (PKL) dalam lingkungan Kantor/Perusahaan yang Bapak/Ibu pimpin, guna mengaplikasikan ilmu pengetahuan dan keterampilan yang dimiliki oleh siswa tersebut.', { align: 'justify', lineGap: 3 });
    doc.moveDown(.7).text(`Adapun nama siswa yang akan melaksanakan Praktek Kerja Lapangan pada ${date(l.start)} s.d. ${date(l.end)}, sebagai berikut:`, { lineGap: 3 }).moveDown(.7);
    function row(cells, bold = false) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      const widths = [30, 220, 241];
      const h = Math.max(...cells.map((t, i) => doc.heightOfString(t, { width: widths[i] - 12 }))) + 14;
      if (doc.y + h > 770) doc.addPage();
      const y = doc.y; let x = 52;
      cells.forEach((t, i) => { doc.lineWidth(.5).strokeColor('#777').rect(x, y, widths[i], h).stroke(); doc.text(t, x + 6, y + 7, { width: widths[i] - 12 }); x += widths[i]; });
      doc.x = 52; doc.y = y + h;
    }
    row(['No.', 'Nama', 'Program Studi'], true);
    JSON.parse(l.participants).forEach((p, i) => row([String(i + 1), p.name, p.program]));
    doc.moveDown().font('Helvetica').fontSize(11).text('Demikian surat ini kami sampaikan, atas perhatian dan kerjasamanya diucapkan terima kasih.', 52, doc.y, { width: 491, lineGap: 3 });
    if (doc.y > 560) doc.addPage();
    doc.moveDown().text(`Lahat, ${date(l.issued)}`, { align: 'right' }).text('Pimpinan', { align: 'right' }).moveDown(4).font('Helvetica-Bold').text('Abdul Rajab, S.E.', { align: 'right' }).font('Helvetica').text('01.PCT.16.LHT', { align: 'right' });
    doc.moveDown().fontSize(9).text('Tembusan Yth. Arsip').text('Contact Person: Akhmad Wan Mukhlas (Koordinator Akademik)').text('0823-73725066');
    doc.end();
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
  app.use(express.static(resolve(root, 'public')));
  app.use((err, req, res, next) => { console.error(err.message); if (!res.headersSent) res.status(err.status === 400 ? 400 : 500).json({ error: 'Permintaan tidak dapat diproses.' }); });
  return { app, db };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app } = createApp();
  app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('EduAgentPCT berjalan di port ' + (process.env.PORT || 3000)));
}
