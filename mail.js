import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import { LETTERHEADS } from './public/branches.js';
import { publicReviewLink } from './approvals.js';

const address = value => typeof value === 'string' && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value);
export function createMailQueue(db, { env = process.env, transport: providedTransport } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS academic_email_jobs(id INTEGER PRIMARY KEY, letter_id INTEGER NOT NULL REFERENCES letters(id), letter_version INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, lease_token TEXT, last_code TEXT, submitted_at TEXT, UNIQUE(letter_id,letter_version));`);
  let timer, busy=false, transport=providedTransport;
  function config(branch) {
    let recipients={};
    try { recipients=JSON.parse(env.ACADEMIC_EMAILS_JSON || '{}'); } catch { return {code:'configuration_missing'}; }
    if(!recipients || typeof recipients !== 'object' || Array.isArray(recipients))return {code:'configuration_missing'};
    const to=recipients[branch] || (branch==='Lahat' ? env.ACADEMIC_EMAIL_LAHAT : '') || LETTERHEADS[branch]?.academic_email;
    if (!address(to)) return {code:'recipient_missing'};
    const port=Number(env.SMTP_PORT || 587);
    if (!address(env.MAIL_FROM) || !env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || ![465,587].includes(port)) return {code:'configuration_missing'};
    return {to,from:env.MAIL_FROM,port};
  }
  function enqueue(letterId,version) {
    db.prepare('INSERT INTO academic_email_jobs(letter_id,letter_version) VALUES(?,?) ON CONFLICT(letter_id,letter_version) DO NOTHING').run(letterId,version);
  }
  function statusFor(letter) {
    if(letter.status!=='pending')return null;
    const job=db.prepare('SELECT state,last_code,submitted_at FROM academic_email_jobs WHERE letter_id=? AND letter_version=?').get(letter.id,letter.version);
    if(!job)return {state:'not_queued',message:'Pengajuan lama belum memiliki notifikasi email otomatis. Tetap tersedia di antrean akademik dan dapat dikirim melalui WhatsApp.'};
    const setup=config(letter.branch);
    if(setup.code && ['queued','blocked'].includes(job.state))return {state:'blocked',message:'Email akademik belum aktif: alamat penerima atau konfigurasi pengiriman perlu dilengkapi pengelola.'};
    const messages={queued:'Email menunggu pengiriman otomatis.',blocked:'Konfigurasi email belum lengkap. Hubungi pengelola.',sending:'Email sedang diproses.',submitted:'Notifikasi diterima server email. Periksa inbox atau spam akademik.',retry:'Pengiriman email belum berhasil dan akan dicoba ulang otomatis.',failed:'Email gagal setelah beberapa percobaan. Hubungi pengelola; tombol WhatsApp tetap dapat digunakan.',cancelled:'Notifikasi tidak dikirim karena pengajuan sudah berubah.'};
    return {state:job.state,message:messages[job.state]||'Status email belum tersedia.',submitted_at:job.submitted_at};
  }
  async function processPending() {
    if(busy)return;busy=true;
    try{
      const now=Date.now();
      const jobs=db.prepare("SELECT academic_email_jobs.*, letters.branch,letters.review_token,letters.status,letters.version,letters.request_type FROM academic_email_jobs JOIN letters ON letters.id=academic_email_jobs.letter_id WHERE (state IN ('queued','blocked','retry') AND next_at<=?) OR (state='sending' AND lease_until<?) ORDER BY academic_email_jobs.id LIMIT 10").all(now,now);
      for(const job of jobs){
        if(job.status!=='pending'||job.letter_version!==job.version){db.prepare("UPDATE academic_email_jobs SET state='cancelled' WHERE id=? AND state!='submitted'").run(job.id);continue;}
        const setup=config(job.branch);
        if(setup.code){db.prepare("UPDATE academic_email_jobs SET state='blocked',last_code=?,next_at=?,lease_until=0 WHERE id=?").run(setup.code,now+30000,job.id);continue;}
        if(job.attempts>=3){db.prepare("UPDATE academic_email_jobs SET state='failed',last_code='attempts_exhausted' WHERE id=?").run(job.id);continue;}
        const lease=randomBytes(16).toString('hex');
        const claimed=db.prepare("UPDATE academic_email_jobs SET state='sending',lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=? AND ((state IN ('queued','blocked','retry') AND next_at<=?) OR (state='sending' AND lease_until<?))").run(lease,Date.now()+120000,job.id,Date.now(),Date.now());
        if(!claimed.changes)continue;
        try{
          if(!transport)transport=nodemailer.createTransport({host:env.SMTP_HOST,port:setup.port,secure:setup.port===465,requireTLS:setup.port===587,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,logger:false,debug:false});
          const link=publicReviewLink(job.review_token);
          const result=await transport.sendMail({from:setup.from,to:setup.to,subject:`Pengajuan ${job.request_type} — PalComTech ${job.branch}`,text:`Ada pengajuan surat yang menunggu pemeriksaan akademik.\n\n${link}\n\nMasuk dengan akun akademik cabang ${job.branch} untuk memeriksa, menyetujui, dan mengisi nomor surat, atau meminta revisi. Membuka tautan tidak langsung menyetujui pengajuan.`,messageId:`<eduagent-${job.letter_id}-${job.letter_version}@${new URL(link).hostname}>`,disableFileAccess:true,disableUrlAccess:true});
          if(!result.accepted?.some(v=>String(v).toLowerCase()===setup.to.toLowerCase()))throw Error('recipient_not_accepted');
          db.prepare("UPDATE academic_email_jobs SET state='submitted',submitted_at=?,last_code=NULL,lease_until=0 WHERE id=? AND lease_token=?").run(new Date().toISOString(),job.id,lease);
        }catch{
          const attempts=job.attempts+1;
          db.prepare('UPDATE academic_email_jobs SET state=?,last_code=?,next_at=?,lease_until=0 WHERE id=? AND lease_token=?').run(attempts>=3?'failed':'retry','delivery_failed',Date.now()+60000*2**(attempts-1),job.id,lease);
        }
      }
    }finally{busy=false;}
  }
  function start(){if(timer)return;timer=setInterval(()=>processPending().catch(()=>console.error('Email queue processing failed.')),30000);timer.unref();processPending().catch(()=>console.error('Email queue processing failed.'));}
  function stop(){clearInterval(timer);timer=null;transport?.close?.();}
  return {enqueue,statusFor,processPending,start,stop};
}
