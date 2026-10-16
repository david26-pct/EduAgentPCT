import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';
import { BRANCHES } from '../public/branches.js';
const root=fileURLToPath(new URL('../',import.meta.url));

test('Cabang mengisolasi login, mitra, rekomendasi, dan surat dengan NIS/nomor sama',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-branches-')),databasePath=join(dir,'app.sqlite');
 const {app,db}=createApp({databasePath});
 const rows=BRANCHES.map(branch=>({branch,name:'Mitra Bersama',recipient:'Pimpinan'}));
 writeFileSync(join(dir,'partners.json'),JSON.stringify(rows));
 for(let i=0;i<2;i++)execFileSync(process.execPath,['scripts/import-partners.js',join(dir,'partners.json')],{cwd:root,env:{...process.env,DB_PATH:databasePath}});
 assert.equal(db.prepare('SELECT count(*) AS n FROM partners').get().n,7);
 for(const p of db.prepare('SELECT id FROM partners').all()) db.prepare('INSERT INTO partner_profiles VALUES(?,?)').run(p.id,JSON.stringify({verified:true,acceptance:'open',categories:['UI/UX Design'],request_types:['PKL'],skills:['figma'],location:'Lahat',description:'Profil uji'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
 async function req(path,body,cookie,method=body?'POST':'GET'){return fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
 try{
  const account={name:'Siswa Cabang',nis:'123456',password:'password-cabang-aman'};
  assert.equal((await req('/register',account)).status,400);
  assert.equal((await req('/register',{...account,branch:'Cabang Palsu'})).status,400);
  const credentials={};
  for(const branch of BRANCHES){
   const registered=await req('/register',{...account,branch});assert.equal(registered.status,200);
   const cookie=registered.headers.get('set-cookie').split(';')[0];credentials[branch]=cookie;
   assert.equal((await registered.json()).branch,branch);
   const partners=await(await req('/partners',undefined,cookie)).json();assert.equal(partners.length,1);assert.equal(partners[0].branch,branch);
   const profile={request_type:'PKL',category:'UI/UX Design',skills:['figma']};
   assert.equal((await req('/career/profile',profile,cookie,'PUT')).status,200);
   const matches=await(await req('/career/matches',undefined,cookie)).json();assert.equal(matches.matches.length,1);assert.equal(matches.matches[0].id,partners[0].id);
  }
  assert.equal((await req('/register',{...account,branch:'Lahat'})).status,409);
  assert.equal((await req('/login',{...account,branch:'Palembang Sako'})).status,200);
  const onlyLahat={name:'Siswa Lokal',nis:'999111',password:'password-lokal-aman',branch:'Lahat'};
  assert.equal((await req('/register',onlyLahat)).status,200);
  assert.equal((await req('/login',{...onlyLahat,branch:'Prabumulih'})).status,401);
  const partners=db.prepare('SELECT * FROM partners').all();
  const lahat=partners.find(p=>p.branch==='Lahat'),opi=partners.find(p=>p.branch==='Palembang OPI');
  const letter={number:'SAMA/001',request_type:'PKL',category:'UI/UX Design',partner_id:lahat.id,start:'2026-10-01',end:'2026-11-01',issued:'2026-09-01',participants:[{name:account.name,program:'Program Profesional 1 Tahun'}]};
  assert.equal((await req('/letters',letter,credentials['Palembang OPI'])).status,400);
  const a=await req('/letters',letter,credentials.Lahat);assert.equal(a.status,201);const id=(await a.json()).id;
  assert.equal((await req('/letters',{...letter,partner_id:opi.id},credentials['Palembang OPI'])).status,201);
  assert.equal((await req(`/letters/${id}/pdf`,undefined,credentials['Palembang OPI'])).status,404);
  const opiLetters=await(await req('/letters',undefined,credentials['Palembang OPI'])).json();assert.equal(opiLetters.length,1);
  assert.equal((await req(`/letters/${opiLetters[0].id}/pdf`,undefined,credentials['Palembang OPI'])).status,409);
  assert.equal((await(await req('/branch',undefined,credentials['Palembang OPI'])).json()).letterhead,null);
  assert.equal((await req(`/letters/${id}/pdf`,undefined,credentials.Lahat)).status,200);
 } finally{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Migrasi cabang menjaga sesi aktif, pemilik surat, dan profil karier lama',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-branch-legacy-')),databasePath=join(dir,'app.sqlite');
 let {db}=createApp({databasePath});
 db.prepare('INSERT INTO students(id,name,nis,salt,hash) VALUES(?,?,?,?,?)').run(42,'Siswa Lama','424242','salt','hash');
 db.prepare('INSERT INTO partners(id,name,recipient) VALUES(?,?,?)').run(52,'Mitra Lama','Pimpinan');
 db.prepare('INSERT INTO letters(id,student_id,number,partner_id,start,end,issued,participants) VALUES(?,?,?,?,?,?,?,?)').run(62,42,'LAMA/42',52,'2026-10-01','2026-11-01','2026-09-01','[]');
 const {createHash}=await import('node:crypto');const token='legacy-session-token';
 db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),42,Date.now()+86400000);
 db.prepare('INSERT INTO skill_profiles VALUES(?,?)').run(42,JSON.stringify({category:'UI/UX Design',skills:['figma']}));
 db.prepare('INSERT INTO preparation_plans VALUES(?,?,?,?)').run(42,'template','Rencana lama','2026-10-01');
 db.exec(`PRAGMA foreign_keys=OFF; BEGIN;
 CREATE TABLE students_old(id INTEGER PRIMARY KEY,name TEXT NOT NULL,nis TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL);
 INSERT INTO students_old SELECT id,name,nis,salt,hash FROM students;
 DROP TABLE students; ALTER TABLE students_old RENAME TO students;
 CREATE TABLE letters_old(id INTEGER PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES students(id),number TEXT UNIQUE,partner_id INTEGER NOT NULL REFERENCES partners(id),start TEXT NOT NULL,end TEXT NOT NULL,issued TEXT NOT NULL,participants TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP,request_type TEXT NOT NULL DEFAULT 'PKL',category TEXT);
 INSERT INTO letters_old SELECT id,student_id,number,partner_id,start,end,issued,participants,created,request_type,category FROM letters;
 DROP TABLE letters; ALTER TABLE letters_old RENAME TO letters;
 ALTER TABLE partners DROP COLUMN branch; COMMIT;`);
 db.close();
 let server;
 try{
  // Run twice to verify repeatability and preserve old IDs and FK ownership.
  const first=createApp({databasePath});assert.deepEqual(first.db.prepare('PRAGMA foreign_key_check').all(),[]);first.db.close();
  const instance=createApp({databasePath});db=instance.db;server=instance.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/api`;const headers={Cookie:`session=${token}`};
  const me=await(await fetch(base+'/me',{headers})).json();assert.equal(me.id,42);assert.equal(me.branch,'Lahat');
  const letters=await(await fetch(base+'/letters',{headers})).json();assert.equal(letters[0].id,62);assert.equal(letters[0].branch,'Lahat');
  const career=await(await fetch(base+'/career',{headers})).json();assert.equal(career.profile.skills[0],'figma');assert.equal(career.plan.content,'Rencana lama');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{if(server)await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});
