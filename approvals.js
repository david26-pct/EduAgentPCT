import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { BRANCHES, LETTERHEADS } from './public/branches.js';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function initApprovals(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const cols = db.prepare('PRAGMA table_info(letters)').all().map(c => c.name);
    const additions = { class_name: "TEXT NOT NULL DEFAULT ''", status: "TEXT NOT NULL DEFAULT 'pending'", review_token: 'TEXT', review_note: "TEXT NOT NULL DEFAULT ''", version: 'INTEGER NOT NULL DEFAULT 1', approved_by: 'INTEGER', approved_at: 'TEXT' };
    for (const [name, type] of Object.entries(additions)) if (!cols.includes(name)) db.exec(`ALTER TABLE letters ADD COLUMN ${name} ${type}`);
    for (const row of db.prepare('SELECT id FROM letters WHERE review_token IS NULL').all()) db.prepare('UPDATE letters SET review_token=? WHERE id=?').run(randomBytes(24).toString('hex'), row.id);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS letters_review_token ON letters(review_token);
      CREATE TABLE IF NOT EXISTS academic_accounts(id INTEGER PRIMARY KEY, branch TEXT NOT NULL, username TEXT NOT NULL, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(branch,username));
      CREATE TABLE IF NOT EXISTS academic_sessions(token TEXT PRIMARY KEY, academic_id INTEGER NOT NULL REFERENCES academic_accounts(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS letter_events(id INTEGER PRIMARY KEY, letter_id INTEGER NOT NULL REFERENCES letters(id), actor_type TEXT NOT NULL, actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, number TEXT, note TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
export function publicReviewLink(token) {
  const base = new URL(process.env.PUBLIC_APP_URL || 'https://eduagentpct.my.id');
  if (base.protocol !== 'https:' || base.username || base.password) throw Error('PUBLIC_APP_URL must be an HTTPS application origin');
  return new URL(`/academic.html?request=${encodeURIComponent(token)}`, base.origin).toString();
}
export function whatsappLink(letter) {
  const phone = LETTERHEADS[letter.branch]?.academic_whatsapp;
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(publicReviewLink(letter.review_token))}` : null;
}
export function audit(db, letterId, actor, action, number = null, note = '') {
  db.prepare('INSERT INTO letter_events(letter_id,actor_type,actor_id,actor_name,action,number,note) VALUES(?,?,?,?,?,?,?)').run(letterId, actor.role || 'student', actor.id, actor.name, action, number, note);
}
export function registerAcademicRoutes(app, db, secure) {
  const router = express.Router();
  router.use((req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  router.post('/login', rateLimit({ windowMs:15*60000, limit:15, message:{error:'Terlalu banyak percobaan login akademik. Coba lagi nanti.'} }), (req,res) => {
    const { branch, username, password } = req.body;
    if (!BRANCHES.includes(branch) || typeof username !== 'string' || username.length>100 || typeof password !== 'string' || password.length>128) return res.status(400).json({error:'Lengkapi cabang, username, dan password akademik.'});
    const account = db.prepare('SELECT * FROM academic_accounts WHERE branch=? AND username=? AND active=1').get(branch,username.trim());
    const hash = scryptSync(password,account?.salt || 'academic-dummy-salt',64);
    if (!account || !timingSafeEqual(hash,Buffer.from(account.hash,'hex'))) return res.status(401).json({error:'Akun akademik atau password tidak sesuai.'});
    const token=randomBytes(32).toString('hex');
    db.prepare('DELETE FROM academic_sessions WHERE expires<?').run(Date.now());
    db.prepare('INSERT INTO academic_sessions VALUES(?,?,?)').run(digest(token),account.id,Date.now()+8*3600000);
    res.cookie('academic_session',token,{httpOnly:true,secure,sameSite:'strict',maxAge:8*3600000,path:'/'});
    res.json({name:account.name,branch:account.branch});
  });
  router.use((req,res,next) => {
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('academic_session='))?.slice(17);
    req.academicToken=token;
    req.academic=token && db.prepare('SELECT academic_accounts.* FROM academic_sessions JOIN academic_accounts ON academic_accounts.id=academic_sessions.academic_id WHERE token=? AND expires>? AND active=1').get(digest(token),Date.now());
    if (!req.academic) return res.status(401).json({error:'Silakan masuk sebagai akademik cabang terkait.'});
    next();
  });
  router.get('/me',(req,res)=>res.json({name:req.academic.name,branch:req.academic.branch}));
  router.post('/logout',(req,res)=>{db.prepare('DELETE FROM academic_sessions WHERE token=?').run(digest(req.academicToken));res.clearCookie('academic_session',{path:'/',httpOnly:true,secure,sameSite:'strict'}).json({ok:true});});
  const find=(token,branch)=>db.prepare('SELECT letters.*, students.name AS student_name, students.nis, COALESCE(letters.custom_partner_name,partners.name) AS partner_name FROM letters JOIN students ON students.id=letters.student_id LEFT JOIN partners ON partners.id=letters.partner_id WHERE review_token=? AND letters.branch=?').get(token,branch);
  const present=row=>({...row,participants:JSON.parse(row.participants),events:db.prepare('SELECT actor_name,action,number,note,created FROM letter_events WHERE letter_id=? ORDER BY id').all(row.id)});
  router.get('/requests',(req,res)=>res.json(db.prepare('SELECT letters.*,students.name AS student_name,COALESCE(letters.custom_partner_name,partners.name) AS partner_name FROM letters JOIN students ON students.id=letters.student_id LEFT JOIN partners ON partners.id=letters.partner_id WHERE letters.branch=? ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END,letters.id DESC').all(req.academic.branch).map(row=>({...row,participants:JSON.parse(row.participants)}))));
  router.get('/requests/:token',(req,res)=>{const row=find(req.params.token,req.academic.branch);if(!row)return res.status(404).json({error:'Pengajuan tidak ditemukan di cabang akun ini.'});res.json(present(row));});
  router.post('/requests/:token/decision',(req,res)=>{
    const {action,number,note='',version,start,end}=req.body;
    const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
    if (action==='approve' && (!validDate(start)||!validDate(end)||start>end)) return res.status(400).json({error:'Isi tanggal mulai dan selesai kegiatan yang valid; tanggal selesai tidak boleh sebelum tanggal mulai.'});
    if (!['approve','revision'].includes(action) || !Number.isSafeInteger(version) || typeof note!=='string' || note.length>1000 || (action==='revision'&&!note.trim()) || (action==='approve'&&(typeof number!=='string'||!number.trim()||number.length>80||/[\x00-\x1f]/.test(number)))) return res.status(400).json({error:'Isi nomor surat untuk persetujuan atau catatan untuk revisi.'});
    db.exec('BEGIN IMMEDIATE');
    try {
      const letter=find(req.params.token,req.academic.branch);
      if (!letter) {db.exec('ROLLBACK');return res.status(404).json({error:'Pengajuan tidak ditemukan.'});}
      if (letter.status!=='pending'||letter.version!==version) {db.exec('ROLLBACK');return res.status(409).json({error:'Pengajuan telah berubah atau sudah diperiksa. Muat ulang sebelum melanjutkan.'});}
      const status=action==='approve'?'approved':'revision';
      db.prepare('UPDATE letters SET start=?,end=?,status=?,number=?,review_note=?,approved_by=?,approved_at=?,version=version+1 WHERE id=?').run(action==='approve'?start:letter.start,action==='approve'?end:letter.end,status,action==='approve'?number.trim():null,note.trim(),action==='approve'?req.academic.id:null,action==='approve'?new Date().toISOString():null,letter.id);
      audit(db,letter.id,{...req.academic,role:'academic'},status,action==='approve'?number.trim():null,note.trim());
      db.exec('COMMIT');res.json(present(find(req.params.token,req.academic.branch)));
    } catch(e) {db.exec('ROLLBACK');if(String(e).includes('UNIQUE'))return res.status(409).json({error:'Nomor surat sudah digunakan di cabang ini.'});throw e;}
  });
  router.use((req,res)=>res.status(404).json({error:'Endpoint akademik tidak ditemukan.'}));
  app.use('/api/academic',router);
}
