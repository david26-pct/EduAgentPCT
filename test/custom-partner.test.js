import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {createApp} from '../server.js';
import {seedAcademic,staffPassword} from '../test-support/academic.js';

test('Lainnya: ketik tujuan, revisi, periksa akademik, setujui, dan PDF tanpa mengubah daftar mitra',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-custom-'));const {app,db}=createApp({databasePath:join(dir,'app.sqlite')});seedAcademic(db);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext();const page=await context.newPage();
  await page.goto(base);await page.locator('#register-tab').click();
  for(const [field,value] of Object.entries({branch:'Lahat',name:'Siswa Tujuan Manual',nis:'454545',password:'password-custom-aman',confirm:'password-custom-aman'})){
   const input=page.locator('#auth-form [name='+field+']');if(field==='branch')await input.selectOption(value);else await input.fill(value);
  }
  await page.locator('#auth-submit').click();await page.locator('#greeting').waitFor();
  assert.equal(await page.locator('aside [data-view=career] span').innerText(),'Cari Rekomendasi Tempat PKL');
  await page.locator('aside [data-view=create]').click();
  assert.equal(await page.locator('#letter-form [name=partner_id] option').last().textContent(),'Lainnya — ketik sendiri');
  await page.locator('#letter-form [name=partner_id]').selectOption('other');
  await page.locator('[name=custom_partner_name]').fill('PT Tujuan Pilihan Siswa');
  await page.locator('#letter-form [name=category]').selectOption('Desain Grafis');
  await page.locator('#letter-form [name=class_name]').fill('Koding A 2026');
  await page.locator('#preview-button').click();assert.match(await page.locator('#preview-content').innerText(),/PT Tujuan Pilihan Siswa/);await page.locator('#close-preview').click();
  await page.locator('#save-letter').click();await page.locator('#history .whatsapp').waitFor();
  assert.match(await page.locator('#history').innerText(),/Tujuan lainnya · isian siswa/);
  const letter=db.prepare('SELECT * FROM letters').get();assert.equal(letter.partner_id,null);assert.equal(db.prepare('SELECT count(*) AS n FROM partners').get().n,0);
  const staff=await fetch(base+'/api/academic/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branch:'Lahat',username:'academic.test',password:staffPassword})});
  const headers={'Content-Type':'application/json',Cookie:staff.headers.get('set-cookie').split(';')[0]};
  let response=await fetch(base+'/api/academic/requests/'+letter.review_token,{headers});assert.equal((await response.json()).partner_name,'PT Tujuan Pilihan Siswa');
  response=await fetch(base+'/api/academic/requests/'+letter.review_token+'/decision',{method:'POST',headers,body:JSON.stringify({action:'revision',note:'Lengkapi nama perusahaan.',version:1})});assert.equal(response.status,200);
  await page.locator('#history-refresh').click();await page.locator('#history .complete').click();assert.equal(await page.locator('[name=custom_partner_name]').inputValue(),'PT Tujuan Pilihan Siswa');
  await page.locator('[name=custom_partner_name]').fill('PT Tujuan Pilihan Siswa Lahat');await page.locator('#save-letter').click();await page.locator('#history .whatsapp').waitFor();
  const changed=db.prepare('SELECT * FROM letters WHERE id=?').get(letter.id);
  response=await fetch(base+'/api/academic/requests/'+letter.review_token+'/decision',{method:'POST',headers,body:JSON.stringify({action:'approve',start:'2026-10-01',end:'2026-11-01',number:'MANUAL/001',version:changed.version})});assert.equal(response.status,200);
  await page.locator('#history-refresh').click();await page.locator('#history .download').waitFor();
  const download=page.waitForEvent('download');await page.locator('#history .download').click();const file=await download;await file.saveAs(join(dir,'custom.pdf'));
  const text=execFileSync('pdftotext',['-layout',join(dir,'custom.pdf'),'-'],{encoding:'utf8'});assert.match(text,/PT Tujuan Pilihan Siswa Lahat/);assert.match(text,/MANUAL\/001/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM partners').get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM academic_email_jobs').get().n,2);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }finally{await browser.close();await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Migrasi tujuan manual mempertahankan surat disetujui, audit, dan antrean email lama',()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-custom-migrate-')),databasePath=join(dir,'app.sqlite');let {db}=createApp({databasePath});
 try{
  db.prepare('INSERT INTO students(id,name,nis,salt,hash) VALUES(1,?,?,?,?)').run('Siswa Lama','777','salt','hash');
  db.prepare('INSERT INTO partners(id,name,recipient) VALUES(1,?,?)').run('Mitra Lama','Pimpinan');
  db.prepare("INSERT INTO letters(id,student_id,partner_id,start,end,issued,participants,number,status,review_token) VALUES(1,1,1,?,?,?,?,?,'approved',?)").run('2026-10-01','2026-11-01','2026-09-01','[]','NOMOR/LAMA','a'.repeat(48));
  db.prepare("INSERT INTO letter_events(letter_id,actor_type,actor_id,actor_name,action) VALUES(1,'academic',1,'Akademik Lama','approved')").run();
  db.prepare('INSERT INTO academic_email_jobs(letter_id,letter_version) VALUES(1,1)').run();
  db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
  const original=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='letters'").get().sql;
  const indexes=db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='letters' AND sql IS NOT NULL").all();
  const sql=original.replace(/^CREATE TABLE\s+(?:"letters"|letters)\s*/i,'CREATE TABLE old_destination_letters ').replace(/partner_id INTEGER/i,'partner_id INTEGER NOT NULL');
  db.exec(sql);db.exec('INSERT INTO old_destination_letters SELECT * FROM letters;DROP TABLE letters;ALTER TABLE old_destination_letters RENAME TO letters;ALTER TABLE letters DROP COLUMN custom_partner_name;');
  for(const index of indexes)db.exec(index.sql);
  db.exec('COMMIT');db.close();
  for(let i=0;i<2;i++){
   const instance=createApp({databasePath});db=instance.db;
   assert.equal(db.prepare('PRAGMA table_info(letters)').all().find(c=>c.name==='partner_id').notnull,0);
   assert.equal(db.prepare('SELECT number,status,review_token FROM letters WHERE id=1').get().status,'approved');
   assert.equal(db.prepare('SELECT count(*) AS n FROM letter_events WHERE letter_id=1').get().n,1);
   assert.equal(db.prepare('SELECT count(*) AS n FROM academic_email_jobs WHERE letter_id=1').get().n,1);
   assert.equal(db.prepare('SELECT number FROM letters').get().number,'NOMOR/LAMA');
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.close();
  }
 }finally{try{db.close();}catch{}rmSync(dir,{recursive:true,force:true});}
});
