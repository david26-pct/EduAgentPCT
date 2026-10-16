import express from 'express';
import { createMailQueue } from './mail.js';
import { initApprovals, registerAcademicRoutes, whatsappLink, audit } from './approvals.js';
import { BRANCHES, LETTERHEADS, getSignatureQR } from './public/branches.js';
import { migrateBranches, migrateCustomPartners } from './branch-migration.js';
import { registerCareerRoutes } from './career.js';
import { REQUEST_TYPES, CATEGORIES } from './public/request-options.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import PDFDocument from 'pdfkit';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export function createApp({ databasePath = process.env.DB_PATH || resolve(root, 'data/app.sqlite'), secure = process.env.NODE_ENV === 'production', careerOptions, mailOptions }  = {}) {
  mkdirSync(resolve(databasePath, '..'), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY, name TEXT NOT NULL, nis TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS partners(id INTEGER PRIMARY KEY, name TEXT NOT NULL, recipient TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS letters(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), number TEXT UNIQUE, partner_id INTEGER NOT NULL REFERENCES partners(id), start TEXT NOT NULL, end TEXT NOT NULL, issued TEXT NOT NULL, participants TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);`);
  // Additive migration: preserve existing letters; their category remains unspecified.
  db.exec('BEGIN');
  try {
    const columns = db.prepare('PRAGMA table_info(letters)').all().map(c => c.name);
    if (!columns.includes('request_type')) db.exec("ALTER TABLE letters ADD COLUMN request_type TEXT NOT NULL DEFAULT 'PKL'");
    if (!columns.includes('category')) db.exec('ALTER TABLE letters ADD COLUMN category TEXT');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  migrateBranches(db);
  migrateCustomPartners(db);
  initApprovals(db);
  const notifications = createMailQueue(db, mailOptions);
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
  const publicStudent = row => ({ id: row.id, name: row.name, nis: row.nis, branch: row.branch });
  const text = (value, max = 150) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\x00-\x1f]/.test(value);
  function session(req, res, student) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), student.id, Date.now() + 7 * 86400000);
    res.cookie('session', token, { httpOnly: true, secure, sameSite: 'strict', maxAge: 7 * 86400000, path: '/' });
    res.json(publicStudent(student));
  }
  app.post('/api/register', authLimit, (req, res) => {
    const { name, nis, password, branch } = req.body;
    if (!BRANCHES.includes(branch)) return res.status(400).json({ error: 'Pilih cabang PalComTech yang terdaftar.' });
    if (!text(name, 100) || !/^\d{3,30}$/.test(nis || '') || typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Isi nama, NIS 3–30 angka, dan password 10–128 karakter.' });
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    try {
      const result = db.prepare('INSERT INTO students(name,nis,salt,hash,branch) VALUES(?,?,?,?,?)').run(name.trim(), nis, salt, hash, branch);
      session(req, res, { id: Number(result.lastInsertRowid), name: name.trim(), nis, branch });
    } catch (error) {
      if (String(error).includes('UNIQUE')) return res.status(409).json({ error: 'NIS sudah terdaftar di cabang ini.' });
      throw error;
    }
  });
  app.post('/api/login', authLimit, (req, res) => {
    const { name, nis, password, branch } = req.body;
    if (!BRANCHES.includes(branch)) return res.status(400).json({ error: 'Pilih cabang PalComTech yang terdaftar.' });
    if (!text(name, 100) || typeof nis !== 'string' || typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Lengkapi nama, NIS, dan password.' });
    const student = db.prepare('SELECT * FROM students WHERE nis=? AND branch=?').get(nis, branch);
    const hash = scryptSync(password, student?.salt || 'dummy-salt', 64);
    if (!student || student.name.toLocaleLowerCase('id') !== name.trim().toLocaleLowerCase('id') || !timingSafeEqual(hash, Buffer.from(student.hash, 'hex'))) return res.status(401).json({ error: 'Nama, NIS, atau password tidak sesuai.' });
    session(req, res, student);
  });
  registerAcademicRoutes(app, db, secure);
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api', (req, res, next) => {
    const token = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('session='))?.slice(8);
    req.student = token && db.prepare('SELECT students.* FROM sessions JOIN students ON students.id=sessions.student_id WHERE token=? AND expires>?').get(digest(token), Date.now());
    req.sessionToken = token;
    if (!req.student) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    next();
  });
  registerCareerRoutes(app, db, careerOptions);
  app.get('/api/branch', (req, res) => res.json({ branch: req.student.branch, letterhead: LETTERHEADS[req.student.branch] || null }));
  app.get('/api/me', (req, res) => res.json(publicStudent(req.student)));
  app.post('/api/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(digest(req.sessionToken));
    res.clearCookie('session', { path: '/', secure, httpOnly: true, sameSite: 'strict' }).json({ ok: true });
  });
  app.get('/api/partners', (req, res) => res.json(db.prepare('SELECT * FROM partners WHERE branch=? ORDER BY name').all(req.student.branch)));
  app.get('/api/letters', (req, res) => res.json(db.prepare('SELECT letters.*, COALESCE(letters.custom_partner_name, partners.name) AS partner_name FROM letters LEFT JOIN partners ON partners.id=letters.partner_id WHERE student_id=? ORDER BY letters.id DESC').all(req.student.id).map(l => ({ ...l, participants: JSON.parse(l.participants), whatsapp_url: l.status === 'pending' ? whatsappLink(l) : null, email_notification: notifications.statusFor(l) }))));
  function validateLetter(req,res,next) {
    const { number, partner_id, start, end, issued, participants, request_type, category, custom_partner_name } = req.body;
    if (number) return res.status(400).json({error:'Nomor surat hanya dapat diisi oleh akademik saat menyetujui pengajuan.'});
    if (!Object.hasOwn(REQUEST_TYPES,request_type || '') || !CATEGORIES.includes(category)) return res.status(400).json({error:'Pilih jenis dan kategori yang tersedia.'});
    const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
    if (!date(start)||!date(end)||!date(issued)||start>end||!Array.isArray(participants)||!participants.length||participants.length>10||participants.some(p=>!text(p.name,100)||!text(p.program,150))) return res.status(400).json({error:'Periksa tanggal dan data peserta (maksimal 10 siswa).'});
    if (!participants.some(p=>p.name.trim().toLocaleLowerCase('id')===req.student.name.toLocaleLowerCase('id'))) return res.status(400).json({error:'Nama pemilik akun wajib tercantum dalam peserta.'});
    if (partner_id === null) {
      if (!text(custom_partner_name,150)) return res.status(400).json({error:'Isi nama instansi/perusahaan lainnya (maksimal 150 karakter).'});
    } else {
      if (!Number.isSafeInteger(partner_id) || partner_id < 1 || !db.prepare('SELECT id FROM partners WHERE id=? AND branch=?').get(partner_id,req.student.branch)) return res.status(400).json({error:'Pilih mitra resmi cabangmu atau Lainnya.'});
      if (custom_partner_name) return res.status(400).json({error:'Pilih Lainnya untuk mengisi tujuan sendiri.'});
    }
    req.letterData=[partner_id,start,end,issued,JSON.stringify(participants.map(p=>({name:p.name.trim(),program:p.program.trim()}))),request_type,category,partner_id === null ? custom_partner_name.trim() : null];next();
  }
  app.post('/api/letters',validateLetter,(req,res)=>{
    const token=randomBytes(24).toString('hex');db.exec('BEGIN IMMEDIATE');
    try {
      const result=db.prepare('INSERT INTO letters(student_id,partner_id,start,end,issued,participants,request_type,category,custom_partner_name,branch,review_token) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(req.student.id,...req.letterData,req.student.branch,token);
      const id=Number(result.lastInsertRowid);audit(db,id,req.student,'submitted');notifications.enqueue(id,1);db.exec('COMMIT');
      res.status(201).json({id,status:'pending',whatsapp_url:whatsappLink({branch:req.student.branch,review_token:token})});
    }catch(e){db.exec('ROLLBACK');throw e;}
  });
  app.put('/api/letters/:id',validateLetter,(req,res)=>{
    db.exec('BEGIN IMMEDIATE');
    try{
      const letter=db.prepare('SELECT * FROM letters WHERE id=? AND student_id=?').get(req.params.id,req.student.id);
      if(!letter){db.exec('ROLLBACK');return res.status(404).json({error:'Pengajuan tidak ditemukan.'});}
      if(letter.status!=='revision'){db.exec('ROLLBACK');return res.status(409).json({error:'Hanya pengajuan yang diminta revisi yang dapat diperbaiki.'});}
      db.prepare("UPDATE letters SET partner_id=?,start=?,end=?,issued=?,participants=?,request_type=?,category=?,custom_partner_name=?,status='pending',number=NULL,approved_by=NULL,approved_at=NULL,version=version+1 WHERE id=?").run(...req.letterData,letter.id);
      audit(db,letter.id,req.student,'resubmitted');notifications.enqueue(letter.id,letter.version+1);db.exec('COMMIT');res.json({id:letter.id,status:'pending'});
    }catch(e){db.exec('ROLLBACK');throw e;}
  });
  app.get('/api/letters/:id/pdf', (req, res) => {
    const l = db.prepare("SELECT letters.*, COALESCE(letters.custom_partner_name, partners.name) AS partner_name, COALESCE(partners.recipient,'Pimpinan') AS recipient FROM letters LEFT JOIN partners ON partners.id=letters.partner_id WHERE letters.id=? AND student_id=?").get(req.params.id, req.student.id);
    if (!l) return res.status(404).json({ error: 'Surat tidak ditemukan.' });
    if (l.status !== 'approved' || !l.number) return res.status(403).json({ error: 'PDF hanya tersedia setelah akademik menyetujui dan mengisi nomor surat.' });
    const head = LETTERHEADS[req.student.branch];
    if (!head) return res.status(409).json({ error: 'Identitas kop dan pimpinan cabang ini belum dikonfigurasi. Hubungi akademik.' });
    const requestName = REQUEST_TYPES[l.request_type];
    const date = value => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
    res.type('pdf').attachment(`Surat-${l.request_type}-${l.id}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 52, bufferPages: true });
    doc.pipe(res);
    // Lay out the original embedded Word image, clipping to its logo region.
    // The source asset is preserved without repainting or changing the logo.
    const logoScale = 52 / 127;
    doc.save().rect(52, 52, 52, 55).clip();
    doc.image(resolve(root, 'public/assets/palcomtech-letterhead.jpg'), 52 - 115 * logoScale, 52 - 34 * logoScale, { width: 1239 * logoScale });
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0d4265').text(`PalComTech ${req.student.branch}`, 116, 52);
    doc.font('Helvetica').fontSize(9).fillColor('#222').text(head.address).text(`Telp. ${head.phone}`).text(`${head.website} | ${head.email}`);
    doc.x = 52; doc.y = 115;
    doc.moveDown(.7).moveTo(52, doc.y).lineTo(543, doc.y).strokeColor('#0d4265').lineWidth(2).stroke();
    doc.moveDown(1).fontSize(11).text(`Nomor: ${l.number}`).text(`Perihal: Permohonan ${requestName}`).moveDown();
    doc.text('Kepada Yth,').text(l.recipient).text(l.partner_name).text('Di Tempat').moveDown();
    doc.text('Dengan hormat,').moveDown(.5);
    doc.text(`Kami mengharapkan kesediaan Bapak/Ibu untuk memberikan izin kepada siswa Lembaga Pendidikan Komputer dan Internet PalComTech ${req.student.branch} untuk dapat menjalankan ${requestName} (${l.request_type}) dalam lingkungan Kantor/Perusahaan yang Bapak/Ibu pimpin, guna mengaplikasikan ilmu pengetahuan dan keterampilan yang dimiliki oleh siswa tersebut.`, { align: 'justify', lineGap: 3 });
    doc.moveDown(.7).text(`Adapun nama siswa yang akan melaksanakan ${requestName} pada ${date(l.start)} s.d. ${date(l.end)}, sebagai berikut:`, { lineGap: 3 }).moveDown(.7);
    function row(cells, bold = false) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      const widths = [30, 220, 241];
      const h = Math.max(...cells.map((t, i) => doc.heightOfString(t, { width: widths[i] - 12 }))) + 14;
      if (doc.y + h > 770) doc.addPage();
      const y = doc.y; let x = 52;
      cells.forEach((t, i) => { doc.lineWidth(.5).strokeColor('#777').rect(x, y, widths[i], h).stroke(); doc.text(t, x + 6, y + 7, { width: widths[i] - 12 }); x += widths[i]; });
      doc.x = 52; doc.y = y + h;
    }
    if (l.category) doc.font('Helvetica').fontSize(11).text(`Kategori: ${l.category}`).moveDown(.5);
    row(['No.', 'Nama', 'Program Studi'], true);
    JSON.parse(l.participants).forEach((p, i) => row([String(i + 1), p.name, p.program]));
    doc.moveDown().font('Helvetica').fontSize(11).text('Demikian surat ini kami sampaikan, atas perhatian dan kerjasamanya diucapkan terima kasih.', 52, doc.y, { width: 491, lineGap: 3 });
    const signatureQR = getSignatureQR(req.student.branch, l.request_type);
    if (doc.y + (signatureQR ? 210 : 175) > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.moveDown().text(`${head.city}, ${date(l.issued)}`, { align: 'right' }).text('Pimpinan', { align: 'right' });
    if (signatureQR) {
      const qrSize = 100;
      const qrY = doc.y + 6;
      doc.image(resolve(root, 'public', signatureQR.slice(1)), doc.page.width - doc.page.margins.right - qrSize, qrY, { width: qrSize, height: qrSize });
      doc.x = 52; doc.y = qrY + qrSize + 6;
    } else doc.moveDown(4);
    doc.font('Helvetica-Bold').text(head.leader, { align: 'right' }).font('Helvetica').text(head.leader_id, { align: 'right' });
    doc.moveDown().fontSize(9).text('Tembusan Yth. Arsip').text(`Contact Person: ${head.contact}`).text(head.contact_phone);
    doc.end();
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
  app.use(express.static(resolve(root, 'public')));
  app.use((err, req, res, next) => { console.error(err.message); if (!res.headersSent) res.status(err.status === 400 ? 400 : 500).json({ error: 'Permintaan tidak dapat diproses.' }); });
  return { app, db, notifications };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app, notifications } = createApp();
  notifications.start();
  app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('EduAgentPCT berjalan di port ' + (process.env.PORT || 3000)));
}
