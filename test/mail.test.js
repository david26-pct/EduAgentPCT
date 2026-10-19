import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.js';

const config=()=>({SMTP_HOST:'smtp.example.test',SMTP_PORT:'587',SMTP_USER:'test@example.test',SMTP_PASS:'test-only-placeholder',MAIL_FROM:'test@example.test',ACADEMIC_EMAILS_JSON:JSON.stringify({Lahat:'academic.lahat@example.test','Palembang OPI':'academic.opi@example.test'})});
test('Email otomatis: antrean tahan restart, per cabang, revisi, tanpa PII, tanpa duplikasi normal',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-mail-')),databasePath=join(dir,'app.sqlite'),sent=[];
 const mailOptions={env:config(),transport:{sendMail:async message=>{sent.push(message);return {accepted:[message.to]};}}};
 const {app,db,notifications}=createApp({databasePath,mailOptions});
 db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run('Mitra Surat','Pimpinan');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
 try{
  const registration=await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branch:'Lahat',name:'Siswa Privat',nis:'808080',password:'password-test-aman'})});
  const headers={'Content-Type':'application/json',Cookie:registration.headers.get('set-cookie').split(';')[0]};
  const data={request_type:'PKL',category:'Desain Grafis',partner_id:1,class_name:'Koding A 2026',issued:'2026-09-01',participants:[{name:'Siswa Privat',program:'Program Profesional 1 Tahun'}]};
  const response=await fetch(base+'/letters',{method:'POST',headers,body:JSON.stringify(data)});assert.equal(response.status,201);const {id}=await response.json();
  assert.equal(sent.length,0,'Penyimpanan pengajuan tidak menunggu panggilan SMTP');
  assert.equal(db.prepare('SELECT count(*) AS n FROM academic_email_jobs').get().n,1);
  // Recreate the application queue against the same DB to exercise retained jobs.
  const restarted=createApp({databasePath,mailOptions});
  await restarted.notifications.processPending();await notifications.processPending();restarted.db.close();
  assert.equal(sent.length,1);assert.equal(sent[0].to,'academic.lahat@example.test');
  assert.match(sent[0].text,/https:\/\/eduagentpct\.my\.id\/academic\.html\?request=[a-f0-9]{48}/);
  for(const secret of ['Siswa Privat','808080','password-test-aman'])assert.equal(sent[0].text.includes(secret),false);
  assert.equal(sent[0].attachments,undefined);
  const own=await(await fetch(base+'/letters',{headers})).json();assert.equal(own[0].email_notification.state,'submitted');
  db.prepare("UPDATE letters SET status='revision',version=2 WHERE id=?").run(id);
  assert.equal((await fetch(base+'/letters/'+id,{method:'PUT',headers,body:JSON.stringify(data)})).status,200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM academic_email_jobs').get().n,2);
  await notifications.processPending();assert.equal(sent.length,2);assert.notEqual(sent[0].messageId,sent[1].messageId);
  // Seed another pending request and approve before its queue is processed.
  const more=await(await fetch(base+'/letters',{method:'POST',headers,body:JSON.stringify(data)})).json();
  db.prepare("UPDATE letters SET status='approved',version=version+1 WHERE id=?").run(more.id);
  await notifications.processPending();assert.equal(sent.length,2);assert.equal(db.prepare('SELECT state FROM academic_email_jobs WHERE letter_id=?').get(more.id).state,'cancelled');
  // The same queue worker must never fall back from another branch to Lahat.
  db.prepare("UPDATE letters SET branch='Palembang OPI' WHERE id=?").run(id);notifications.enqueue(id,4);db.prepare('UPDATE letters SET version=4 WHERE id=?').run(id);
  await notifications.processPending();assert.equal(sent.at(-1).to,'academic.opi@example.test');
  delete mailOptions.env.ACADEMIC_EMAILS_JSON;
  db.prepare("UPDATE letters SET branch='Lahat',version=5 WHERE id=?").run(id);notifications.enqueue(id,5);
  await notifications.processPending();assert.equal(sent.at(-1).to,'tugasbelajarpctlahat@gmail.com');
 }finally{notifications.stop();await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Konfigurasi hilang, retry terbatas, SMTP menolak, dan error tanpa bocoran credential',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-mail-failure-'));const env={};let calls=0;
 const {db,notifications}=createApp({databasePath:join(dir,'app.sqlite'),mailOptions:{env,transport:{sendMail:async()=>{calls++;throw Error('provider debug with credentials must not be persisted');}}}});
 try{
  db.prepare('INSERT INTO students(id,name,nis,salt,hash) VALUES(1,?,?,?,?)').run('Uji','111','salt','hash');
  db.prepare('INSERT INTO partners(id,name,recipient) VALUES(1,?,?)').run('Mitra','Pimpinan');
  db.prepare('INSERT INTO letters(id,student_id,partner_id,start,end,issued,participants,review_token) VALUES(1,1,1,?,?,?,?,?)').run('2026-10-01','2026-11-01','2026-09-01','[]','b'.repeat(48));
  notifications.enqueue(1,1);await notifications.processPending();assert.equal(calls,0);
  assert.equal(db.prepare('SELECT state FROM academic_email_jobs').get().state,'blocked');
  Object.assign(env,config());
  for(let i=0;i<3;i++){db.prepare('UPDATE academic_email_jobs SET next_at=0').run();await notifications.processPending();}
  const job=db.prepare('SELECT * FROM academic_email_jobs').get();assert.equal(calls,3);assert.equal(job.state,'failed');assert.equal(job.last_code,'delivery_failed');
  await notifications.processPending();assert.equal(calls,3);
  assert.equal(JSON.stringify(job).includes('credentials'),false);
  // Missing recipient does not send to a default mailbox.
  db.prepare("UPDATE letters SET branch='Baturaja',version=2 WHERE id=1").run();notifications.enqueue(1,2);await notifications.processPending();
  assert.equal(calls,3);assert.equal(db.prepare('SELECT state FROM academic_email_jobs WHERE letter_version=2').get().state,'blocked');
 }finally{notifications.stop();db.close();rmSync(dir,{recursive:true,force:true});}
});
